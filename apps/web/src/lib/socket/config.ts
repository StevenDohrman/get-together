/**
 * Socket.IO configuration and event names
 * Must match server-side SOCKET_EVENTS
 */

export const SOCKET_EVENTS = {
  // Client to server
  JOIN_CHAT: 'chat:join',
  LEAVE_CHAT: 'chat:leave',
  SEND_MESSAGE: 'chat:message:send',

  // Server to client
  MESSAGE_RECEIVED: 'chat:message:received',
  MESSAGE_SENT: 'chat:message:sent',
  ERROR: 'chat:error',
  USER_JOINED: 'chat:user:joined',
  USER_LEFT: 'chat:user:left',
  /** An EVENT message's RSVPs changed; payload is the full snapshot. */
  EVENT_UPDATED: 'chat:event:updated',
} as const;

/**
 * Get the API base URL for socket connection
 */
export function getSocketURL(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;

  // In development, connect to localhost API on port 4000
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return `${protocol}//localhost:4000`;
  }

  // In production, use same host
  return `${protocol}//${host}`;
}
