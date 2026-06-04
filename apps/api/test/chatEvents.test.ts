import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chatBroadcastTopic, ChatMessageType } from '../src/types/chat.js';

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const { canManageEvent, toChatMessage, toEventPayload } = await import('../src/services/chatEvents.js');

const startsAt = new Date('2026-06-04T17:00:00.000Z');
const endsAt = new Date('2026-06-04T18:30:00.000Z');
const attendeeCreatedAt = new Date('2026-06-01T12:00:00.000Z');
const messageCreatedAt = new Date('2026-06-02T08:30:00.000Z');

const event = {
  id: 'event-1',
  title: 'Library study sprint',
  description: 'Bring notes from class.',
  locationName: 'Campus Library',
  locationAddress: '18115 Campus Way NE',
  startsAt,
  endsAt,
  createdById: 'user-1',
  groupId: 'group-1',
  attendees: [
    {
      id: 'attendee-1',
      eventId: 'event-1',
      userId: 'user-1',
      status: 'GOING',
      createdAt: attendeeCreatedAt,
      user: { id: 'user-1', username: 'alaris', displayName: 'Alaris' },
    },
    {
      id: 'attendee-2',
      eventId: 'event-1',
      userId: 'user-2',
      status: 'MAYBE',
      createdAt: attendeeCreatedAt,
      user: { id: 'user-2', username: null, displayName: 'Tristan' },
    },
  ],
} as any;

describe('chat event wire helpers', () => {
  it('serializes event snapshots for chat payloads', () => {
    assert.deepEqual(toEventPayload(event), {
      eventId: 'event-1',
      title: 'Library study sprint',
      description: 'Bring notes from class.',
      locationName: 'Campus Library',
      locationAddress: '18115 Campus Way NE',
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      createdById: 'user-1',
      groupId: 'group-1',
      rsvps: [
        {
          user: { id: 'user-1', username: 'alaris', displayName: 'Alaris' },
          status: 'GOING',
          createdAt: attendeeCreatedAt.toISOString(),
        },
        {
          user: { id: 'user-2', username: null, displayName: 'Tristan' },
          status: 'MAYBE',
          createdAt: attendeeCreatedAt.toISOString(),
        },
      ],
    });
  });

  it('allows null optional event fields in chat payloads', () => {
    const payload = toEventPayload({
      ...event,
      description: null,
      locationName: null,
      locationAddress: null,
      endsAt: null,
      groupId: null,
      attendees: [],
    });

    assert.equal(payload.description, null);
    assert.equal(payload.locationName, null);
    assert.equal(payload.locationAddress, null);
    assert.equal(payload.endsAt, null);
    assert.equal(payload.groupId, null);
    assert.deepEqual(payload.rsvps, []);
  });

  it('wraps event payloads in canonical chat messages', () => {
    const message = toChatMessage(
      {
        id: 'message-1',
        chatId: 'chat-1',
        senderId: 'user-1',
        kind: 'EVENT',
        body: 'Proposed event: Library study sprint',
        eventId: 'event-1',
        createdAt: messageCreatedAt,
        sender: { id: 'user-1', username: 'alaris', displayName: 'Alaris' },
      } as any,
      event,
    );

    assert.equal(message.id, 'message-1');
    assert.equal(message.chatId, 'chat-1');
    assert.deepEqual(message.sender, { id: 'user-1', username: 'alaris', displayName: 'Alaris' });
    assert.equal(message.type, ChatMessageType.EVENT);
    assert.equal(message.createdAt, messageCreatedAt.toISOString());
    assert.equal((message.payload as { eventId: string }).eventId, 'event-1');
  });

  it('checks event ownership and chat realtime topic formatting', () => {
    assert.equal(canManageEvent({ createdById: 'user-1' } as any, 'user-1'), true);
    assert.equal(canManageEvent({ createdById: 'user-1' } as any, 'user-2'), false);
    assert.equal(chatBroadcastTopic('chat-abc'), 'chat:chat-abc');
  });
});
