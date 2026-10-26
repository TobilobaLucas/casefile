import type { Action, GameState, Session } from './types';

const origin = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
async function request<T>(path: string, body?: unknown, token?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${origin}/api${path}`, {
      method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(12_000),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch { throw new Error('Cannot reach the game server. Start the local services to play together, or continue the solo demo.'); }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Game server returned ${response.status}. Check that Spring Boot and the Python generator are running.`);
  }
  return response.json();
}
export const createRoom = (name: string, seed?: number) => request<Session>('/rooms', { name, ...(seed === undefined ? {} : { seed }) });
export const joinRoom = (name: string, code: string) => request<Session>(`/rooms/${code}/join`, { name });
export const sendAction = (session: Session, action: Action) => request<GameState>(`/rooms/${session.state.code}/actions`, action, session.token);
export const getSnapshot = (session: Session) => request<GameState>(`/rooms/${session.state.code}`, undefined, session.token);

/** Fetch-based SSE keeps credentials in an Authorization header, out of URLs. */
export async function watchRoom(session: Session, signal: AbortSignal, onState: (state: GameState) => void, onStatus: (connected: boolean) => void) {
  let delay = 1000;
  while (!signal.aborted) {
    try {
      const response = await fetch(`${origin}/api/rooms/${session.state.code}/events`, { headers: { Authorization: `Bearer ${session.token}` }, signal });
      if (!response.ok || !response.body) throw new Error('Stream unavailable');
      onStatus(true); delay = 1000;
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      while (!signal.aborted) {
        const { value, done } = await reader.read(); if (done) break;
        buffer += value.replace(/\r\n/g, '\n');
        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
          const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
          if (data) onState(JSON.parse(data));
        }
      }
    } catch { if (signal.aborted) return; }
    onStatus(false);
    // Refresh after a broken stream. Monotonic versions prevent stale overwrites.
    try { if (!signal.aborted) onState(await getSnapshot(session)); } catch { /* Reconnect below. */ }
    await new Promise<void>(resolve => {
      const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
      const timer = setTimeout(finish, delay); signal.addEventListener('abort', finish, { once: true });
    });
    delay = Math.min(delay * 2, 10_000);
  }
}
