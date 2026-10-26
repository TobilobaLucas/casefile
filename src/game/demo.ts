import fixture from '../../shared/demo-case.json';
import type { Action, CaseFile, GameState } from './types';

export const DEMO_KEY = 'casefile.demo.v1';
const statementMap = Object.fromEntries(fixture.suspects.map(s => [s.id, s.statement]));
const { solution, suspects, ...publicFixture } = fixture;
const caseFile = { ...publicFixture, suspects: suspects.map(({ statement: _, ...s }) => s) } as CaseFile;

export function newDemo(): GameState {
  return { code: 'SOLO', version: 0, status: 'investigating', startedAt: new Date().toISOString(),
    caseFile: structuredClone(caseFile), players: [{ id: 'you', name: 'You' }],
    discovered: [], interviewed: [], statements: {}, connections: [], notes: [], timeline: [], mistakes: 0 };
}
export function restoreDemo(): GameState {
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_KEY) ?? 'null');
    if (saved?.caseFile?.id === 'MX-41' && Array.isArray(saved.discovered) && saved.version >= 0) return saved;
  } catch { /* A blocked or full storage must not prevent play. */ }
  return newDemo();
}
export function reduceDemo(current: GameState, action: Action): GameState {
  if (current.status !== 'investigating') throw new Error('This case is closed. Start a new investigation.');
  const state = structuredClone(current);
  const event = (text: string, kind: string) => state.timeline.push({ id: action.requestId, actor: 'You', text, kind, at: new Date().toISOString() });
  switch (action.type) {
    case 'inspect': {
      const evidence = caseFile.evidence.find(e => e.id === action.target);
      if (!evidence) throw new Error('Unknown exhibit.');
      if (!state.discovered.includes(evidence.id)) { state.discovered.push(evidence.id); event(`examined ${evidence.title}`, 'evidence'); }
      break;
    }
    case 'interview': {
      const suspect = caseFile.suspects.find(s => s.id === action.target);
      if (!suspect) throw new Error('Unknown suspect.');
      if (!state.interviewed.includes(suspect.id)) {
        state.interviewed.push(suspect.id); state.statements[suspect.id] = statementMap[suspect.id];
        event(`questioned ${suspect.name}`, 'interview');
      }
      break;
    }
    case 'connect': {
      if (action.target === action.other || !caseFile.evidence.some(e => e.id === action.target) || !caseFile.evidence.some(e => e.id === action.other)) throw new Error('Choose two different exhibits.');
      const pair = [action.target!, action.other!].sort(); const id = pair.join(':');
      if (state.connections.some(c => c.id === id)) state.connections = state.connections.filter(c => c.id !== id);
      else { state.connections.push({ id, from: pair[0], to: pair[1] }); event('connected two exhibits', 'connection'); }
      break;
    }
    case 'note':
      if (!action.note?.trim() || action.note.length > 500) throw new Error('Notes must contain 1–500 characters.');
      if (state.notes.length >= 50) throw new Error('This case already has 50 notes.');
      state.notes.push({ id: action.requestId, text: action.note.trim(), author: 'You', at: new Date().toISOString() });
      event('added a field note', 'note'); break;
    case 'accuse': {
      if (!action.evidenceIds || new Set(action.evidenceIds).size !== 2 || action.evidenceIds.length !== 2) throw new Error('Choose exactly two supporting exhibits.');
      if (!action.evidenceIds.every(id => state.discovered.includes(id))) throw new Error('Examine both supporting exhibits first.');
      if (!state.interviewed.includes(action.target!)) throw new Error('Question this suspect first.');
      const correct = action.target === solution.suspectId && solution.proofIds.every(id => action.evidenceIds!.includes(id));
      if (correct) { state.status = 'solved'; event('closed the case. Mystery solved.', 'solved'); }
      else { state.mistakes++; event('submitted a theory. The evidence did not hold up.', 'mistake'); if (state.mistakes >= 3) state.status = 'cold'; }
      if (state.status !== 'investigating') { state.explanation = solution.explanation; state.culpritId = solution.suspectId; state.finishedAt = new Date().toISOString(); }
      break;
    }
  }
  state.version++;
  return state;
}
