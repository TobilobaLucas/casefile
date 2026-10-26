import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowRight, AudioLines, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp, Clipboard, Clock3, Copy, FileText, Fingerprint, FolderClosed, FolderOpen, LayoutDashboard, Link2, LoaderCircle, MapPin, MessageSquare, Moon, Plus, Radio, RotateCcw, Search, Send, ShieldCheck, Sparkles, StickyNote, Target, Users, X } from 'lucide-react';
import { Board } from './components/Board';
import { ExhibitArt, Portrait } from './components/Artwork';
import { Modal } from './components/Modal';
import { createRoom, getSnapshot, joinRoom, sendAction, watchRoom } from './game/api';
import { DEMO_KEY, newDemo, reduceDemo, restoreDemo } from './game/demo';
import type { Action, Evidence, GameState, Mode, Session, Suspect } from './game/types';

type Tab = 'board' | 'suspects' | 'timeline' | 'notes';
type Dialog = 'briefing' | 'guide' | 'room' | 'accuse' | 'result' | null;
const tabs = [{ id: 'board', title: 'Evidence board', icon: LayoutDashboard }, { id: 'suspects', title: 'Suspect dossiers', icon: Fingerprint }, { id: 'timeline', title: 'Activity log', icon: Clock3 }, { id: 'notes', title: 'Field notes', icon: StickyNote }] as const;

