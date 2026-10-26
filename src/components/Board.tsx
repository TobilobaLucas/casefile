import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Check, GripHorizontal, Link2, Maximize, Minus, Plus } from 'lucide-react';
import { ExhibitArt } from './Artwork';
import type { Evidence, GameState } from '../game/types';

type Position = { x: number; y: number };
export function Board({ state, open, connect, notify }: { state: GameState; open: (e: Evidence) => void; connect: (a: string, b: string) => void; notify: (text: string) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1020);
  const [zoom, setZoom] = useState(1);
  const [connecting, setConnecting] = useState(false);
  const [first, setFirst] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const drag = useRef<{ id: string; startX: number; startY: number; origin: Position } | null>(null);
  const scale = Math.min(width / 1020, 1.4) * zoom;
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    if (wrap.current) observer.observe(wrap.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setPositions({}); setFirst(null); setZoom(1); }, [state.code, state.startedAt]);
  const pos = (e: Evidence) => positions[e.id] ?? { x: e.x, y: e.y };
  function startDrag(e: PointerEvent<HTMLButtonElement>, evidence: Evidence) {
    if (e.pointerType === 'touch' && width < 700) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: evidence.id, startX: e.clientX, startY: e.clientY, origin: pos(evidence) };
  }
  function moveDrag(e: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    const d = drag.current;
    setPositions(p => ({ ...p, [d.id]: { x: Math.max(8, Math.min(772, d.origin.x + (e.clientX - d.startX) / scale)), y: Math.max(8, Math.min(435, d.origin.y + (e.clientY - d.startY) / scale)) } }));
  }
  function choose(e: Evidence) {
    if (!connecting) return open(e);
    if (!first) { setFirst(e.id); return; }
    if (first === e.id) { setFirst(null); return; }
    connect(first, e.id); setFirst(null);
  }
  return <section className="board-section" aria-label="Investigation board">
    <div className="board-toolbar"><div className="board-label"><span className="live-dot" /> EVIDENCE BOARD <span className="toolbar-count">{state.caseFile.evidence.length} exhibits<span> / </span>{state.connections.length} connections</span></div>
      <div className="board-tools"><button className={`tool-button ${connecting ? 'selected' : ''}`} onClick={() => { setConnecting(!connecting); setFirst(null); }} aria-pressed={connecting}><Link2 size={15} /><span>Connect clues</span></button><span className="tool-divider" /><button className="icon-button" aria-label="Zoom out" disabled={zoom <= .8} onClick={() => setZoom(z => Math.max(.8, z - .1))}><Minus size={15} /></button><span className="zoom-label">{Math.round(zoom * 100)}%</span><button className="icon-button" aria-label="Zoom in" disabled={zoom >= 1.3} onClick={() => setZoom(z => Math.min(1.3, z + .1))}><Plus size={15} /></button><button className="icon-button" aria-label="Reset board layout" onClick={() => { setZoom(1); setPositions({}); notify('Board layout reset. Your investigation is saved.'); }}><Maximize size={15} /></button></div>
    </div>
    {connecting && <div className="connect-banner" role="status"><Link2 size={15} />{first ? 'Now select another exhibit. Select an existing pair to remove its connection.' : 'Select two exhibits to connect the dots.'}<button onClick={() => { setConnecting(false); setFirst(null); }}>Done</button></div>}
    <div className="board-viewport" ref={wrap}>
      <div className="board-canvas" style={{ height: 710 * scale }}>
        <div className="board-stage" style={{ transform: `scale(${scale})` }}>
          <div className="board-watermark" aria-hidden="true">EVERY DETAIL MATTERS</div>
          <svg className="strings" viewBox="0 0 1020 710" aria-hidden="true">{state.connections.map(c => {
            const from = state.caseFile.evidence.find(e => e.id === c.from)!; const to = state.caseFile.evidence.find(e => e.id === c.to)!;
            const a = pos(from); const b = pos(to);
            return <g key={c.id}><line x1={a.x + 120} y1={a.y + 9} x2={b.x + 120} y2={b.y + 9} stroke="#a55f4d" strokeWidth="2" /><circle cx={a.x + 120} cy={a.y + 9} r="4" fill="#b26a52" /><circle cx={b.x + 120} cy={b.y + 9} r="4" fill="#b26a52" /></g>;
          })}</svg>
          {state.caseFile.evidence.map(e => <article className={`evidence-card ${state.discovered.includes(e.id) ? 'examined' : ''} ${first === e.id ? 'connecting-first' : ''}`} key={e.id} style={{ left: pos(e).x, top: pos(e).y, transform: `rotate(${e.rotation}deg)` }}>
            <button className="card-grip" aria-label={`Move ${e.title}. Use arrow keys to reposition.`} onPointerDown={event => startDrag(event, e)} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={event => {
              const changes: Record<string, Position> = { ArrowLeft: { x: -15, y: 0 }, ArrowRight: { x: 15, y: 0 }, ArrowUp: { x: 0, y: -15 }, ArrowDown: { x: 0, y: 15 } };
              if (changes[event.key]) { event.preventDefault(); const d = changes[event.key]; const p = pos(e); setPositions(ps => ({ ...ps, [e.id]: { x: Math.max(8, Math.min(772, p.x + d.x)), y: Math.max(8, Math.min(435, p.y + d.y)) } })); }
            }}><span className="pin" /><GripHorizontal size={13} /></button>
            <button className="card-content" onClick={() => choose(e)} aria-label={`${connecting ? 'Connect' : 'Examine'} ${e.title}`}>
              <span className="exhibit-label">{e.label}</span><ExhibitArt evidence={e} /><h3>{e.title}</h3><p>{e.summary}</p>
              <span className="card-bottom"><span>{e.timestamp} HRS</span>{state.discovered.includes(e.id) ? <span className="examined-label"><Check size={11} /> EXAMINED</span> : <span>TAKE A CLOSER LOOK ↗</span>}</span>
            </button>
          </article>)}
          <div className="board-footnote"><span className="crosshair">+</span> MERIDIAN MUSEUM / INCIDENT MX-{state.caseFile.seed} <span className="crosshair">+</span></div>
        </div>
      </div>
    </div>
    <div className="board-help"><GripHorizontal size={14} /><span>Drag the handles to arrange your board.</span><span className="help-separator">·</span><span>Open an exhibit to examine it.</span><span className="autosave"><span className="live-dot" />{state.code === 'SOLO' ? 'Progress saved on this device' : 'Room progress saved'}</span></div>
  </section>;
}
