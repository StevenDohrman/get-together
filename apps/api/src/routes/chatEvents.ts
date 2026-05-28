import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prismaClient as prisma } from '../db.js';
import { requireAppUser } from '../requireAppUser.js';
import {
  clearEventRsvp,
  createChatEvent,
  getEventById,
  setEventRsvp,
  toChatMessage,
  toEventPayload,
} from '../services/chatEvents.js';
import { isChatMember } from '../services/groupChat.js';
import type { ChatBroadcaster } from '../services/realtimeBroadcast.js';

export type ChatEventsRouteDeps = {
  supabaseAdmin: SupabaseClient | null;
  /**
   * Optional Realtime broadcaster. When present, event mutations are pushed
   * to subscribed chat members. REST still works without it (e.g. in tests).
   */
  broadcaster?: ChatBroadcaster | null;
};

const chatIdParam = z.object({ chatId: z.string().uuid() });
const eventChatParams = chatIdParam.extend({
  eventId: z.string().uuid(),
});

/**
 * Trim, drop empties, and cap free-text fields to keep the DB tidy.
 * Used uniformly across the create body so callers don't have to.
 */
const optionalShortText = z
  .string()
  .trim()
  .max(200)
  .transform((s) => (s.length > 0 ? s : null))
  .nullable()
  .optional();

const optionalLongText = z
  .string()
  .trim()
  .max(2000)
  .transform((s) => (s.length > 0 ? s : null))
  .nullable()
  .optional();

const createEventBody = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: optionalLongText,
    locationName: optionalShortText,
    locationAddress: z
      .string()
      .trim()
      .max(500)
      .transform((s) => (s.length > 0 ? s : null))
      .nullable()
      .optional(),
    startsAt: z
      .string()
      .datetime({ offset: true })
      .or(z.string().datetime()),
    endsAt: z
      .string()
      .datetime({ offset: true })
      .or(z.string().datetime())
      .nullable()
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (val.endsAt) {
      if (new Date(val.endsAt) <= new Date(val.startsAt)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endsAt'],
          message: 'endsAt must be after startsAt',
        });
      }
    }
  });

const setRsvpBody = z.object({
  status: z.enum(['GOING', 'MAYBE', 'NOT_GOING']),
});

