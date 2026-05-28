import type {
  Event,
  EventAttendee,
  GroupChatMessage,
  Prisma,
  RSVPStatus,
  User,
} from '@prisma/client';
import { prismaClient as prisma } from '../db.js';
import {
  type ChatMessage,
  type EventMessagePayload,
  type EventRsvpDto,
  ChatMessageType,
} from '../types/chat.js';

/**
 * Shape returned from Prisma when we fetch an event together with the
 * data needed to render it on the wire (attendees with their users).
 */
type EventWithAttendees = Event & {
  attendees: Array<
    EventAttendee & {
      user: Pick<User, 'id' | 'username' | 'displayName'>;
    }
  >;
};

type MessageWithSender = GroupChatMessage & {
  sender: Pick<User, 'id' | 'username' | 'displayName'>;
};

const eventInclude = {
  attendees: {
    include: {
      user: { select: { id: true, username: true, displayName: true } },
    },
  },
} satisfies Prisma.EventInclude;

/** Validated input for proposing a new event in a chat. */
export interface CreateChatEventInput {
  chatId: string;
  /** Host group for the event. Null when the chat has no formed group. */
  groupId: string | null;
  createdById: string;
  title: string;
  description?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
}

/**
 * Result of creating a new event proposal: the announce message + the
 * event payload, in the same shape callers will broadcast on the chat's
 * realtime channel.
 */
export interface CreatedChatEvent {
  event: EventWithAttendees;
  message: MessageWithSender;
  chatMessage: ChatMessage;
}

/** Build the user-facing announce text used as the message `body`. */
function buildAnnounceBody(event: Pick<Event, 'title'>): string {
  return `Proposed event: ${event.title}`;
}

/** Convert a Prisma event (with attendees) into the wire payload. */
export function toEventPayload(
  event: EventWithAttendees,
): EventMessagePayload {
  const rsvps: EventRsvpDto[] = event.attendees.map((a) => ({
    user: {
      id: a.user.id,
      username: a.user.username,
      displayName: a.user.displayName,
    },
    status: a.status,
    createdAt: a.createdAt.toISOString(),
  }));

  return {
    eventId: event.id,
    title: event.title,
    description: event.description,
    locationName: event.locationName,
    locationAddress: event.locationAddress,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    createdById: event.createdById,
    groupId: event.groupId,
    rsvps,
  };
}

/** Convert a persisted message + its event into the canonical wire message. */
export function toChatMessage(
  message: MessageWithSender,
  event: EventWithAttendees,
): ChatMessage {
  return {
    id: message.id,
    chatId: message.chatId,
    sender: {
      id: message.sender.id,
      username: message.sender.username,
      displayName: message.sender.displayName,
    },
    type: ChatMessageType.EVENT,
    payload: toEventPayload(event),
    createdAt: message.createdAt.toISOString(),
  };
}

/**
 * Atomically create an `Event` row and the `GroupChatMessage` that announces
 * it, linking them together. The creator is auto-RSVP'd as GOING so the chat
 * sees an initial accepted count.
 *
 * Caller is responsible for verifying chat membership before invoking.
 */
export async function createChatEvent(
  input: CreateChatEventInput,
): Promise<CreatedChatEvent> {
  if (input.endsAt && input.endsAt <= input.startsAt) {
    throw new Error('endsAt must be after startsAt');
  }

  const created = await prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        locationName: input.locationName ?? null,
        locationAddress: input.locationAddress ?? null,
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        createdById: input.createdById,
        groupId: input.groupId,
        attendees: {
          create: [
            {
              userId: input.createdById,
              status: 'GOING',
            },
          ],
        },
      },
      include: eventInclude,
    });

    const message = await tx.groupChatMessage.create({
      data: {
        chatId: input.chatId,
        senderId: input.createdById,
        kind: 'EVENT',
        body: buildAnnounceBody(event),
        eventId: event.id,
      },
      include: {
        sender: { select: { id: true, username: true, displayName: true } },
      },
    });

    return { event, message };
  });

  return {
    event: created.event,
    message: created.message,
    chatMessage: toChatMessage(created.message, created.event),
  };
}

/**
 * Insert or update the RSVP for a single user on a single event. Returns the
 * refreshed event with all attendees so callers can broadcast a snapshot.
 *
 * Caller is responsible for verifying chat membership before invoking.
 */
export async function setEventRsvp(args: {
  eventId: string;
  userId: string;
  status: RSVPStatus;
}): Promise<EventWithAttendees | null> {
  const event = await prisma.event.findUnique({
    where: { id: args.eventId },
    select: { id: true },
  });
  if (!event) return null;

  await prisma.eventAttendee.upsert({
    where: {
      eventId_userId: {
        eventId: args.eventId,
        userId: args.userId,
      },
    },
    create: {
      eventId: args.eventId,
      userId: args.userId,
      status: args.status,
    },
    update: { status: args.status },
  });

  return prisma.event.findUnique({
    where: { id: args.eventId },
    include: eventInclude,
  });
}

/**
 * Remove a user's RSVP entirely (distinct from "NOT_GOING", which is an
 * explicit decline). Safe to call when no RSVP exists.
 */
export async function clearEventRsvp(args: {
  eventId: string;
  userId: string;
}): Promise<EventWithAttendees | null> {
  const event = await prisma.event.findUnique({
    where: { id: args.eventId },
    select: { id: true },
  });
  if (!event) return null;

  try {
    await prisma.eventAttendee.delete({
      where: {
        eventId_userId: {
          eventId: args.eventId,
          userId: args.userId,
        },
      },
    });
  } catch (err) {
    // P2025: record to delete does not exist — treat as no-op for idempotency.
    if ((err as { code?: string } | null)?.code !== 'P2025') {
      throw err;
    }
  }

  return prisma.event.findUnique({
    where: { id: args.eventId },
    include: eventInclude,
  });
}

/**
 * Fetch one event (with attendees + users) — for hydrating GET responses
 * where the FE wants the full payload, not just the FK.
 */
export async function getEventById(
  eventId: string,
): Promise<EventWithAttendees | null> {
  return prisma.event.findUnique({
    where: { id: eventId },
    include: eventInclude,
  });
}

/**
 * Returns whether `userId` is permitted to mutate `event` itself (edit /
 * delete). RSVP'ing is open to all chat members and is gated separately.
 */
export function canManageEvent(
  event: Pick<Event, 'createdById'>,
  userId: string,
): boolean {
  return event.createdById === userId;
}
