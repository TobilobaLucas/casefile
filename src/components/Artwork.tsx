import type { Evidence, Suspect } from '../game/types';

export function Portrait({ suspect, large = false }: { suspect: Suspect; large?: boolean }) {
  const female = ['mara', 'june'].includes(suspect.id);
  const glasses = suspect.id === 'june';
  return <svg className={`portrait ${large ? 'portrait-large' : ''}`} viewBox="0 0 160 184" role="img" aria-label={`Illustrated dossier portrait of ${suspect.name}`}>
    <defs><pattern id={`lines-${suspect.id}`} width="160" height="24" patternUnits="userSpaceOnUse"><path d="M0 23h160" stroke="#283b34" strokeOpacity=".25" /></pattern></defs>
    <rect width="160" height="184" fill={suspect.color} /><rect width="160" height="184" fill={`url(#lines-${suspect.id})`} />
    <path d="M14 184q1-53 44-59h44q43 6 44 59" fill="#293733" />
    <path d="m57 126 23 42 23-42-11-8H68" fill="#d0bc9f" />
    <path d="m58 127 22 40-25-9-10-22m57-9-22 40 25-9 10-22" fill="#364740" />
    {female && <path d="M43 112V60q0-41 37-41t37 41v65l-21-3H55z" fill="#26322b" />}
    <ellipse cx="80" cy="74" rx="30" ry="40" fill="#c5ab8c" />
    <path d="M80 73v17l9 1" fill="none" stroke="#826e58" strokeWidth="2" />
    <path d="M62 69h11m15 0h11" stroke="#384139" strokeWidth="3" />
    <path d="M70 100q10 5 20-1" fill="none" stroke="#715b47" strokeWidth="2" />
    {female ? <path d="M47 71q-5-47 32-49 37 1 35 50-14-12-23-30-9 23-44 29" fill="#26322b" /> : <path d="M49 61q-2-37 29-39 36-2 34 36-26-15-38-11L49 68z" fill="#28322c" />}
    {suspect.id === 'elias' && <path d="M57 93q4 27 23 26 22-3 25-26l-12 8-12 2-11-3z" fill="#3d4234" opacity=".8" />}
    {glasses && <g fill="none" stroke="#3a4138" strokeWidth="2.5"><rect x="55" y="62" width="23" height="17" rx="5" /><rect x="83" y="62" width="23" height="17" rx="5" /><path d="M78 69h5" /></g>}
    <rect x="39" y="148" width="82" height="27" fill="#1b2621" stroke="#91a398" strokeWidth=".5" />
    <text x="80" y="166" textAnchor="middle" fill="#cbd1bd" fontSize="10" fontFamily="monospace" letterSpacing="2">{suspect.badge}</text>
    <rect width="160" height="184" fill="#24362b" opacity=".08" />
  </svg>;
}

function Corridor() {
  return <svg viewBox="0 0 260 164" aria-label="Security camera image of an empty museum corridor" role="img">
    <defs><linearGradient id="corridor" x2="0" y2="1"><stop stopColor="#293935" /><stop offset="1" stopColor="#74877a" /></linearGradient><pattern id="scan" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M0 1h3" stroke="#0e1c18" strokeOpacity=".25" /></pattern></defs>
    <rect width="260" height="164" fill="url(#corridor)" />
    <path d="M0 0 99 48h62L260 0M0 164l99-58h62l99 58" stroke="#9aa99b" strokeWidth="2" fill="none" />
    <path d="M99 48v58m62-58v58M0 68l99 1m62 0 99-1M0 123l99-29m62 0 99 29" stroke="#112720" fill="none" />
    <path d="M14 25 49 38v83l-35 22zm56 22 17 6v52l-17 10z" fill="#1b2d27" stroke="#7a8e7f" />
    <path d="m211 38 35-13v118l-35-22zm-38 15 17-6v68l-17-10z" fill="#1b2d27" stroke="#7a8e7f" />
    <path d="M109 56h42v50h-42z" fill="#182c24" /><path d="M114 59h32v43h-32z" fill="#536b58" />
    <path d="m110 16 12 28h16l12-28z" fill="#c9d5bb" opacity=".45" /><path d="M107 14h46" stroke="#d3dbc0" strokeWidth="4" />
    <path d="m55 164 59-58m90 58-58-58M0 143h260M67 123h126" stroke="#263b30" />
    <rect width="260" height="164" fill="url(#scan)" />
    <text x="10" y="16" fill="#dae4cc" fontSize="8" fontFamily="monospace">CAM 04 / EAST CORRIDOR</text>
    <circle cx="232" cy="13" r="3" fill="#cf7e67" /><text x="10" y="152" fill="#dae4cc" fontSize="8" fontFamily="monospace">21:10:00 · SIGNAL LOST</text>
  </svg>;
}