function readLive(): Session | null {
  try { const s = JSON.parse(sessionStorage.getItem('casefile.session') ?? 'null'); return s?.token && s?.state?.code ? s : null; } catch { return null; }
}
const prettyTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const elapsed = (start: string, end: string) => {
  const seconds = Math.max(0, Math.floor((Date.parse(end) - Date.parse(start)) / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
};

export default function App() {
  const initialLive = useRef(readLive());
  const [session, setSession] = useState<Session | null>(initialLive.current);
  const [mode, setMode] = useState<Mode>(initialLive.current ? 'live' : 'demo');
  const [state, setState] = useState<GameState>(() => initialLive.current?.state ?? restoreDemo());
  const stateRef = useRef(state);
  const [tab, setTab] = useState<Tab>('board');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [exhibit, setExhibit] = useState<Evidence | null>(null);
  const [suspect, setSuspect] = useState<Suspect | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(new Date().toISOString());
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [accused, setAccused] = useState('');
  const [proof, setProof] = useState<string[]>([]);
  const [roomTab, setRoomTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [roomError, setRoomError] = useState('');
  const [roomSeed, setRoomSeed] = useState('');
  const inFlight = useRef(false);
  const closeDialog = useCallback(() => setDialog(null), []);
  const notify = useCallback((message: string) => {
    setToast(message); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 6000);
  }, []);
  const mergeState = useCallback((incoming: GameState) => {
    if (incoming.code !== stateRef.current.code || incoming.version >= stateRef.current.version) {
      stateRef.current = incoming; setState(incoming);
    }
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().toISOString()), 1000);
    return () => { clearInterval(timer); clearTimeout(toastTimer.current); };
  }, []);
  useEffect(() => {
    try {
      if (mode === 'demo') localStorage.setItem(DEMO_KEY, JSON.stringify(state));
      else if (session) sessionStorage.setItem('casefile.session', JSON.stringify({ ...session, state }));
    } catch { /* Storage restrictions never stop the investigation. */ }
  }, [state, mode, session]);
  useEffect(() => {
    if (mode !== 'live' || !session) return;
    const abort = new AbortController();
    void getSnapshot(session).then(s => { if (!abort.signal.aborted) mergeState(s); }).catch(e => { if (!abort.signal.aborted) notify(e.message); });
    void watchRoom(session, abort.signal, mergeState, setConnected);
    return () => abort.abort();
  }, [mode, session?.token, mergeState, notify]);

  async function act(input: Omit<Action, 'requestId'>) {
    if (inFlight.current) return false;
    if (stateRef.current.status !== 'investigating') { setDialog('result'); return false; }
    inFlight.current = true; setBusy(true);
    const before = stateRef.current;
    try {
      const action = { ...input, requestId: crypto.randomUUID() };
      const next = mode === 'live' && session ? await sendAction(session, action) : reduceDemo(before, action);
      mergeState(next);
      if (input.type === 'accuse') {
        if (next.status !== 'investigating') setDialog('result');
        else { setDialog(null); notify(`That theory doesn't hold up. ${3 - next.mistakes} ${next.mistakes === 2 ? 'attempt' : 'attempts'} remaining. Check both the suspect and your supporting exhibits.`); }
      }
      return true;
    } catch (e) { notify(e instanceof Error ? e.message : 'Something went wrong. Please try again.'); return false; }
    finally { inFlight.current = false; setBusy(false); }
  }
  function openExhibit(e: Evidence) { setExhibit(e); if (!state.discovered.includes(e.id) && state.status === 'investigating') void act({ type: 'inspect', target: e.id }); }
  function resetDemo() {
    const fresh = newDemo(); stateRef.current = fresh; setState(fresh); setSession(null); setMode('demo');
    try { sessionStorage.removeItem('casefile.session'); } catch { /* no-op */ }
    setTab('board'); setDialog(null); setExhibit(null); setSuspect(null); setProof([]); setAccused(''); notify('A fresh case is on your desk. Good luck, detective.');
  }
  async function roomSubmit(e: FormEvent) {
    e.preventDefault(); if (inFlight.current) return; inFlight.current = true; setBusy(true); setRoomError('');
    try {
      const next = roomTab === 'create' ? await createRoom(name.trim(), roomSeed === '' ? undefined : Number(roomSeed)) : await joinRoom(name.trim(), roomCode.trim().toUpperCase());
      stateRef.current = next.state; setState(next.state); setSession(next); setMode('live'); setDialog('briefing'); setTab('board'); setProof([]); setAccused('');
      notify(roomTab === 'create' ? `Room ${next.state.code} created. Share the code with your team.` : 'You joined the investigation.');
    } catch (e) { setRoomError(e instanceof Error ? e.message : 'Could not open the room.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function copyCode() {
    if (mode === 'demo') { setDialog('room'); return; }
    try { await navigator.clipboard.writeText(state.code); notify(`Room code ${state.code} copied. Send it to your team.`); }
    catch { notify(`Your room code is ${state.code}. Share it with your team.`); }
  }
  const completed = state.discovered.length + state.interviewed.length;
  const closed = state.status !== 'investigating';
  const fieldGuide = <><h2>Trust the evidence.<br /><em>Question everything.</em></h2><p className="modal-intro">A good detective builds a case, not a guess.</p><ol className="guide-steps"><li><span>01</span><div><h3>Examine the exhibits</h3><p>Open each card. Read the original records and compare timestamps, badge numbers, and locations.</p></div></li><li><span>02</span><div><h3>Hear their side</h3><p>Open the suspect dossiers and conduct interviews. A motive is interesting. A contradiction is better.</p></div></li><li><span>03</span><div><h3>Connect the dots</h3><p>Use Connect clues to draw links between exhibits. Keep your theories in Field notes.</p></div></li><li><span>04</span><div><h3>Make your case</h3><p>Choose a suspect and exactly two examined exhibits. You share three attempts with your team.</p></div></li></ol><div className="info-panel"><Users size={19} /><p><b>Better with a second pair of eyes.</b> Create a room when the game server is running, then share its code. The solo demo works right here.</p></div></>;

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => { setTab('board'); setSearch(''); }} aria-label="Casefile home"><div className="brand-mark"><Fingerprint size={26} /></div><div>CASEFILE<span>THE MIDNIGHT AGENCY</span></div></button>
      <div className="sidebar-section-label">YOUR WORKSPACE</div>
      <nav className="side-nav" aria-label="Investigation navigation">{tabs.map(t => <button className={tab === t.id ? 'active' : ''} key={t.id} onClick={() => { setTab(t.id); setSearch(''); }}><t.icon size={17} /><span>{t.title}</span>{t.id === 'notes' && state.notes.length > 0 && <span className="nav-count">{state.notes.length}</span>}{t.id === 'board' && <span className="nav-active-dot" />}</button>)}</nav>
      <div className="sidebar-case"><div className="sidebar-section-label">ON YOUR DESK <span>01</span></div><button className="active-case" onClick={() => setDialog('briefing')}><FolderOpen size={18} /><div>The Midnight Exchange<span>CASE MX-{state.caseFile.seed}</span></div><ChevronRight size={14} /></button></div>
      <div className="sidebar-bottom"><div className="agency-seal"><Fingerprint size={35} /><span>OBSERVE. CONNECT. SOLVE.</span></div><button onClick={() => setDialog('guide')}><BookOpen size={17} />The detective's field guide<ArrowRight size={15} /></button><div className="sidebar-footer"><span className="status-dot" />THE AGENCY NEVER SLEEPS<span>V.01</span></div></div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><FolderClosed size={16} /><span>Case files</span><ChevronRight size={14} /><b>The Midnight Exchange</b></div><div className="top-actions"><span className="night-label"><Moon size={14} /> NIGHT SHIFT</span><button className="icon-button" aria-label="How to play" onClick={() => setDialog('guide')}><CircleHelp size={19} /></button><div className="avatar-mini">{mode === 'live' ? state.players.find(p => p.id === session?.playerId)?.name.slice(0, 1).toUpperCase() : 'D'}</div></div></header>
      <main>
        <div className="case-heading"><div><div className="eyebrow case-eyebrow"><span>CASE MX-{state.caseFile.seed.toString().padStart(3, '0')}</span><span className={`status-pill ${closed ? 'closed-pill' : ''}`}><span className="live-dot" />{state.status === 'solved' ? 'CASE SOLVED' : state.status === 'cold' ? 'COLD CASE' : 'OPEN INVESTIGATION'}</span></div><h1>The Midnight <em>Exchange</em><span className="title-period">.</span></h1><p className="case-subtitle">Four suspects. Ninety seconds. One inconvenient truth.</p><div className="case-meta"><span><MapPin size={14} />{state.caseFile.location}</span><span><Clock3 size={14} />Incident at {state.caseFile.incidentTime}</span><button onClick={() => setDialog('briefing')}>Read the briefing<ArrowRight size={13} /></button></div></div><div className="heading-actions"><button className="secondary-button room-button" onClick={() => { setRoomError(''); setDialog('room'); }}><Users size={16} />{mode === 'demo' ? 'Play with friends' : 'Manage room'}<ChevronDown size={13} /></button><div className="session-label"><span className={`status-dot ${mode === 'live' && !connected ? 'offline' : ''}`} />{mode === 'demo' ? 'SOLO DEMO · NO SIGN-UP' : connected ? 'TEAM CONNECTED' : 'RECONNECTING TO ROOM'}</div></div></div>

        <div className="investigation-bar"><div className="progress-section"><span className="progress-icon"><Search size={19} /></span><div><div className="progress-title">{closed ? 'Investigation complete' : 'The truth is in the details.'}<span>{completed}/10 leads examined</span></div><div className="progress-track"><span style={{ width: `${completed * 10}%` }} /></div></div></div><div className="investigation-stats"><div><span className="stat-label">TIME ON CASE</span><span className="timer">{elapsed(state.startedAt, state.finishedAt ?? now)}</span></div><span className="stat-divider" /><button className="team-indicator" onClick={() => void copyCode()} aria-label={mode === 'demo' ? 'Create a team room' : 'Copy room code'}><span className="team-avatars">{state.players.slice(0, 3).map((p, i) => <span key={p.id} style={{ zIndex: 3 - i }}>{p.name.slice(0, 1).toUpperCase()}</span>)}</span><span>{mode === 'demo' ? 'Just you, detective' : `${state.players.length} detective${state.players.length === 1 ? '' : 's'} · ${state.code}`}</span>{mode === 'live' && <Copy size={12} />}</button></div></div>

        <div className="workspace-tabs"><div role="tablist" aria-label="Case workspace">{tabs.map(t => <button role="tab" aria-selected={tab === t.id} key={t.id} onClick={() => { setTab(t.id); setSearch(''); }}><t.icon size={15} />{t.title}{t.id === 'suspects' && <span>04</span>}{t.id === 'notes' && state.notes.length > 0 && <span>{state.notes.length}</span>}</button>)}</div><button className="briefing-link" onClick={() => setDialog('guide')}><Sparkles size={14} /> A little detective intuition</button></div>

        {tab === 'board' && <Board state={state} open={openExhibit} notify={notify} connect={(a, b) => { if (!busy) void act({ type: 'connect', target: a, other: b }); }} />}
        {tab === 'suspects' && <section className="suspects-panel"><div className="panel-heading"><div><span className="eyebrow">PEOPLE OF INTEREST</span><h2>Everyone has a story.</h2><p>Listen carefully. Then see if the evidence agrees.</p></div><span className="count-badge">{state.interviewed.length}/4 INTERVIEWED</span></div><div className="suspect-grid">{state.caseFile.suspects.map(s => <button className="suspect-card" key={s.id} onClick={() => setSuspect(s)}><div className="portrait-wrap"><Portrait suspect={s} large /><span className="dossier-number">DOSSIER / {s.badge}</span>{state.interviewed.includes(s.id) && <span className="interviewed-badge"><Check size={12} /> INTERVIEWED</span>}</div><div className="suspect-card-text"><span className="eyebrow">{s.role}</span><h3>{s.name}</h3><p>“{s.quote}”</p><span className="text-link">Open dossier<ArrowRight size={15} /></span></div></button>)}</div></section>}
        {tab === 'timeline' && <section className="activity-panel"><div className="panel-heading"><div><span className="eyebrow">THE INVESTIGATION, AS IT HAPPENS</span><h2>Leave a paper trail.</h2><p>Every discovery brings the picture into focus.</p></div><label className="search-field"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search activity…" aria-label="Search investigation activity" /></label></div>{state.timeline.length === 0 ? <div className="empty-state"><Clock3 size={35} /><h3>A clean slate.</h3><p>Examine your first exhibit to start the investigation log.</p><button className="secondary-button" onClick={() => setTab('board')}>Go to evidence board<ArrowRight size={15} /></button></div> : <div className="timeline">{[...state.timeline].reverse().filter(e => `${e.actor} ${e.text}`.toLowerCase().includes(search.toLowerCase())).map(e => <div className="timeline-event" key={e.id}><span className={`timeline-symbol ${e.kind}`}>{e.kind === 'solved' ? <ShieldCheck size={16} /> : e.kind === 'interview' ? <MessageSquare size={16} /> : <Search size={16} />}</span><div><b>{e.actor}</b><p>{e.text}</p></div><time>{prettyTime(e.at)}</time></div>)}{search && !state.timeline.some(e => `${e.actor} ${e.text}`.toLowerCase().includes(search.toLowerCase())) && <p className="no-results">No activity matches “{search}”.</p>}</div>}</section>}
        {tab === 'notes' && <section className="notes-panel"><div className="panel-heading"><div><span className="eyebrow">THINK OUT LOUD</span><h2>A hunch starts here.</h2><p>{mode === 'live' ? 'Your team can see these notes as you add them.' : 'Your theories stay saved with this investigation.'}</p></div><StickyNote size={26} /></div><form className="note-form" onSubmit={e => { e.preventDefault(); void act({ type: 'note', note }).then(ok => { if (ok) setNote(''); }); }}><label htmlFor="field-note">Add a field note</label><textarea id="field-note" value={note} onChange={e => setNote(e.target.value)} placeholder="The badge record puts someone in the archive, but can I prove who was holding it?" maxLength={500} rows={3} disabled={closed} /><div><span>{note.length}/500</span><button className="primary-button" disabled={busy || !note.trim() || closed}><Plus size={15} />Pin note</button></div></form><div className="note-grid">{state.notes.map(n => <article className="field-note" key={n.id}><span className="note-tape" /><p>{n.text}</p><div><span>{n.author}</span><time>{prettyTime(n.at)}</time></div></article>)}</div>{state.notes.length === 0 && <p className="notes-empty">No theories yet. That's where every good mystery begins.</p>}</section>}

        <div className="case-bottom-bar"><div className="case-bottom-hint"><Fingerprint size={26} /><div><b>{closed ? 'Every case leaves a mark.' : 'A theory is good. Proof is better.'}</b><span>{closed ? 'Review the evidence, or open a new investigation.' : 'Question the suspects. Find two exhibits that tell the same story.'}</span></div></div><button className="primary-button accuse-button" onClick={() => { setProof([]); setAccused(''); setDialog(closed ? 'result' : 'accuse'); }}><Target size={17} />{closed ? 'View case report' : 'Make an accusation'}<ArrowRight size={15} /></button></div>
        <footer className="main-footer"><span>THE MIDNIGHT AGENCY<span className="footer-dot">·</span>FICTIONAL CASES. REAL DETECTIVE WORK.</span><button onClick={() => setDialog('guide')}>Need a lead?<ArrowDownLeft size={13} /></button></footer>
      </main>
    </div>

    {exhibit && <Modal title="Evidence examination" close={() => setExhibit(null)} wide><div className="exhibit-detail"><div className="detail-art"><ExhibitArt evidence={exhibit} /><span className="evidence-stamp">{state.discovered.includes(exhibit.id) ? 'EXAMINED' : 'ARCHIVED'}</span></div><div><span className="eyebrow">{exhibit.label}</span><h2>{exhibit.title}</h2><div className="detail-meta"><Clock3 size={14} />{exhibit.timestamp} HRS<span>·</span>{exhibit.source}</div><p className="evidence-body">{exhibit.body}</p><button className="secondary-button" onClick={() => setExhibit(null)}><Check size={15} />Back to the board</button></div></div></Modal>}
    {suspect && <Modal title="Suspect dossier" close={() => setSuspect(null)} wide><div className="suspect-detail"><div><Portrait suspect={suspect} large /><div className="suspect-id">PERSON OF INTEREST / {suspect.badge}</div><div className="suspect-facts"><div><span>ACCESS BADGE</span><b>{suspect.badge}</b></div><div><span>ASSIGNED LOCKER</span><b>{suspect.locker}</b></div></div></div><div><span className="eyebrow">{suspect.role}</span><h2>{suspect.name}</h2><blockquote>“{suspect.quote}”</blockquote><span className="eyebrow">POSSIBLE MOTIVE</span><p className="suspect-motive">{suspect.motive}</p><div className="interview-box"><span className="eyebrow"><AudioLines size={14} />INTERVIEW TRANSCRIPT</span>{state.statements[suspect.id] ? <p>“{state.statements[suspect.id]}”</p> : <><p>Every alibi deserves a closer look. Hear their account of the night.</p><button className="primary-button" disabled={busy || closed} onClick={() => void act({ type: 'interview', target: suspect.id })}>{busy ? <LoaderCircle className="spin" size={16} /> : <MessageSquare size={16} />}Conduct interview</button></>}</div></div></div></Modal>}
    {dialog === 'briefing' && <Modal title="Case briefing" close={closeDialog}><span className="eyebrow amber-text">CASE MX-{state.caseFile.seed} / MERIDIAN MUSEUM</span><h2>The Midnight<br /><em>Exchange.</em></h2><p className="briefing-text">{state.caseFile.briefing}</p><div className="briefing-numbers"><div><b>04</b><span>SUSPECTS</span></div><div><b>06</b><span>EXHIBITS</span></div><div><b>03</b><span>ATTEMPTS</span></div></div><button className="primary-button full-width" onClick={closeDialog}>Let's find the truth<ArrowRight size={16} /></button></Modal>}
    {dialog === 'guide' && <Modal title="Field guide" close={closeDialog}>{fieldGuide}</Modal>}
    {dialog === 'room' && <Modal title="Your next investigation" close={closeDialog}><h2>Some mysteries<br /><em>need company.</em></h2><p className="modal-intro">Bring up to eight detectives into the same case.</p>{mode === 'live' && <div className="room-current"><div><span className="eyebrow">YOUR CURRENT ROOM</span><b>{state.code}</b><span>{state.players.map(p => p.name).join(', ')}</span></div><button className="secondary-button" onClick={() => void copyCode()}><Copy size={15} />Copy code</button></div>}<div className="segmented"><button className={roomTab === 'create' ? 'selected' : ''} onClick={() => { setRoomTab('create'); setRoomError(''); }}>Create a room</button><button className={roomTab === 'join' ? 'selected' : ''} onClick={() => { setRoomTab('join'); setRoomError(''); }}>Join a room</button></div><form className="room-form" onSubmit={e => void roomSubmit(e)}><label htmlFor="detective-name">Detective name</label><input id="detective-name" required maxLength={24} value={name} onChange={e => setName(e.target.value)} placeholder="What should we call you?" />{roomTab === 'join' ? <><label htmlFor="room-code">Six-letter room code</label><input id="room-code" className="code-input" required minLength={6} maxLength={6} pattern="[A-Za-z]{6}" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} placeholder="ABCDEF" /></> : <><label htmlFor="case-seed">Case seed <span>(optional)</span></label><input id="case-seed" type="number" min={0} max={2147483647} value={roomSeed} onChange={e => setRoomSeed(e.target.value)} placeholder="Random case variant" /></>}{roomError && <p className="form-error" role="alert">{roomError}</p>}<button className="primary-button full-width" disabled={busy || !name.trim()}>{busy ? <LoaderCircle className="spin" size={16} /> : <Users size={16} />}{roomTab === 'create' ? 'Open an investigation' : 'Join the investigation'}<ArrowRight size={16} /></button></form><div className="solo-option"><span>Prefer to work alone?</span><button onClick={resetDemo}><RotateCcw size={14} />Start a fresh solo demo</button></div><p className="server-note"><Radio size={13} />Team play requires the running game server. Solo play works in your browser.</p></Modal>}
    {dialog === 'accuse' && <Modal title="Submit your theory" close={closeDialog}><span className="eyebrow amber-text">{3 - state.mistakes} ATTEMPTS REMAINING · SHARED WITH YOUR TEAM</span><h2>Who made<br /><em>the exchange?</em></h2><p className="modal-intro">Choose a suspect you've interviewed and two exhibits you've examined. Both the person and the proof must be right.</p><form onSubmit={e => { e.preventDefault(); void act({ type: 'accuse', target: accused, evidenceIds: proof }); }}><fieldset className="accuse-suspects"><legend>01 / YOUR SUSPECT</legend>{state.caseFile.suspects.map(s => <label className={accused === s.id ? 'chosen' : ''} key={s.id}><input type="radio" name="culprit" value={s.id} checked={accused === s.id} disabled={!state.interviewed.includes(s.id)} onChange={() => setAccused(s.id)} /><span><b>{s.name}</b><small>{state.interviewed.includes(s.id) ? s.role : 'Interview required'}</small></span><Fingerprint size={18} /></label>)}</fieldset><fieldset className="proof-options"><legend>02 / TWO SUPPORTING EXHIBITS ({proof.length}/2)</legend>{state.caseFile.evidence.map(e => <label key={e.id} className={proof.includes(e.id) ? 'chosen' : ''}><input type="checkbox" checked={proof.includes(e.id)} disabled={!state.discovered.includes(e.id) || (proof.length === 2 && !proof.includes(e.id))} onChange={() => setProof(p => p.includes(e.id) ? p.filter(id => id !== e.id) : [...p, e.id])} /><span>{e.title}<small>{state.discovered.includes(e.id) ? e.label : 'Examine this exhibit first'}</small></span></label>)}</fieldset><button className="primary-button full-width" disabled={busy || !accused || proof.length !== 2}>{busy ? <LoaderCircle className="spin" size={16} /> : <Target size={16} />}Submit accusation<ArrowRight size={16} /></button></form></Modal>}
    {dialog === 'result' && <Modal title="Case report" close={closeDialog}><div className={`result-seal ${state.status === 'solved' ? '' : 'cold-seal'}`}><ShieldCheck size={38} /></div><span className="eyebrow amber-text">CASE MX-{state.caseFile.seed} / {state.status === 'solved' ? 'CLOSED' : 'UNRESOLVED'}</span><h2>{state.status === 'solved' ? <>The truth<br /><em>always surfaces.</em></> : <>Every detective<br /><em>has a cold case.</em></>}</h2><p className="result-explanation">{state.explanation ?? 'The investigation is still in progress. Examine the evidence and question your suspects.'}</p><div className="briefing-numbers"><div><b>{elapsed(state.startedAt, state.finishedAt ?? now)}</b><span>CASE TIME</span></div><div><b>{state.discovered.length}/6</b><span>EXAMINED</span></div><div><b>{state.mistakes}</b><span>FALSE LEADS</span></div></div><button className="primary-button full-width" onClick={resetDemo}><RotateCcw size={16} />Open a fresh solo case</button><button className="text-button full-width" onClick={closeDialog}>Review the investigation<ArrowRight size={15} /></button></Modal>}
    {toast && <div className="toast" role="status"><Clipboard size={17} /><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15} /></button></div>}
    {busy && <div className="saving-indicator" role="status"><LoaderCircle size={13} className="spin" />Updating case…</div>}
  </div>;
}
