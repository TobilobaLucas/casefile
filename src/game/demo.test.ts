import { describe, expect, it } from 'vitest';
import { newDemo, reduceDemo } from './demo';
import type { Action, GameState } from './types';
const action = (type: Action['type'], extra: Partial<Action> = {}): Action => ({ type, requestId: crypto.randomUUID(), ...extra });
const inspect = (s: GameState, target: string) => reduceDemo(s, action('inspect', { target }));
function prepared() {
  let s = inspect(newDemo(), 'access-log'); s = inspect(s, 'locker-receipt');
  return reduceDemo(s, action('interview', { target: 'elias' }));
}
describe('solo investigation rules', () => {
  it('does not leak the solution through the public game state', () => {
    const state = newDemo();
    expect(state.caseFile).not.toHaveProperty('solution');
    expect(state.caseFile.suspects[1]).not.toHaveProperty('statement');
    expect(state.statements).toEqual({});
  });
  it('does not double-count repeat inspections or mutate the previous snapshot', () => {
    const original = newDemo(); const next = inspect(original, 'access-log');
    const repeat = inspect(next, 'access-log');
    expect(original.discovered).toEqual([]); expect(next.discovered).toEqual(['access-log']);
    expect(repeat.discovered).toHaveLength(1); expect(repeat.timeline).toHaveLength(1);
  });
  it('requires an interview and examined supporting evidence before accusing', () => {
    expect(() => reduceDemo(newDemo(), action('accuse', { target: 'elias', evidenceIds: ['access-log', 'locker-receipt'] }))).toThrow('Examine');
    const state = inspect(inspect(newDemo(), 'access-log'), 'locker-receipt');
    expect(() => reduceDemo(state, action('accuse', { target: 'elias', evidenceIds: ['access-log', 'locker-receipt'] }))).toThrow('Question');
  });
  it('rejects a correct suspect backed by the wrong pair of evidence', () => {
    const state = inspect(prepared(), 'voice-note');
    const result = reduceDemo(state, action('accuse', { target: 'elias', evidenceIds: ['access-log', 'voice-note'] }));
    expect(result.status).toBe('investigating'); expect(result.mistakes).toBe(1); expect(result.explanation).toBeUndefined();
  });
  it('solves with two independent proofs in either order and freezes the closed case', () => {
    const result = reduceDemo(prepared(), action('accuse', { target: 'elias', evidenceIds: ['locker-receipt', 'access-log'] }));
    expect(result.status).toBe('solved'); expect(result.explanation).toContain('N-41');
    expect(() => inspect(result, 'voice-note')).toThrow('closed');
  });
  it('ends the investigation after three unsupported accusations', () => {
    let state = inspect(prepared(), 'voice-note');
    for (let i = 0; i < 3; i++) state = reduceDemo(state, action('accuse', { target: 'elias', evidenceIds: ['access-log', 'voice-note'] }));
    expect(state.status).toBe('cold'); expect(state.mistakes).toBe(3);
  });
  it('normalizes undirected connections and toggles them off', () => {
    const a = reduceDemo(newDemo(), action('connect', { target: 'access-log', other: 'locker-receipt' }));
    const b = reduceDemo(a, action('connect', { target: 'locker-receipt', other: 'access-log' }));
    expect(a.connections).toHaveLength(1); expect(b.connections).toHaveLength(0);
  });
});