function FloorPlan() {
  return <svg viewBox="0 0 260 164" aria-label="Museum floor plan showing the archive, service corridor, cloakroom and closed east gallery" role="img">
    <defs><pattern id="graph" width="13" height="13" patternUnits="userSpaceOnUse"><path d="M13 0H0v13" fill="none" stroke="#889a8a" strokeWidth=".3" opacity=".4" /></pattern></defs>
    <rect width="260" height="164" fill="#d6dbc4" /><rect width="260" height="164" fill="url(#graph)" />
    <g stroke="#526b5b" strokeWidth="3" fill="none"><path d="M24 22h86v57H24zm111 0h100v57H135zM24 106h86v37H24zm111 0h100v37H135z" /><path d="M75 79v27m87-27v27M110 48h25" strokeDasharray="4 3" /></g>
    <g fill="#3c5749" fontFamily="monospace" fontSize="8" textAnchor="middle"><text x="67" y="48">ARCHIVE A</text><text x="185" y="48">EAST GALLERY</text><text x="185" y="62" fontSize="6">CLOSED 20:45</text><text x="67" y="127">CLOAKROOM</text><text x="185" y="127">MAIN ATRIUM</text><text x="131" y="95" fontSize="7">SERVICE CORRIDOR</text></g>
    <path d="M69 57v59" stroke="#a05541" strokeWidth="2" strokeDasharray="5 3" /><circle cx="69" cy="57" r="5" fill="none" stroke="#a05541" strokeWidth="2" /><path d="m64 112 5 5 5-5" stroke="#a05541" fill="none" strokeWidth="2" />
    <path d="M243 151v-13m-4 5 4-5 4 5" stroke="#526b5b" fill="none" /><text x="241" y="160" fontSize="7" fill="#526b5b">N</text>
  </svg>;
}

export function ExhibitArt({ evidence }: { evidence: Evidence }) {
  if (evidence.kind === 'photo') return <div className="exhibit-art photo-art"><Corridor /></div>;
  if (evidence.kind === 'map') return <div className="exhibit-art map-art"><FloorPlan /></div>;
  if (evidence.kind === 'log') return <div className="exhibit-art log-art"><span className="terminal-heading">MERIDIAN / ACCESS CONTROL</span><div><span>21:07:51</span> EMERGENCY ON</div><div className="highlight-log"><span>21:08:14</span> {evidence.body.match(/badge ([A-Z]-\d+)/)?.[1]} · GRANTED</div><div><span>21:10:00</span> CAMERA OFFLINE</div><div><span>21:11:30</span> GRID RESTORED</div><span className="terminal-footer">EXPORT COMPLETE_</span></div>;
  if (evidence.kind === 'receipt') return <div className="exhibit-art receipt-art"><div className="receipt-brand">MERIDIAN<br /><small>CLOAKROOM · TRANSFER RECORD</small></div><div className="receipt-rule" /><div className="receipt-row"><span>ITEM</span><b>ASTER / 001</b></div><div className="receipt-row"><span>LOCKER</span><b>{evidence.body.match(/locker (\d+)/)?.[1]}</b></div><div className="receipt-row"><span>RECEIVED</span><b>21:09</b></div><span className="receipt-stamp">RECEIVED</span></div>;
  if (evidence.kind === 'audio') return <div className="exhibit-art audio-art"><div className="waveform" aria-hidden="true">{Array.from({ length: 45 }, (_, i) => <i key={i} style={{ height: `${12 + ((i * 17 + 11) % 43)}px` }} />)}</div><div className="audio-label">VOICEMAIL TRANSCRIPT <span>00:18</span></div><p>“We only need a minute<br />and a half.”</p></div>;
  return <div className="exhibit-art note-art"><span>From the curator's desk</span><p>Before you ask<br />who wanted it,<br /><em>ask who could<br />actually move it.</em></p><span className="note-signature">— unsigned</span></div>;
}
