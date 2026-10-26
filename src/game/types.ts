export interface Suspect {
  id: string; name: string; role: string; badge: string; locker: string;
  avatar: string; color: string; quote: string; motive: string; alibi: string;
}
export interface Evidence {
  id: string; title: string; kind: 'photo' | 'log' | 'map' | 'receipt' | 'audio' | 'note';
  label: string; summary: string; body: string; timestamp: string; source: string;
  x: number; y: number; rotation: number;
}
export interface CaseFile {
  id: string; title: string; subtitle: string; location: string; incidentTime: string;
  seed: number; difficulty: string; briefing: string; suspects: Suspect[]; evidence: Evidence[];
}
export interface GameState {
  code: string; version: number; status: 'investigating' | 'solved' | 'cold';
  startedAt: string; finishedAt?: string; caseFile: CaseFile;
  players: { id: string; name: string }[]; discovered: string[]; interviewed: string[];
  statements: Record<string, string>;
  connections: { id: string; from: string; to: string }[];
  notes: { id: string; text: string; author: string; at: string }[];
  timeline: { id: string; actor: string; text: string; kind: string; at: string }[];
  mistakes: number; explanation?: string; culpritId?: string;
}
export interface Action {
  requestId: string; type: 'inspect' | 'interview' | 'connect' | 'note' | 'accuse';
  target?: string; other?: string; note?: string; evidenceIds?: string[];
}
export interface Session { token: string; playerId: string; state: GameState }
export type Mode = 'demo' | 'live';