export function registerChatEventsRoutes(
  app: FastifyInstance,
  deps: ChatEventsRouteDeps,
) {
  const { supabaseAdmin, broadcaster } = deps;

  /**
   * Propose a new event in a chat the user is a member of. The event is
   * created as a row in `Event` (hosted by the chat's group when there is
   * one), the announcing chat message is created and linked to it, and the
   * full payload is broadcast on the realtime channel so other members see
   * it immediately.
   */
  app.post('/me/chats/:chatId/events', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const params = chatIdParam.safeParse(req.params);
    if (!params.success) {
      return reply.status(400).send({ error: 'Invalid chatId' });
    }

    if (!(await isChatMember(params.data.chatId, row.id))) {
      return reply.status(403).send({ error: 'Not a chat member' });
    }

    const body = createEventBody.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({
        error: 'Invalid body',
        details: body.error.flatten().fieldErrors,
      });
    }

    // Look up the chat so we can host the event under its group (if any).
    const chat = await prisma.groupChat.findUnique({
      where: { id: params.data.chatId },
      select: { id: true, groupId: true },
    });
    if (!chat) {
      return reply.status(404).send({ error: 'Chat not found' });
    }

    const created = await createChatEvent({
      chatId: chat.id,
      groupId: chat.groupId,
      createdById: row.id,
      title: body.data.title,
      description: body.data.description ?? null,
      locationName: body.data.locationName ?? null,
      locationAddress: body.data.locationAddress ?? null,
      startsAt: new Date(body.data.startsAt),
      endsAt: body.data.endsAt ? new Date(body.data.endsAt) : null,
    });

    void broadcaster?.broadcastMessage(chat.id, created.chatMessage);

    return reply.status(201).send({ message: created.chatMessage });
  });

  /**
   * Upsert the requester's RSVP on an event. Anyone in the chat may RSVP.
   */
  app.put(
    '/me/chats/:chatId/events/:eventId/rsvp',
    async (req, reply) => {
      const row = await requireAppUser(req, reply, supabaseAdmin);
      if (!row) return;

      const params = eventChatParams.safeParse(req.params);
      if (!params.success) {
        return reply.status(400).send({ error: 'Invalid params' });
      }

      if (!(await isChatMember(params.data.chatId, row.id))) {
        return reply.status(403).send({ error: 'Not a chat member' });
      }

      const body = setRsvpBody.safeParse(req.body);
      if (!body.success) {
        return reply.status(400).send({
          error: 'Invalid body',
          details: body.error.flatten().fieldErrors,
        });
      }

      // Verify the event was actually announced in this chat. We look it up
      // via the announce message rather than trusting params alone so users
      // can't RSVP cross-chat through brute-forced event ids.
      const announce = await prisma.groupChatMessage.findFirst({
        where: {
          chatId: params.data.chatId,
          eventId: params.data.eventId,
        },
        select: { id: true },
      });
      if (!announce) {
        return reply.status(404).send({ error: 'Event not found in this chat' });
      }

      const event = await setEventRsvp({
        eventId: params.data.eventId,
        userId: row.id,
        status: body.data.status,
      });
      if (!event) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      const payload = toEventPayload(event);
      void broadcaster?.broadcastEventUpdated(params.data.chatId, payload);

      return reply.send({ event: payload });
    },
  );

  /**
   * Remove the requester's RSVP. Useful to revert from a stance back to
   * "no answer". Idempotent — returns the current event either way.
   */
  app.delete(
    '/me/chats/:chatId/events/:eventId/rsvp',
    async (req, reply) => {
      const row = await requireAppUser(req, reply, supabaseAdmin);
      if (!row) return;

      const params = eventChatParams.safeParse(req.params);
      if (!params.success) {
        return reply.status(400).send({ error: 'Invalid params' });
      }

      if (!(await isChatMember(params.data.chatId, row.id))) {
        return reply.status(403).send({ error: 'Not a chat member' });
      }

      const announce = await prisma.groupChatMessage.findFirst({
        where: {
          chatId: params.data.chatId,
          eventId: params.data.eventId,
        },
        select: { id: true },
      });
      if (!announce) {
        return reply.status(404).send({ error: 'Event not found in this chat' });
      }

      const event = await clearEventRsvp({
        eventId: params.data.eventId,
        userId: row.id,
      });
      if (!event) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      const payload = toEventPayload(event);
      void broadcaster?.broadcastEventUpdated(params.data.chatId, payload);

      return reply.send({ event: payload });
    },
  );

  /**
   * Fetch a single event (with full RSVP roster). Useful when the FE comes
   * in via deep link before subscribing to the realtime channel.
   */
  app.get(
    '/me/chats/:chatId/events/:eventId',
    async (req, reply) => {
      const row = await requireAppUser(req, reply, supabaseAdmin);
      if (!row) return;

      const params = eventChatParams.safeParse(req.params);
      if (!params.success) {
        return reply.status(400).send({ error: 'Invalid params' });
      }

      if (!(await isChatMember(params.data.chatId, row.id))) {
        return reply.status(403).send({ error: 'Not a chat member' });
      }

      const announce = await prisma.groupChatMessage.findFirst({
        where: {
          chatId: params.data.chatId,
          eventId: params.data.eventId,
        },
        include: {
          sender: { select: { id: true, username: true, displayName: true } },
        },
      });
      if (!announce) {
        return reply.status(404).send({ error: 'Event not found in this chat' });
      }

      const event = await getEventById(params.data.eventId);
      if (!event) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      return reply.send({
        event: toEventPayload(event),
        message: toChatMessage(announce, event),
      });
    },
  );
}
