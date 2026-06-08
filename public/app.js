// ── Persistent preferences ──────────────────────────────────────────────────
const prefs = {
  get volume()  { return parseFloat(localStorage.getItem('lt:volume')  ?? '1'); },
  get muted()   { return localStorage.getItem('lt:muted') === '1'; },
  get speed()   { return parseFloat(localStorage.getItem('lt:speed')   ?? '1'); },
  set volume(v) { localStorage.setItem('lt:volume', v); },
  set muted(v)  { localStorage.setItem('lt:muted', v ? '1' : '0'); },
  set speed(v)  { localStorage.setItem('lt:speed', v); }
};

const RING_CIRC = 2 * Math.PI * 52; // r=52

// ── App state ───────────────────────────────────────────────────────────────
const state = {
  library: null,
  query: '',
  filter: 'all',
  expandedIds: new Set(),
  selectedVideo: null,
  selectedCourseId: null,
  pendingAutoplay: false,
  isSeeking: false,
  progressSave: Promise.resolve(),
  lastPointerSelectionAt: 0,
  lastSurfaceToggleAt: 0,
  controlsHideTimer: null,
  browse: null,
  sourceConfirmedLarge: false,
  suppressSave: false,
  stats: null,
  view: 'dashboard',
  activeSince: null,
  activityTimer: null,
  dirHandle: null,
  rootName: '',
  pendingHandle: null,
  currentObjectURL: null,
  pendingResume: 0,
  notes: [],
  transcript: [],
  transcriptQuery: '',
  captionsUrl: null,
  transcriptToken: 0,
  activeCueIndex: -1,
  captionsOn: localStorage.getItem('lt:cc') !== '0',
  cards: [],
  allCards: [],
  review: null
};

// ── DOM refs ────────────────────────────────────────────────────────────────
const el = {
  app:              document.querySelector('#app'),
  sourceRoot:       document.querySelector('#sourceRoot'),
  refreshButton:    document.querySelector('#refreshButton'),
  searchInput:      document.querySelector('#searchInput'),
  filterChips:      document.querySelector('#filterChips'),
  courseList:       document.querySelector('#courseList'),
  ringFill:         document.querySelector('#ringFill'),
  heroPercent:      document.querySelector('#heroPercent'),
  statCourses:      document.querySelector('#statCourses'),
  statProgress:     document.querySelector('#statProgress'),
  statDone:         document.querySelector('#statDone'),
  player:           document.querySelector('#player'),
  videoFrame:       document.querySelector('#videoFrame'),
  audioStage:       document.querySelector('#audioStage'),
  audioTitle:       document.querySelector('#audioTitle'),
  pdfStage:         document.querySelector('#pdfStage'),
  pdfFrame:         document.querySelector('#pdfFrame'),
  pdfComplete:      document.querySelector('#pdfComplete'),
  pdfOpen:          document.querySelector('#pdfOpen'),
  playerEmpty:      document.querySelector('#playerEmpty'),
  playerStage:      document.querySelector('#playerStage'),
  breadcrumb:       document.querySelector('#breadcrumb'),
  videoTitle:       document.querySelector('#videoTitle'),
  videoStats:       document.querySelector('#videoStats'),
  currentTime:      document.querySelector('#currentTime'),
  durationTime:     document.querySelector('#durationTime'),
  seekSlider:       document.querySelector('#seekSlider'),
  seekFill:         document.querySelector('#seekFill'),
  seekBuffer:       document.querySelector('#seekBuffer'),
  seekTooltip:      document.querySelector('#seekTooltip'),
  seekTrack:        document.querySelector('#seekTrack'),
  playToggle:       document.querySelector('#playToggle'),
  prevButton:       document.querySelector('#prevButton'),
  nextButton:       document.querySelector('#nextButton'),
  skipBack:         document.querySelector('#skipBackButton'),
  skipForward:      document.querySelector('#skipForwardButton'),
  muteToggle:       document.querySelector('#muteToggle'),
  volumeSlider:     document.querySelector('#volumeSlider'),
  speedSelect:      document.querySelector('#speedSelect'),
  pipButton:        document.querySelector('#pipButton'),
  fullscreenButton: document.querySelector('#fullscreenButton'),
  shortcutsButton:  document.querySelector('#shortcutsButton'),
  shortcutsModal:   document.querySelector('#shortcutsModal'),
  shortcutsClose:   document.querySelector('#shortcutsClose'),
  toastContainer:   document.querySelector('#toastContainer'),
  controlsOverlay:  document.querySelector('#controlsOverlay'),
  sidebarToggle:    document.querySelector('#sidebarToggle'),
  sidebarShow:      document.querySelector('#sidebarShow'),
  resizeHandle:     document.querySelector('#resizeHandle'),
  themeToggle:      document.querySelector('#themeToggle'),
  resetLesson:      document.querySelector('#resetLesson'),
  resetAll:         document.querySelector('#resetAll'),
  confirmModal:     document.querySelector('#confirmModal'),
  confirmTitle:     document.querySelector('#confirmTitle'),
  confirmBody:      document.querySelector('#confirmBody'),
  confirmOk:        document.querySelector('#confirmOk'),
  confirmCancel:    document.querySelector('#confirmCancel'),
  // Dashboard
  homeButton:       document.querySelector('#homeButton'),
  playerWorkspace:  document.querySelector('.player-workspace'),
  dashboard:        document.querySelector('#dashboard'),
  dashGreeting:     document.querySelector('#dashGreeting'),
  statTiles:        document.querySelector('#statTiles'),
  continueSection:  document.querySelector('#continueSection'),
  continueRow:      document.querySelector('#continueRow'),
  goalsList:        document.querySelector('#goalsList'),
  addGoalBtn:       document.querySelector('#addGoalBtn'),
  heatmap:          document.querySelector('#heatmap'),
  activitySub:      document.querySelector('#activitySub'),
  badges:           document.querySelector('#badges'),
  // Goal modal
  goalModal:        document.querySelector('#goalModal'),
  goalClose:        document.querySelector('#goalClose'),
  goalTitle:        document.querySelector('#goalTitle'),
  goalCourses:      document.querySelector('#goalCourses'),
  goalDate:         document.querySelector('#goalDate'),
  goalMinutes:      document.querySelector('#goalMinutes'),
  goalHint:         document.querySelector('#goalHint'),
  goalSave:         document.querySelector('#goalSave'),
  appShell:         document.querySelector('#app'),
  gate:             document.querySelector('#gate'),
  gateCard:         document.querySelector('#gateCard'),
  // Notes
  notesToggle:      document.querySelector('#notesToggle'),
  notesBadge:       document.querySelector('#notesBadge'),
  notesDrawer:      document.querySelector('#notesDrawer'),
  notesClose:       document.querySelector('#notesClose'),
  notesExport:      document.querySelector('#notesExport'),
  noteInput:        document.querySelector('#noteInput'),
  noteAt:           document.querySelector('#noteAt'),
  noteBookmark:     document.querySelector('#noteBookmark'),
  noteAdd:          document.querySelector('#noteAdd'),
  notesList:        document.querySelector('#notesList'),
  // Transcript
  transcriptToggle: document.querySelector('#transcriptToggle'),
  transcriptDrawer: document.querySelector('#transcriptDrawer'),
  transcriptClose:  document.querySelector('#transcriptClose'),
  transcriptSearch: document.querySelector('#transcriptSearch'),
  transcriptList:   document.querySelector('#transcriptList'),
  ccButton:         document.querySelector('#ccButton'),
  // Flashcards
  cardsToggle:      document.querySelector('#cardsToggle'),
  cardsBadge:       document.querySelector('#cardsBadge'),
  cardsDrawer:      document.querySelector('#cardsDrawer'),
  cardsClose:       document.querySelector('#cardsClose'),
  cardsReviewLesson: document.querySelector('#cardsReviewLesson'),
  cardFront:        document.querySelector('#cardFront'),
  cardBack:         document.querySelector('#cardBack'),
  cardLinkTime:     document.querySelector('#cardLinkTime'),
  cardAt:           document.querySelector('#cardAt'),
  cardAdd:          document.querySelector('#cardAdd'),
  cardsList:        document.querySelector('#cardsList'),
  // Review modal
  reviewModal:      document.querySelector('#reviewModal'),
  reviewProgress:   document.querySelector('#reviewProgress'),
  reviewClose:      document.querySelector('#reviewClose'),
  reviewContext:    document.querySelector('#reviewContext'),
  reviewFront:      document.querySelector('#reviewFront'),
  reviewDivider:    document.querySelector('#reviewDivider'),
  reviewBack:       document.querySelector('#reviewBack'),
  reviewShow:       document.querySelector('#reviewShow'),
  reviewGrades:     document.querySelector('#reviewGrades'),
  reviewBody:       document.querySelector('.review-card .review-body'),
  // Dashboard flashcards
  flashSection:     document.querySelector('#flashSection'),
  flashSub:         document.querySelector('#flashSub'),
  flashCta:         document.querySelector('#flashCta'),
  // Settings
  settingsButton:   document.querySelector('#settingsButton'),
  settingsModal:    document.querySelector('#settingsModal'),
  settingsClose:    document.querySelector('#settingsClose'),
  aiProvider:       document.querySelector('#aiProvider'),
  aiKey:            document.querySelector('#aiKey'),
  aiKeyShow:        document.querySelector('#aiKeyShow'),
  aiKeyHint:        document.querySelector('#aiKeyHint'),
  aiModel:          document.querySelector('#aiModel'),
  autoQuizToggle:   document.querySelector('#autoQuizToggle'),
  settingsSave:     document.querySelector('#settingsSave'),
  exportBtn:        document.querySelector('#exportBtn'),
  importBtn:        document.querySelector('#importBtn'),
  importFile:      document.querySelector('#importFile'),
  // Quiz
  quizButton:       document.querySelector('#quizButton'),
  quizModal:        document.querySelector('#quizModal'),
  quizProgress:     document.querySelector('#quizProgress'),
  quizClose:        document.querySelector('#quizClose'),
  quizBody:         document.querySelector('#quizBody')
};

// ── Boot ────────────────────────────────────────────────────────────────────
// Defer to a microtask so the whole module (incl. the consts below) is fully
// initialised before init() runs — otherwise the early data-layer access hits
// the temporal dead zone.
queueMicrotask(init);

async function init() {
  applyPrefs();
  bindEvents();
  initResize();
  await loadServerLibrary();
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA LAYER
// The server hosts the course files (listed via /api/library, streamed via
// /api/file). Each browser stores its own tracking data in IndexedDB, so every
// visitor keeps separate progress without any account or central database.
// ═══════════════════════════════════════════════════════════════════════════

// ── IndexedDB ─────────────────────────────────────────────────────────────────
const DB_NAME = 'learning-tracker';
const DB_VERSION = 4;
const STORES = ['progress', 'durations', 'activity', 'goals', 'achievements', 'handles', 'meta', 'notes', 'cards', 'quizzes'];
let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const idb = req.result;
      for (const s of STORES) if (!idb.objectStoreNames.contains(s)) idb.createObjectStore(s);
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  return _dbPromise;
}
function idbGet(store, key) {
  return openDB().then((idb) => new Promise((res, rej) => {
    const r = idb.transaction(store, 'readonly').objectStore(store).get(key);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
}
function idbPut(store, key, val) {
  return openDB().then((idb) => new Promise((res, rej) => {
    const tx = idb.transaction(store, 'readwrite');
    tx.objectStore(store).put(val, key);
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
  }));
}
function idbDelete(store, key) {
  return openDB().then((idb) => new Promise((res, rej) => {
    const tx = idb.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
  }));
}
function idbClear(store) {
  return openDB().then((idb) => new Promise((res, rej) => {
    const tx = idb.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
  }));
}
function idbEntries(store) {
  return openDB().then((idb) => new Promise((res, rej) => {
    const out = [];
    const cur = idb.transaction(store, 'readonly').objectStore(store).openCursor();
    cur.onsuccess = () => { const c = cur.result; if (c) { out.push({ key: c.key, value: c.value }); c.continue(); } else res(out); };
    cur.onerror = () => rej(cur.error);
  }));
}

const db = {
  async getProgressMap() { const e = await idbEntries('progress'); const m = {}; for (const { key, value } of e) m[key] = value; return m; },
  saveProgress(id, rec) { return idbPut('progress', id, rec); },
  async deleteProgress(ids) { for (const id of ids) await idbDelete('progress', id); },
  async resetProgress(idsOrAll) { if (idsOrAll === 'all') await idbClear('progress'); else await this.deleteProgress(idsOrAll); },
  async getDurations() { const e = await idbEntries('durations'); const m = {}; for (const { key, value } of e) m[key] = value; return m; },
  saveDuration(id, sec) { return idbPut('durations', id, sec); },
  async getActivity() {
    const e = await idbEntries('activity');
    return e.map(({ key, value }) => ({ day: key, watchSeconds: value.watchSeconds || 0, completedCount: value.completedCount || 0 }))
            .sort((a, b) => (a.day < b.day ? -1 : 1));
  },
  async recordActivity(day, seconds, completed) {
    const cur = (await idbGet('activity', day)) || { watchSeconds: 0, completedCount: 0 };
    cur.watchSeconds = (cur.watchSeconds || 0) + seconds;
    cur.completedCount = (cur.completedCount || 0) + completed;
    return idbPut('activity', day, cur);
  },
  async getGoals() { const e = await idbEntries('goals'); return e.map(({ value }) => value).sort((a, b) => ((a.createdAt || '') < (b.createdAt || '') ? -1 : 1)); },
  saveGoal(goal) { return idbPut('goals', goal.id, goal); },
  deleteGoal(id) { return idbDelete('goals', id); },
  async getAchievements() { const e = await idbEntries('achievements'); return e.map(({ key, value }) => ({ id: key, earnedAt: value.earnedAt })); },
  async saveAchievements(ids) { const now = new Date().toISOString(); for (const id of ids) await idbPut('achievements', id, { earnedAt: now }); },
  getHandle() { return idbGet('handles', 'root'); },
  saveHandle(h) { return idbPut('handles', 'root', h); },
  async getNotes(videoId) { return (await idbGet('notes', videoId)) || []; },
  saveNotes(videoId, arr) { return arr.length ? idbPut('notes', videoId, arr) : idbDelete('notes', videoId); },
  async getAllNotes() { const e = await idbEntries('notes'); const m = {}; for (const { key, value } of e) m[key] = value; return m; },
  async getAllCards() { const e = await idbEntries('cards'); return e.map(({ value }) => value); },
  saveCard(card) { return idbPut('cards', card.id, card); },
  deleteCard(id) { return idbDelete('cards', id); },
  getQuiz(videoId) { return idbGet('quizzes', videoId); },
  saveQuiz(videoId, questions) { return idbPut('quizzes', videoId, { questions, generatedAt: new Date().toISOString() }); }
};

async function getStats() {
  const [activity, goals, achievements] = await Promise.all([db.getActivity(), db.getGoals(), db.getAchievements()]);
  return { activity, lifetimeWatchSeconds: activity.reduce((s, a) => s + a.watchSeconds, 0), goals, achievements };
}

// ── Media type helpers (client-side) ──────────────────────────────────────────
const VIDEO_EXTS = new Set(['.mp4', '.m4v', '.mov', '.mkv', '.avi', '.webm', '.wmv', '.flv', '.mpg', '.mpeg', '.ts', '.m2ts', '.mts', '.ogv', '.3gp', '.3g2', '.f4v']);
const AUDIO_EXTS = new Set(['.mp3', '.m4a', '.m4b', '.aac', '.wav', '.flac', '.ogg', '.oga', '.opus', '.wma', '.aiff', '.aif', '.alac', '.mka']);
const DOC_EXTS = new Set(['.pdf']);
const SUBTITLE_EXTS = new Set(['.srt', '.vtt']);
function isMediaExt(e) { return VIDEO_EXTS.has(e) || AUDIO_EXTS.has(e) || DOC_EXTS.has(e); }
function mediaKind(e) { return AUDIO_EXTS.has(e) ? 'audio' : DOC_EXTS.has(e) ? 'pdf' : 'video'; }
function browserPlayableHint(e) {
  return ['.mp4', '.m4v', '.mov', '.webm', '.ogv', '.mp3', '.m4a', '.m4b', '.aac', '.wav', '.ogg', '.oga', '.opus', '.flac', '.pdf'].includes(e) ? 'likely' : 'depends-on-browser-codec';
}
function extOf(name) { const i = name.lastIndexOf('.'); return i < 0 ? '' : name.slice(i).toLowerCase(); }
function nameNoExt(name) { const i = name.lastIndexOf('.'); return i < 0 ? name : name.slice(0, i); }
function titleFromFilename(n) { return n.replace(/\.[^.]+$/, '').replace(/\s+/g, ' ').trim(); }

// ── Subtitle parsing (.srt / .vtt) ────────────────────────────────────────────
function parseSubtitles(text) {
  const cues = [];
  const blocks = String(text).replace(/\r\n?/g, '\n').split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() && l.trim().toUpperCase() !== 'WEBVTT');
    const tIdx = lines.findIndex((l) => l.includes('-->'));
    if (tIdx < 0) continue;
    const m = lines[tIdx].match(/(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})/);
    if (!m) continue;
    const start = parseSubTime(m[1]);
    const end = parseSubTime(m[2]);
    const cueText = lines.slice(tIdx + 1).join(' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (cueText) cues.push({ start, end, text: cueText });
  }
  return cues;
}
function parseSubTime(ts) {
  const parts = ts.replace(',', '.').split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(parts[0]) || 0;
}
function cuesToVtt(cues) {
  const fmt = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = (s % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${sec.toFixed(3).padStart(6, '0')}`;
  };
  let out = 'WEBVTT\n\n';
  for (const c of cues) out += `${fmt(c.start)} --> ${fmt(c.end)}\n${c.text}\n\n`;
  return out;
}
function splitRelPath(p) { return p.split(/[\\/]+/).filter(Boolean); }
function emptyProgress() { return { startedAt: null, lastWatchedAt: null, completedAt: null, watchSeconds: 0, resumeSeconds: 0, percent: 0, completed: false }; }
function hashId(str) {
  let h1 = 0x811c9dc5, h2 = 0xc2b2ae35;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193); h2 = Math.imul(h2 ^ c, 0x85ebca6b); }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

// ── Course library (served by this app's own server) ──────────────────────────
// The course folders live on the server; the browser lists them via /api/library
// and streams each file via /api/file. Per-user progress still lives in this
// browser (IndexedDB), so everyone who opens the URL gets their own tracking.
async function loadServerLibrary(isRescan = false) {
  state.serverMode = true;
  if (!isRescan) showGate('scanning', 'the courses folder');
  try {
    await loadLibrary();
    await loadStats();
    el.sourceRoot.textContent = state.rootName;
    if (!state.library.courses.length && !state.library.videos.length) {
      showGate('empty', state.rootName || 'the courses folder');
      return;
    }
    hideGate();
    evaluateAchievements();
    if (!isRescan) showDashboard();
  } catch (error) {
    console.error(error);
    showGate('error', state.rootName || 'the server');
  }
}

// The folder lives on the server now, so the gate's "rescan" button just reloads.
async function pickFolder() { await loadServerLibrary(true); }

function fileUrl(relPath) { return `/api/file?path=${encodeURIComponent(relPath)}`; }

// Fetch the server's library listing and normalise it into buildLibrary's shape.
async function fetchServerScan() {
  const res = await fetch('/api/library', { cache: 'no-store' });
  if (!res.ok) throw new Error(`library ${res.status}`);
  const data = await res.json();
  const raw = (data.items || []).map((it) => ({
    name: it.name, ext: it.ext, relParts: splitRelPath(it.relPath), url: fileUrl(it.relPath)
  }));
  const subs = (data.subs || []).map((s) => ({
    name: s.name, ext: s.ext, dir: s.dir, url: fileUrl(s.relPath)
  }));
  return { rootName: data.rootName || 'Courses', raw, subs };
}

async function fileURLFor(video) {
  if (video._url) return video._url;            // server-streamed file
  const file = await video._handle.getFile();   // demo blob
  return URL.createObjectURL(file);
}

// ── Demo mode ─────────────────────────────────────────────────────────────────
// Loads a built-in sample library backed by generated, playable files. Lets the
// app run without picking a folder — handy as a preview and for testing.
async function loadDemo() {
  state.dirHandle = null;
  state.rootName = 'Demo Library';
  const wav = makeSilentWav(18);
  const pdf = makeTinyPdf('Demo Cheat Sheet');
  const vtt = new Blob([DEMO_VTT], { type: 'text/vtt' });
  const fh = (blob, name) => ({ getFile: async () => new File([blob], name, { type: blob.type }) });
  const raw = [];
  const subs = [];
  const add = (parts, blob) => raw.push({ name: parts[parts.length - 1], ext: extOf(parts[parts.length - 1]), relParts: parts, handle: fh(blob, parts[parts.length - 1]) });
  add(['Getting Started', '01 Welcome.wav'], wav);
  add(['Getting Started', '02 How it works.wav'], wav);
  add(['Getting Started', 'Overview.pdf'], pdf);
  add(['Deep Dive', 'Module 1', 'Core concepts.wav'], wav);
  add(['Deep Dive', 'Module 1', 'A worked example.wav'], wav);
  add(['Deep Dive', 'Module 2', 'Putting it together.wav'], wav);
  add(['Deep Dive', 'Module 2', 'Cheat sheet.pdf'], pdf);
  // Sidecar transcript for "Core concepts" (same folder + basename).
  subs.push({ name: 'Core concepts.vtt', ext: '.vtt', dir: 'Deep Dive/Module 1', handle: fh(vtt, 'Core concepts.vtt') });

  const [progressMap, durationMap] = await Promise.all([db.getProgressMap(), db.getDurations()]);
  state.library = buildLibrary(raw, state.rootName, progressMap, durationMap, subs);
  el.sourceRoot.textContent = state.rootName;
  await loadStats();
  render();
  hideGate();
  evaluateAchievements();
  showDashboard();
  probeDurations();
}

function makeSilentWav(seconds = 12, sampleRate = 8000) {
  const samples = seconds * sampleRate;
  const dataSize = samples * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(buf);
  const str = (off, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + dataSize, true); str(8, 'WAVE');
  str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  str(36, 'data'); dv.setUint32(40, dataSize, true);
  return new Blob([buf], { type: 'audio/wav' });
}

const DEMO_VTT = `WEBVTT

00:00:00.000 --> 00:00:03.000
Welcome to the core concepts lesson.

00:00:03.000 --> 00:00:06.500
An operation is idempotent when applying it many times has the same effect as applying it once.

00:00:06.500 --> 00:00:10.000
Idempotency is essential for reliable, retry-safe systems.

00:00:10.000 --> 00:00:13.500
We'll also cover declarative versus imperative approaches.

00:00:13.500 --> 00:00:18.000
Declarative means you describe the desired state and let the tool reconcile it.
`;

function makeTinyPdf(text) {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 260] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>'
  ];
  const stream = `BT /F1 24 Tf 50 150 Td (${text}) Tj ET`;
  objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let body = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(body.length); body += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = body.length;
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => { body += `${String(off).padStart(10, '0')} 00000 n \n`; });
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([body], { type: 'application/pdf' });
}

// ── Library building (client-side) ────────────────────────────────────────────
function buildLibrary(raw, rootName, progressMap, durationMap, subs = []) {
  const subsByDir = new Map();
  for (const s of subs) {
    if (!subsByDir.has(s.dir)) subsByDir.set(s.dir, []);
    subsByDir.get(s.dir).push(s);
  }
  const videos = raw.map((f) => {
    const relPath = f.relParts.join('/');
    const id = hashId(relPath);
    const rawHierarchy = f.relParts.slice(0, -1);
    const hierarchy = rawHierarchy.length ? rawHierarchy : [rootName];
    const stored = progressMap[id];
    const dur = durationMap[id];
    // Match a sidecar subtitle in the same folder (same basename, optional language suffix).
    const dir = rawHierarchy.join('/');
    const base = nameNoExt(f.name);
    const sub = (subsByDir.get(dir) || []).find((s) => {
      const sb = nameNoExt(s.name);
      return sb === base || sb.startsWith(`${base}.`);
    });
    return {
      id, relPath, title: titleFromFilename(f.name), coursePath: rawHierarchy.join('/'),
      hierarchy, kind: mediaKind(f.ext), ext: f.ext, playableHint: browserPlayableHint(f.ext),
      sizeBytes: 0,
      durationSeconds: Number.isFinite(dur) ? dur : null,
      durationSource: dur != null ? 'browser' : null,
      progress: stored ? { ...emptyProgress(), ...stored } : emptyProgress(),
      hasTranscript: Boolean(sub),
      _handle: f.handle || null,
      _url: f.url || null,
      _subHandle: sub ? (sub.handle || null) : null,
      _subUrl: sub ? (sub.url || null) : null
    };
  });
  videos.sort((a, b) => a.relPath.localeCompare(b.relPath, undefined, { numeric: true, sensitivity: 'base' }));

  const root = createFolderNode('library', rootName, '');
  for (const v of videos) {
    let node = root;
    for (const seg of v.hierarchy) {
      const path = node.path ? `${node.path}/${seg}` : seg;
      let child = node.childMap.get(seg);
      if (!child) { child = createFolderNode(path, seg, path); node.childMap.set(seg, child); node.children.push(child); }
      node = child;
    }
    node.videos.push(v);
  }
  finalizeFolder(root);
  stripMaps(root);
  return { sourceRoot: rootName, courses: root.children, videos, totals: summarize(videos), scan: { running: false } };
}
function createFolderNode(id, name, path) { return { id, name, path, children: [], videos: [], summary: emptySummary(), childMap: new Map() }; }
function finalizeFolder(node) {
  for (const c of node.children) finalizeFolder(c);
  node.summary = summarize(collectDescendantVideos(node));
  node.children.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  node.videos.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
}
function collectDescendantVideos(node) { const v = [...node.videos]; for (const c of node.children) v.push(...collectDescendantVideos(c)); return v; }
function stripMaps(node) { delete node.childMap; for (const c of node.children) stripMaps(c); }
function summarize(videos) {
  const total = videos.length;
  const completed = videos.filter((v) => v.progress.completed).length;
  const started = videos.filter((v) => v.progress.startedAt || v.progress.percent > 0).length;
  const timed = videos.filter((v) => v.kind !== 'pdf');
  const known = timed.filter((v) => Number.isFinite(v.durationSeconds));
  const totalDurationSeconds = known.reduce((s, v) => s + v.durationSeconds, 0);
  return {
    total, started, completed, remaining: Math.max(total - completed, 0),
    progressPercent: total ? Math.round((completed / total) * 1000) / 10 : 0,
    totalDurationSeconds, knownDurationCount: known.length, unknownDurationCount: timed.length - known.length
  };
}
function emptySummary() { return { total: 0, started: 0, completed: 0, remaining: 0, progressPercent: 0, totalDurationSeconds: 0, knownDurationCount: 0, unknownDurationCount: 0 }; }

// ── Gate / welcome overlay ────────────────────────────────────────────────────
function hideGate() { el.gate.hidden = true; el.appShell.classList.remove('gated'); }
function showGate(kind, name = '') {
  el.appShell.classList.add('gated');
  el.gate.hidden = false;
  const mark = '<div class="gate-mark">LT</div>';
  let body = '';
  if (kind === 'scanning') {
    body = `${mark}<h2>Loading your library…</h2>
      <p>Reading <strong>${escapeHtml(name || state.rootName || 'the courses folder')}</strong> on the server.</p>
      <div class="gate-spinner"></div>`;
  } else if (kind === 'empty') {
    body = `${mark}<h2>No courses found</h2>
      <p>The server didn't find any video, audio or PDF files in <strong>${escapeHtml(name)}</strong>.</p>
      <p class="gate-hint">Add your course folders to the server's courses directory (or start it with <code>COURSES_DIR=/path/to/courses</code>), then rescan.</p>
      <button class="primary-button gate-btn" data-gate="pick"><span class="icon icon-refresh"></span> Rescan</button>
      <button class="gate-link" data-gate="demo">or explore a demo →</button>`;
  } else {
    body = `${mark}<h2>Couldn't load the library</h2>
      <p>The app couldn't reach the server to list <strong>${escapeHtml(name)}</strong>. Check that the server is running, then retry.</p>
      <button class="primary-button gate-btn" data-gate="pick"><span class="icon icon-refresh"></span> Retry</button>
      <button class="gate-link" data-gate="demo">or explore a demo →</button>`;
  }
  el.gateCard.innerHTML = body;
}

function applyPrefs() {
  applyTheme(localStorage.getItem('lt:theme') || 'dark');
  if (localStorage.getItem('lt:sidebar-collapsed') === '1') setSidebarCollapsed(true);
  const width = localStorage.getItem('lt:sidebar-width');
  if (width) el.app.style.setProperty('--sidebar-width', width);

  el.player.volume = prefs.volume;
  el.player.muted  = prefs.muted;
  el.player.playbackRate = prefs.speed;
  el.volumeSlider.value  = String(prefs.muted ? 0 : prefs.volume);
  el.speedSelect.value   = String(prefs.speed);
  updateVolumeFill();

  if (!('pictureInPictureEnabled' in document) || !document.pictureInPictureEnabled) {
    el.pipButton.style.display = 'none';
  }
}

// ── Events ──────────────────────────────────────────────────────────────────
function bindEvents() {
  el.sidebarToggle.addEventListener('click', () => setSidebarCollapsed(true));
  el.sidebarShow.addEventListener('click',   () => setSidebarCollapsed(false));
  el.themeToggle.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
  });

  el.refreshButton.addEventListener('click', async () => {
    if (state.rootName === 'Demo Library') { toast('Demo library — nothing to rescan', 'info'); return; }
    el.refreshButton.disabled = true;
    el.refreshButton.classList.add('spinning');
    await loadServerLibrary(true);
    if (state.view === 'dashboard') renderDashboard();
    el.refreshButton.disabled = false;
    el.refreshButton.classList.remove('spinning');
    toast('Library rescanned', 'success');
  });

  el.searchInput.addEventListener('input', () => {
    state.query = el.searchInput.value.trim().toLowerCase();
    // Courses stay collapsed by default; a search expands only the matches.
    state.expandedIds = new Set();
    if (state.query) for (const id of nodesWithMatches()) state.expandedIds.add(id);
    renderCurriculum();
  });

  el.filterChips.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    state.filter = chip.dataset.filter;
    for (const c of el.filterChips.children) c.classList.toggle('active', c === chip);

    // Every tab opens with all courses collapsed for a clean overview;
    // an active search re-expands just the matching courses.
    state.expandedIds = new Set();
    if (state.query) for (const id of nodesWithMatches()) state.expandedIds.add(id);
    renderCurriculum();
  });

  el.courseList.addEventListener('mousedown', (event) => {
    const lesson = event.target.closest('[data-video-id]');
    if (!lesson) return;
    state.lastPointerSelectionAt = Date.now();
    selectVideoById(lesson.dataset.videoId, { autoplay: true });
  });

  el.courseList.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="choose-source"]')) { pickFolder(); return; }
    const resetNode = event.target.closest('[data-reset-node]');
    if (resetNode) { resetCourse(resetNode.dataset.resetNode); return; }
    const lesson = event.target.closest('[data-video-id]');
    if (lesson) {
      if (Date.now() - state.lastPointerSelectionAt < 600) return;
      selectVideoById(lesson.dataset.videoId, { autoplay: true });
      return;
    }
    const toggle = event.target.closest('[data-node-id]');
    if (!toggle) return;
    const id = toggle.dataset.nodeId;
    state.expandedIds.has(id) ? state.expandedIds.delete(id) : state.expandedIds.add(id);
    renderCurriculum();
  });

  // Media events
  el.player.addEventListener('loadedmetadata', () => {
    if (!state.selectedVideo || !Number.isFinite(el.player.duration)) return;
    const durationSeconds = el.player.duration;
    state.selectedVideo.durationSeconds = durationSeconds;
    db.saveDuration(state.selectedVideo.id, durationSeconds).catch(() => {});
    // Local blob URLs don't support media fragments, so seek the resume point here
    // (instant and reliable for local files).
    if (state.pendingResume > 0 && state.pendingResume < durationSeconds - 1) {
      try { el.player.currentTime = state.pendingResume; } catch {}
    }
    state.pendingResume = 0;
    updatePlayerControls();
    attemptPlayback();
  });

  el.player.addEventListener('canplay', () => attemptPlayback());
  el.player.addEventListener('play',  () => { el.videoFrame.classList.add('is-playing'); saveProgress('play'); updatePlayerControls(); scheduleControlsHide(); });
  el.player.addEventListener('pause', () => { el.videoFrame.classList.remove('is-playing'); saveProgress('pause'); updatePlayerControls(); showControls(); });
  el.player.addEventListener('ended', () => {
    el.videoFrame.classList.remove('is-playing');
    saveProgress('ended', { renderList: true });
    updatePlayerControls();
    showControls();
    // When a quiz is available and auto-quiz is on, run the quiz instead of
    // auto-advancing; otherwise advance to the next lesson as before.
    if (quizAvailableFor(state.selectedVideo) && localStorage.getItem('lt:auto-quiz') !== '0') {
      window.setTimeout(() => startQuiz(true), 400);
    } else {
      window.setTimeout(() => playAdjacent(1, true), 350);
    }
  });
  el.player.addEventListener('seeking', () => { state.isSeeking = true; });
  el.player.addEventListener('seeked',  () => { state.isSeeking = false; saveProgress('seeked', { renderList: true }); updatePlayerControls(); });
  el.player.addEventListener('timeupdate', () => {
    updatePlayerControls();
    if (!state.isSeeking) saveProgress('progress', { throttle: true });
  });
  el.player.addEventListener('progress', updateBuffered);
  el.player.addEventListener('volumechange', () => { prefs.volume = el.player.volume; prefs.muted = el.player.muted; updatePlayerControls(); });
  el.player.addEventListener('ratechange',   () => { prefs.speed = el.player.playbackRate; updatePlayerControls(); });
  el.player.addEventListener('error', () => { state.pendingAutoplay = false; renderVideoStats('Needs codec/transcoder'); });

  // Controls
  el.playToggle.addEventListener('click', togglePlayback);
  el.prevButton.addEventListener('click', () => playAdjacent(-1, true));
  el.nextButton.addEventListener('click', () => playAdjacent(1, true));
  el.skipBack.addEventListener('click',    () => seekRelative(-10));
  el.skipForward.addEventListener('click', () => seekRelative(10));

  el.muteToggle.addEventListener('click', () => { el.player.muted = !el.player.muted; updatePlayerControls(); });
  el.volumeSlider.addEventListener('input', () => {
    el.player.volume = Number(el.volumeSlider.value);
    el.player.muted  = el.player.volume === 0;
    updatePlayerControls();
  });
  el.speedSelect.addEventListener('change', () => { el.player.playbackRate = Number(el.speedSelect.value); });

  el.pipButton.addEventListener('click', async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (state.selectedVideo) await el.player.requestPictureInPicture();
    } catch { toast('Picture-in-Picture unavailable', 'warn'); }
  });

  el.videoFrame.addEventListener('pointerdown', (e) => {
    if (el.videoFrame.classList.contains('pdf-mode')) return;
    if (e.target.closest('.controls-overlay')) return;
    state.lastSurfaceToggleAt = Date.now();
    togglePlayback();
  });
  el.videoFrame.addEventListener('click', (e) => {
    if (el.videoFrame.classList.contains('pdf-mode')) return;
    if (e.target.closest('.controls-overlay')) return;
    if (Date.now() - state.lastSurfaceToggleAt < 600) return;
    togglePlayback();
  });
  el.videoFrame.addEventListener('dblclick', (e) => {
    if (el.videoFrame.classList.contains('pdf-mode')) return;
    if (e.target.closest('.controls-overlay')) return;
    toggleFullscreen();
  });

  el.pdfComplete.addEventListener('click', togglePdfComplete);

  el.seekSlider.addEventListener('input', () => {
    const duration = getDuration();
    if (!duration) return;
    const nextTime = (Number(el.seekSlider.value) / 1000) * duration;
    el.player.currentTime = nextTime;
    updateTimeLabels(nextTime, duration);
    updateSeekFill(nextTime, duration);
  });
  el.seekSlider.addEventListener('change', () => saveProgress('seeked', { renderList: true }));

  el.seekTrack.addEventListener('mousemove', (e) => {
    const duration = getDuration();
    if (!duration) return;
    const rect = el.seekTrack.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    el.seekTooltip.textContent = formatClock(ratio * duration);
    el.seekTooltip.style.left = `${ratio * 100}%`;
  });

  el.videoFrame.addEventListener('mousemove', () => {
    showControls();
    el.videoFrame.classList.add('cursor-visible');
    if (!el.player.paused) scheduleControlsHide();
  });
  el.videoFrame.addEventListener('mouseleave', () => { if (!el.player.paused) scheduleControlsHide(800); });
  el.controlsOverlay.addEventListener('mouseenter', () => { clearTimeout(state.controlsHideTimer); showControls(); });

  el.fullscreenButton.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => {
    setButtonIcon(el.fullscreenButton, document.fullscreenElement ? 'minimize' : 'maximize');
  });

  el.shortcutsButton.addEventListener('click', openShortcuts);
  el.shortcutsClose.addEventListener('click', closeShortcuts);
  el.shortcutsModal.addEventListener('click', (e) => { if (e.target === el.shortcutsModal) closeShortcuts(); });

  // Library gate (rescan / demo)
  el.gate.addEventListener('click', (e) => {
    const action = e.target.closest('[data-gate]')?.dataset.gate;
    if (action === 'pick') pickFolder();
    else if (action === 'demo') loadDemo();
  });

  // Reset progress
  el.resetLesson.addEventListener('click', resetCurrentLesson);
  el.resetAll.addEventListener('click', resetAllProgress);

  // Notes & bookmarks
  el.notesToggle.addEventListener('click', toggleNotes);
  el.notesClose.addEventListener('click', () => { el.notesDrawer.hidden = true; });
  el.notesExport.addEventListener('click', exportNotes);
  el.noteAdd.addEventListener('click', () => addNote('note'));
  el.noteBookmark.addEventListener('click', () => addNote('bookmark'));
  el.noteInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addNote('note'); } });
  el.notesList.addEventListener('click', (e) => {
    const seek = e.target.closest('[data-seek]');
    if (seek) { seekTo(Number(seek.dataset.seek)); return; }
    const del = e.target.closest('[data-del]');
    if (del) deleteNote(del.dataset.del);
  });

  // Transcript & captions
  el.transcriptToggle.addEventListener('click', toggleTranscript);
  el.transcriptClose.addEventListener('click', () => { el.transcriptDrawer.hidden = true; });
  el.transcriptSearch.addEventListener('input', () => { state.transcriptQuery = el.transcriptSearch.value.trim().toLowerCase(); renderTranscript(); });
  el.transcriptList.addEventListener('click', (e) => {
    const row = e.target.closest('[data-cue]');
    if (row) seekTo(Number(row.dataset.cue));
  });
  el.ccButton.addEventListener('click', toggleCaptions);

  // Flashcards
  el.cardsToggle.addEventListener('click', toggleCards);
  el.cardsClose.addEventListener('click', () => { el.cardsDrawer.hidden = true; });
  el.cardAdd.addEventListener('click', addCard);
  el.cardFront.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addCard(); } });
  el.cardsReviewLesson.addEventListener('click', () => startReview('lesson'));
  el.cardsList.addEventListener('click', (e) => {
    const jump = e.target.closest('[data-card-seek]');
    if (jump) { seekTo(Number(jump.dataset.cardSeek)); return; }
    const del = e.target.closest('[data-del-card]');
    if (del) deleteCard(del.dataset.delCard);
  });
  // Review modal
  el.reviewClose.addEventListener('click', endReview);
  el.reviewShow.addEventListener('click', revealAnswer);
  el.reviewGrades.addEventListener('click', (e) => {
    const g = e.target.closest('[data-grade]');
    if (g) gradeCard(g.dataset.grade);
  });
  el.reviewModal.addEventListener('click', (e) => { if (e.target === el.reviewModal) endReview(); });

  // Settings (AI)
  el.settingsButton.addEventListener('click', openSettings);
  el.settingsClose.addEventListener('click', () => { el.settingsModal.hidden = true; });
  el.settingsModal.addEventListener('click', (e) => { if (e.target === el.settingsModal) el.settingsModal.hidden = true; });
  el.aiProvider.addEventListener('change', syncSettingsProvider);
  el.aiKeyShow.addEventListener('click', () => {
    const showing = el.aiKey.type === 'text';
    el.aiKey.type = showing ? 'password' : 'text';
    el.aiKeyShow.querySelector('.icon').className = `icon icon-${showing ? 'eye' : 'eye-off'}`;
  });
  el.settingsSave.addEventListener('click', saveSettings);
  el.exportBtn.addEventListener('click', exportData);
  el.importBtn.addEventListener('click', () => el.importFile.click());
  el.importFile.addEventListener('change', (e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ''; });

  // Quiz
  el.quizButton.addEventListener('click', startQuiz);
  el.quizClose.addEventListener('click', endQuiz);
  el.quizModal.addEventListener('click', (e) => { if (e.target === el.quizModal) endQuiz(); });
  el.quizBody.addEventListener('click', (e) => {
    const opt = e.target.closest('.quiz-opt');
    if (opt && !opt.disabled) { answerQuiz(Number(opt.dataset.opt)); return; }
    if (e.target.closest('#quizNext')) nextQuiz();
  });

  // Dashboard
  el.homeButton.addEventListener('click', showDashboard);
  el.addGoalBtn.addEventListener('click', openGoalModal);
  el.goalClose.addEventListener('click', () => { el.goalModal.hidden = true; });
  el.goalModal.addEventListener('click', (e) => { if (e.target === el.goalModal) el.goalModal.hidden = true; });
  el.goalSave.addEventListener('click', saveGoal);
  el.continueRow.addEventListener('click', (e) => {
    const card = e.target.closest('[data-video-id]');
    if (card) selectVideoById(card.dataset.videoId, { autoplay: true });
  });
  el.goalsList.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del-goal]');
    if (!del) return;
    if (await confirmDialog({ title: 'Delete goal?', body: 'This goal will be removed. Your watch progress is not affected.', okLabel: 'Delete' })) {
      deleteGoal(del.dataset.delGoal);
    }
  });

  // Activity tracking
  el.player.addEventListener('play', activityStart);
  el.player.addEventListener('pause', activityStop);
  el.player.addEventListener('ended', activityStop);
  window.addEventListener('pagehide', activityStop);

  document.addEventListener('keydown', handleKeydown);
}

// ── Resizable sidebar ────────────────────────────────────────────────────────
function initResize() {
  let active = false;
  el.resizeHandle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    active = true;
    el.app.classList.add('resizing');
    try { el.resizeHandle.setPointerCapture(e.pointerId); } catch {}
  });
  el.resizeHandle.addEventListener('pointermove', (e) => {
    if (!active) return;
    const w = Math.max(320, Math.min(640, Math.round(e.clientX)));
    el.app.style.setProperty('--sidebar-width', `${w}px`);
  });
  const end = (e) => {
    if (!active) return;
    active = false;
    el.app.classList.remove('resizing');
    try { el.resizeHandle.releasePointerCapture(e.pointerId); } catch {}
    localStorage.setItem('lt:sidebar-width', getComputedStyle(el.app).getPropertyValue('--sidebar-width').trim());
  };
  el.resizeHandle.addEventListener('pointerup', end);
  el.resizeHandle.addEventListener('pointercancel', end);
  el.resizeHandle.addEventListener('dblclick', () => {
    el.app.style.setProperty('--sidebar-width', '430px');
    localStorage.setItem('lt:sidebar-width', '430px');
  });
}

// ── Keyboard shortcuts ───────────────────────────────────────────────────────
function handleKeydown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

  // Flashcard review captures keys while open.
  if (!el.reviewModal.hidden) {
    if (e.key === 'Escape') { endReview(); return; }
    if (el.reviewGrades.hidden) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); revealAnswer(); }
    } else {
      const map = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
      if (map[e.key]) { e.preventDefault(); gradeCard(map[e.key]); }
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); gradeCard('good'); }
    }
    return;
  }

  if (!el.quizModal.hidden && e.key === 'Escape') { endQuiz(); return; }

  if (e.key === 'Escape') {
    if (!el.confirmModal.hidden) el.confirmCancel.click();
    if (!el.shortcutsModal.hidden) closeShortcuts();
    if (!el.goalModal.hidden) el.goalModal.hidden = true;
    if (!el.settingsModal.hidden) el.settingsModal.hidden = true;
    return;
  }
  if (e.key === '?') { e.preventDefault(); openShortcuts(); return; }
  if (e.key === '[') { e.preventDefault(); setSidebarCollapsed(!el.app.classList.contains('sidebar-collapsed')); return; }

  if (!state.selectedVideo) return;

  switch (e.key) {
    case ' ':          e.preventDefault(); togglePlayback(); break;
    case 'ArrowLeft':  e.preventDefault(); seekRelative(-10); break;
    case 'ArrowRight': e.preventDefault(); seekRelative(10); break;
    case 'ArrowUp':    e.preventDefault(); changeVolume(0.1); break;
    case 'ArrowDown':  e.preventDefault(); changeVolume(-0.1); break;
    case 'm': case 'M': el.player.muted = !el.player.muted; updatePlayerControls(); toast(el.player.muted ? 'Muted' : 'Unmuted', 'info'); break;
    case 'f': case 'F': e.preventDefault(); toggleFullscreen(); break;
    case 'n': case 'N': e.preventDefault(); playAdjacent(1, true); break;
    case 'p': case 'P': e.preventDefault(); playAdjacent(-1, true); break;
    case 'b': case 'B':
      if (state.selectedVideo.kind !== 'pdf') { addNote('bookmark'); toast(`Bookmarked ${formatClock(el.player.currentTime)}`, 'info', 1500); }
      break;
    case 'c': case 'C':
      if (!el.ccButton.hidden) toggleCaptions();
      break;
  }
}

function seekRelative(delta) {
  const duration = getDuration();
  if (!duration) return;
  el.player.currentTime = Math.max(0, Math.min(duration, el.player.currentTime + delta));
  showControls();
  if (!el.player.paused) scheduleControlsHide();
}

function changeVolume(delta) {
  const v = Math.max(0, Math.min(1, el.player.volume + delta));
  el.player.volume = v;
  el.player.muted  = v === 0;
  updatePlayerControls();
}

// ── Theme ─────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('lt:theme', theme);
  setButtonIcon(el.themeToggle, theme === 'light' ? 'sun' : 'moon');
  const label = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
  el.themeToggle.title = label;
  el.themeToggle.setAttribute('aria-label', label);
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function setSidebarCollapsed(collapsed) {
  el.app.classList.toggle('sidebar-collapsed', collapsed);
  localStorage.setItem('lt:sidebar-collapsed', collapsed ? '1' : '0');
  el.sidebarToggle.title = collapsed ? 'Show sidebar' : 'Hide sidebar';
  el.sidebarToggle.setAttribute('aria-label', collapsed ? 'Show sidebar' : 'Hide sidebar');
}

// ── Controls visibility ──────────────────────────────────────────────────────
function showControls() {
  clearTimeout(state.controlsHideTimer);
  el.playerStage.classList.remove('controls-hidden');
  el.videoFrame.classList.add('cursor-visible');
}
function scheduleControlsHide(ms = 3000) {
  clearTimeout(state.controlsHideTimer);
  state.controlsHideTimer = setTimeout(() => {
    if (!el.player.paused) {
      el.playerStage.classList.add('controls-hidden');
      el.videoFrame.classList.remove('cursor-visible');
    }
  }, ms);
}

// ── Modals ───────────────────────────────────────────────────────────────────
function openShortcuts()  { el.shortcutsModal.hidden = false; el.shortcutsClose.focus(); }
function closeShortcuts() { el.shortcutsModal.hidden = true; }

// ── Confirm dialog ────────────────────────────────────────────────────────────
function confirmDialog({ title = 'Are you sure?', body = '', okLabel = 'Reset' }) {
  el.confirmTitle.textContent = title;
  el.confirmBody.innerHTML = body;
  el.confirmOk.textContent = okLabel;
  el.confirmModal.hidden = false;
  el.confirmOk.focus();
  return new Promise((resolve) => {
    const cleanup = () => {
      el.confirmModal.hidden = true;
      el.confirmOk.removeEventListener('click', onOk);
      el.confirmCancel.removeEventListener('click', onCancel);
      el.confirmModal.removeEventListener('click', onBackdrop);
    };
    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    const onBackdrop = (e) => { if (e.target === el.confirmModal) onCancel(); };
    el.confirmOk.addEventListener('click', onOk);
    el.confirmCancel.addEventListener('click', onCancel);
    el.confirmModal.addEventListener('click', onBackdrop);
  });
}

// ── Reset progress ────────────────────────────────────────────────────────────
async function resetProgress(payload, resetIds) {
  await db.resetProgress(resetIds).catch(() => {});
  const cleared = { startedAt: null, lastWatchedAt: null, completedAt: null, resumeSeconds: 0, watchSeconds: 0, percent: 0, completed: false };
  const ids = resetIds === 'all' ? null : new Set(resetIds);

  // If the playing item is being reset, pause + rewind it and suppress the
  // player events that would otherwise immediately re-save progress.
  const resettingCurrent = state.selectedVideo && (!ids || ids.has(state.selectedVideo.id));
  if (resettingCurrent && state.selectedVideo.kind !== 'pdf') {
    state.suppressSave = true;
    el.player.pause();
    try { el.player.currentTime = 0; } catch {}
    setTimeout(() => { state.suppressSave = false; }, 700);
  }

  for (const v of state.library.videos) if (!ids || ids.has(v.id)) Object.assign(v.progress, cleared);
  const walk = (nodes) => { for (const n of nodes) { for (const v of n.videos) if (!ids || ids.has(v.id)) Object.assign(v.progress, cleared); walk(n.children || []); } };
  walk(state.library.courses || []);
  render();
}

async function resetCurrentLesson() {
  const v = state.selectedVideo;
  if (!v) return;
  const ok = await confirmDialog({
    title: 'Reset this lesson?',
    body: `Watch progress for <strong>${escapeHtml(v.title)}</strong> will be cleared.`
  });
  if (!ok) return;
  await resetProgress({ ids: [v.id] }, [v.id]);
  toast('Lesson progress reset', 'success');
}

async function resetCourse(nodeId) {
  const node = findNodeById(state.library.courses, nodeId);
  if (!node) return;
  const ids = flattenVideos(node).map((v) => v.id);
  if (!ids.length) return;
  const ok = await confirmDialog({
    title: 'Reset this folder?',
    body: `Watch progress for all <strong>${ids.length}</strong> item(s) in <strong>${escapeHtml(node.name)}</strong> will be cleared.`
  });
  if (!ok) return;
  await resetProgress({ ids }, ids);
  toast(`Reset progress for “${node.name}”`, 'success');
}

async function resetAllProgress() {
  const ok = await confirmDialog({
    title: 'Reset all progress?',
    body: 'Watch progress for <strong>every</strong> lesson in this library will be cleared. This cannot be undone.',
    okLabel: 'Reset everything'
  });
  if (!ok) return;
  await resetProgress({ all: true }, 'all');
  toast('All progress reset', 'success');
}

// ── Dashboard view switching ──────────────────────────────────────────────────
function showDashboard() {
  state.view = 'dashboard';
  if (!el.player.paused) el.player.pause();
  el.notesDrawer.hidden = true;
  el.transcriptDrawer.hidden = true;
  el.cardsDrawer.hidden = true;
  el.playerWorkspace.classList.add('dashboard-view');
  renderDashboard();
}
function showPlayer() {
  state.view = 'player';
  el.playerWorkspace.classList.remove('dashboard-view');
}

// ── Stats loading & activity tracking ─────────────────────────────────────────
async function loadStats() {
  try {
    state.stats = await getStats();
  } catch {
    state.stats = { activity: [], lifetimeWatchSeconds: 0, goals: [], achievements: [] };
  }
  state.allCards = await db.getAllCards().catch(() => []);
}

function localDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function activityStart() {
  if (state.selectedVideo?.kind === 'pdf') return;
  if (state.activeSince == null) state.activeSince = Date.now();
  if (!state.activityTimer) state.activityTimer = window.setInterval(activityFlush, 20000);
}
function activityFlush() {
  if (state.activeSince == null) return;
  const secs = (Date.now() - state.activeSince) / 1000;
  state.activeSince = Date.now();
  if (secs >= 1 && secs < 1800) recordActivity({ seconds: secs });
}
function activityStop() {
  activityFlush();
  state.activeSince = null;
  if (state.activityTimer) { clearInterval(state.activityTimer); state.activityTimer = null; }
}
function recordActivity(extra = {}) {
  const body = { day: localDay(new Date()), seconds: extra.seconds || 0, completed: extra.completed || 0 };
  if (!body.seconds && !body.completed) return;
  db.recordActivity(body.day, body.seconds, body.completed).catch(() => {});
  bumpLocalActivity(body);
}
function bumpLocalActivity({ seconds = 0, completed = 0 }) {
  if (!state.stats) return;
  const day = localDay(new Date());
  let rec = state.stats.activity.find((a) => a.day === day);
  if (!rec) { rec = { day, watchSeconds: 0, completedCount: 0 }; state.stats.activity.push(rec); state.stats.activity.sort((a, b) => (a.day < b.day ? -1 : 1)); }
  rec.watchSeconds += seconds;
  rec.completedCount += completed;
  state.stats.lifetimeWatchSeconds = (state.stats.lifetimeWatchSeconds || 0) + seconds;
}

// ── Streak & time helpers ─────────────────────────────────────────────────────
function studiedDays() {
  return new Set((state.stats?.activity || []).filter((a) => a.watchSeconds > 0 || a.completedCount > 0).map((a) => a.day));
}
function dayDiff(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }
function computeStreak() {
  const days = studiedDays();
  let current = 0;
  const d = new Date();
  if (!days.has(localDay(d))) d.setDate(d.getDate() - 1); // today not yet studied → count up to yesterday
  while (days.has(localDay(d))) { current++; d.setDate(d.getDate() - 1); }
  const sorted = [...days].sort();
  let longest = 0, run = 0, prev = null;
  for (const day of sorted) { run = prev && dayDiff(prev, day) === 1 ? run + 1 : 1; longest = Math.max(longest, run); prev = day; }
  return { current, longest };
}
function activitySecondsForDay(day) { return state.stats?.activity.find((a) => a.day === day)?.watchSeconds || 0; }
function activitySecondsLastNDays(n) {
  const c = new Date(); c.setDate(c.getDate() - (n - 1));
  const cd = localDay(c);
  return (state.stats?.activity || []).filter((a) => a.day >= cd).reduce((s, a) => s + a.watchSeconds, 0);
}
function remainingSeconds(videos) {
  return videos.filter((v) => !v.progress.completed && Number.isFinite(v.durationSeconds)).reduce((s, v) => {
    const watched = v.durationSeconds * (Math.min(100, v.progress.percent || 0) / 100);
    return s + Math.max(0, v.durationSeconds - watched);
  }, 0);
}
function recentLessonsPerDay(n) {
  const cutoff = Date.now() - n * 86400000;
  const count = (state.library?.videos || []).filter((v) => v.progress.completed && v.progress.completedAt && Date.parse(v.progress.completedAt) >= cutoff).length;
  return count / n;
}
function fmtDur(seconds) {
  const s = Math.round(seconds || 0);
  if (s <= 0) return '0m';
  if (s < 60) return '<1m';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
function fmtShortDate(d) { return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }

// ── Dashboard rendering ───────────────────────────────────────────────────────
function renderDashboard() {
  if (!state.library) return;
  const h = new Date().getHours();
  el.dashGreeting.textContent = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  renderStatTiles();
  renderContinue();
  renderFlashcards();
  renderGoals();
  renderHeatmap();
  renderBadges();
}

function renderStatTiles() {
  const today = activitySecondsForDay(localDay(new Date()));
  const week = activitySecondsLastNDays(7);
  const life = state.stats?.lifetimeWatchSeconds || 0;
  const streak = computeStreak();
  const videos = state.library.videos || [];
  const lessonsDone = videos.filter((v) => v.progress.completed).length;
  const remaining = remainingSeconds(videos);
  const tiles = [
    { cls: 'tile-today', icon: 'clock', value: fmtDur(today), label: 'Today' },
    { cls: 'tile-week', icon: 'trending-up', value: fmtDur(week), label: 'This week' },
    { cls: 'tile-streak', icon: 'flame', value: `${streak.current}`, label: streak.longest > streak.current ? `Day streak · best ${streak.longest}` : 'Day streak' },
    { cls: 'tile-life', icon: 'zap', value: fmtDur(life), label: 'Lifetime' },
    { cls: 'tile-done', icon: 'circle-check', value: `${lessonsDone}`, label: 'Lessons done' },
    { cls: 'tile-remaining', icon: 'target', value: remaining ? fmtDur(remaining) : '—', label: 'Est. time left' }
  ];
  el.statTiles.innerHTML = tiles.map((t) => `
    <div class="stat-tile ${t.cls}">
      <span class="tile-icon"><span class="icon icon-${t.icon}" aria-hidden="true"></span></span>
      <strong>${escapeHtml(t.value)}</strong>
      <span>${escapeHtml(t.label)}</span>
    </div>`).join('');
}

function renderContinue() {
  const items = (state.library.videos || [])
    .filter((v) => !v.progress.completed && (v.progress.startedAt || v.progress.percent > 0))
    .sort((a, b) => (b.progress.lastWatchedAt || '').localeCompare(a.progress.lastWatchedAt || ''))
    .slice(0, 8);
  if (!items.length) { el.continueSection.hidden = true; return; }
  el.continueSection.hidden = false;
  el.continueRow.innerHTML = items.map((v) => {
    const pct = Math.round(v.progress.percent || 0);
    const resume = v.kind === 'pdf' ? 0 : resumePoint(v);
    return `
      <button class="continue-card" type="button" data-video-id="${escapeAttr(v.id)}">
        <span class="cc-course">${escapeHtml(v.hierarchy.join(' › '))}</span>
        <span class="cc-title">${escapeHtml(v.title)}</span>
        <span class="cc-bar"><span style="width:${pct}%"></span></span>
        <span class="cc-foot"><span>${pct}%</span>${resume ? `<span class="cc-resume"><span class="icon icon-play-2" aria-hidden="true"></span>${formatClock(resume)}</span>` : ''}</span>
      </button>`;
  }).join('');
}

function renderGoals() {
  const goals = state.stats?.goals || [];
  if (!goals.length) {
    el.goalsList.innerHTML = '<div class="goals-empty">No goals yet — set one to track a course toward a deadline.</div>';
    return;
  }
  el.goalsList.innerHTML = goals.map(renderGoalCard).join('');
}

function renderGoalCard(goal) {
  const courses = goal.courseIds.map((id) => findNodeById(state.library.courses, id)).filter(Boolean);
  const vids = courses.flatMap(flattenVideos);
  const total = vids.length;
  const done = vids.filter((v) => v.progress.completed).length;
  const remaining = total - done;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done === total;
  const name = goal.title || (courses.length === 1 ? courses[0].name : `${courses.length} courses`);
  const pace = recentLessonsPerDay(7);
  const chips = [];

  if (complete) {
    chips.push(goalChip('done', 'circle-check', 'Completed 🎉'));
  } else {
    if (goal.targetDate) {
      const daysLeft = Math.max(0, dayDiff(localDay(new Date()), goal.targetDate));
      const needPerDay = daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining;
      chips.push(goalChip('', 'calendar', daysLeft > 0 ? `${daysLeft}d left` : 'due today'));
      chips.push(goalChip('', 'target', `${needPerDay}/day needed`));
      const projDays = pace > 0 ? Math.ceil(remaining / pace) : Infinity;
      if (Number.isFinite(projDays)) {
        const proj = new Date(); proj.setDate(proj.getDate() + projDays);
        const onTrack = projDays <= daysLeft;
        chips.push(goalChip(onTrack ? 'ontrack' : 'behind', 'trending-up', `${onTrack ? 'On track' : 'Behind'} · ~${fmtShortDate(proj)}`));
      } else {
        chips.push(goalChip('behind', 'trending-up', 'No recent pace'));
      }
    }
    if (goal.dailyMinutes) {
      const todayMin = activitySecondsForDay(localDay(new Date())) / 60;
      chips.push(goalChip(todayMin >= goal.dailyMinutes ? 'ontrack' : '', 'clock', `Today ${Math.round(todayMin)}/${goal.dailyMinutes}m`));
    }
  }

  return `
    <div class="goal-card ${complete ? 'is-complete' : ''}">
      <div class="goal-top">
        <div>
          <div class="goal-name">${escapeHtml(name)}</div>
          <div class="goal-meta">${done}/${total} lessons${goal.targetDate ? ` · by ${fmtShortDate(new Date(goal.targetDate + 'T00:00'))}` : ''}</div>
        </div>
        <button class="goal-del" type="button" data-del-goal="${escapeAttr(goal.id)}" title="Delete goal" aria-label="Delete goal"><span class="icon icon-trash" aria-hidden="true"></span></button>
      </div>
      <div class="goal-bar"><span style="width:${pct}%"></span></div>
      <div class="goal-stats">${chips.join('')}</div>
    </div>`;
}
function goalChip(tone, icon, text) {
  return `<span class="goal-chip ${tone}"><span class="icon icon-${icon}" aria-hidden="true"></span>${escapeHtml(text)}</span>`;
}

function renderHeatmap() {
  const weeks = 20;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - today.getDay() - (weeks - 1) * 7); // Sunday, (weeks-1) weeks ago
  const map = new Map((state.stats?.activity || []).map((a) => [a.day, a.watchSeconds]));
  const cells = [];
  let totalSecs = 0, activeDays = 0;
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const day = localDay(d);
    const secs = map.get(day) || 0;
    const future = d > today;
    if (secs > 0) { totalSecs += secs; activeDays++; }
    cells.push(`<div class="hm-cell ${future ? 'future' : levelClass(secs)}" title="${day}${secs ? ` · ${fmtDur(secs)}` : ' · no activity'}"></div>`);
  }
  el.heatmap.innerHTML = cells.join('');
  el.activitySub.textContent = `${activeDays} active days · ${fmtDur(totalSecs)}`;
}
function levelClass(secs) {
  const m = secs / 60;
  if (m <= 0) return '';
  if (m < 10) return 'l1';
  if (m < 30) return 'l2';
  if (m < 60) return 'l3';
  return 'l4';
}

// ── Achievements ──────────────────────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id: 'first_lesson', icon: 'circle-check', label: 'First step', desc: 'Complete a lesson', test: (c) => c.lessonsDone >= 1 },
  { id: 'lessons_10', icon: 'circle-check', label: 'Warming up', desc: '10 lessons done', test: (c) => c.lessonsDone >= 10 },
  { id: 'lessons_50', icon: 'zap', label: 'On a roll', desc: '50 lessons done', test: (c) => c.lessonsDone >= 50 },
  { id: 'first_course', icon: 'award', label: 'Course clear', desc: 'Finish a whole course', test: (c) => c.coursesDone >= 1 },
  { id: 'streak_3', icon: 'flame', label: 'Habit forming', desc: 'Study 3 days running', test: (c) => c.streak >= 3 },
  { id: 'streak_7', icon: 'flame', label: 'One week strong', desc: '7-day study streak', test: (c) => c.streak >= 7 },
  { id: 'streak_30', icon: 'flame', label: 'Unstoppable', desc: '30-day study streak', test: (c) => c.streak >= 30 },
  { id: 'hours_1', icon: 'clock', label: 'First hour', desc: '1 hour watched', test: (c) => c.hours >= 1 },
  { id: 'hours_10', icon: 'clock', label: 'Deep work', desc: '10 hours watched', test: (c) => c.hours >= 10 },
  { id: 'hours_50', icon: 'trending-up', label: 'Dedicated', desc: '50 hours watched', test: (c) => c.hours >= 50 }
];

function achievementContext() {
  const videos = state.library?.videos || [];
  const courses = state.library?.courses || [];
  return {
    lessonsDone: videos.filter((v) => v.progress.completed).length,
    coursesDone: courses.filter(isCourseComplete).length,
    hours: (state.stats?.lifetimeWatchSeconds || 0) / 3600,
    streak: computeStreak().current
  };
}
function evaluateAchievements() {
  if (!state.stats || !state.library) return;
  const ctx = achievementContext();
  const earned = new Set(state.stats.achievements.map((a) => a.id));
  const newly = ACHIEVEMENTS.filter((a) => !earned.has(a.id) && a.test(ctx));
  if (!newly.length) return;
  const now = new Date().toISOString();
  for (const a of newly) state.stats.achievements.push({ id: a.id, earnedAt: now });
  db.saveAchievements(newly.map((a) => a.id)).catch(() => {});
  for (const a of newly) toast(`🏆 Achievement: ${a.label}`, 'success', 4500);
  if (state.view === 'dashboard') renderBadges();
}
function renderBadges() {
  const earned = new Set((state.stats?.achievements || []).map((a) => a.id));
  el.badges.innerHTML = ACHIEVEMENTS.map((a) => `
    <div class="badge ${earned.has(a.id) ? 'earned' : ''}">
      <span class="badge-ic"><span class="icon icon-${a.icon}" aria-hidden="true"></span></span>
      <strong>${escapeHtml(a.label)}</strong>
      <span>${escapeHtml(a.desc)}</span>
    </div>`).join('');
}

// ── Goal editor ───────────────────────────────────────────────────────────────
function openGoalModal() {
  el.goalTitle.value = '';
  el.goalDate.value = '';
  el.goalMinutes.value = '';
  const courses = state.library?.courses || [];
  el.goalCourses.innerHTML = courses.length
    ? courses.map((c) => `
        <label class="course-opt">
          <input type="checkbox" value="${escapeAttr(c.id)}" />
          <span class="co-name">${escapeHtml(c.name)}</span>
          <span class="co-meta">${flattenVideos(c).length} lessons</span>
        </label>`).join('')
    : '<div class="source-hint">No courses available.</div>';
  el.goalHint.textContent = 'Pick at least one course.';
  el.goalModal.hidden = false;
  el.goalTitle.focus();
}
async function saveGoal() {
  const courseIds = [...el.goalCourses.querySelectorAll('input:checked')].map((i) => i.value);
  if (!courseIds.length) { el.goalHint.textContent = 'Please select at least one course.'; return; }
  el.goalSave.disabled = true;
  const goal = {
    id: `goal_${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    title: el.goalTitle.value.trim(),
    courseIds,
    targetDate: el.goalDate.value || null,
    dailyMinutes: el.goalMinutes.value ? Number(el.goalMinutes.value) : null
  };
  await db.saveGoal(goal).catch(() => {});
  el.goalSave.disabled = false;
  el.goalModal.hidden = true;
  await loadStats();
  renderGoals();
  toast('Goal created', 'success');
}
async function deleteGoal(id) {
  await db.deleteGoal(id).catch(() => {});
  await loadStats();
  renderGoals();
  toast('Goal removed', 'info');
}

// ── Toasts ───────────────────────────────────────────────────────────────────
function toast(message, type = 'info', duration = 3200, onClick = null) {
  const iconMap = { success: 'check-circle', info: 'info', warn: 'alert-circle' };
  const div = document.createElement('div');
  div.className = `toast ${type}${onClick ? ' clickable' : ''}`;
  div.innerHTML = `<span class="icon icon-${iconMap[type] || 'info'}" aria-hidden="true"></span><span>${escapeHtml(message)}</span>`;
  if (onClick) div.addEventListener('click', () => { onClick(); div.remove(); });
  el.toastContainer.appendChild(div);
  setTimeout(() => {
    div.classList.add('dismissing');
    div.addEventListener('animationend', () => div.remove(), { once: true });
  }, duration);
}

// ── Library loading ──────────────────────────────────────────────────────────
async function loadLibrary() {
  const [scan, progressMap, durationMap] = await Promise.all([
    fetchServerScan(), db.getProgressMap(), db.getDurations()
  ]);
  state.rootName = scan.rootName;
  const prevId = state.selectedVideo?.id;
  state.library = buildLibrary(scan.raw, state.rootName, progressMap, durationMap, scan.subs);
  el.sourceRoot.textContent = state.rootName;
  if (prevId) state.selectedVideo = state.library.videos.find((v) => v.id === prevId) || null;
  render();
  probeDurations();
}

// ── Render ───────────────────────────────────────────────────────────────────
function render() {
  if (!state.library) return;
  renderHero();
  renderCurriculum();
  renderNowPlaying();
  updatePlayerControls();
}

function renderHero() {
  recomputeAggregates();
  const courses = state.library.courses || [];
  const completed  = courses.filter(isCourseComplete).length;
  const inProgress = courses.filter(isCourseInProgress).length;

  // Ring shows overall lesson-level progress for a satisfying, granular indicator.
  const videos = state.library.videos || [];
  const done = videos.filter((v) => v.progress.completed).length;
  const pct = videos.length ? Math.round((done / videos.length) * 100) : 0;
  el.heroPercent.textContent = `${pct}%`;
  el.ringFill.style.strokeDashoffset = String(RING_CIRC * (1 - pct / 100));

  el.statCourses.textContent  = courses.length;   // top-level folders only
  el.statProgress.textContent = inProgress;
  el.statDone.textContent     = completed;
}

function isCourseComplete(course) {
  return course.summary.total > 0 && course.summary.completed === course.summary.total;
}
function isCourseInProgress(course) {
  return !isCourseComplete(course) && (course.summary.completed > 0 || course.summary.started > 0);
}

// The flat list and the course tree hold separate copies of each item; keep both in sync.
function patchProgress(videoId, patch) {
  for (const v of state.library.videos) if (v.id === videoId) Object.assign(v.progress, patch);
  const walk = (nodes) => {
    for (const n of nodes) {
      for (const v of n.videos) if (v.id === videoId) Object.assign(v.progress, patch);
      walk(n.children || []);
    }
  };
  walk(state.library.courses || []);
}

// Recompute each folder's rolled-up counts from current item progress (client-side, no refetch).
function recomputeAggregates() {
  const gather = (node, acc) => { acc.push(...node.videos); for (const c of node.children) gather(c, acc); return acc; };
  const summarize = (vids, prev) => {
    const total = vids.length;
    const completed = vids.filter((v) => v.progress.completed).length;
    const started = vids.filter((v) => !v.progress.completed && (v.progress.startedAt || v.progress.percent > 0)).length;
    const timed = vids.filter((v) => v.kind !== 'pdf');
    const known = timed.filter((v) => Number.isFinite(v.durationSeconds));
    return {
      ...prev,
      total,
      completed,
      started,
      remaining: Math.max(total - completed, 0),
      progressPercent: total ? Math.round((completed / total) * 1000) / 10 : 0,
      totalDurationSeconds: known.reduce((s, v) => s + v.durationSeconds, 0),
      knownDurationCount: known.length,
      unknownDurationCount: timed.length - known.length
    };
  };
  const walk = (node) => {
    for (const child of node.children) walk(child);
    node.summary = summarize(gather(node, []), node.summary);
  };
  for (const course of state.library?.courses ?? []) walk(course);
}

// ── Background duration probing ───────────────────────────────────────────────
// The browser only knows a clip's length once its metadata loads, so after a
// scan we read just the metadata of each local file (fast, no playback) to fill
// in lengths progressively. Persisted to IndexedDB so it's a one-time cost.
async function probeDurations() {
  const pending = (state.library?.videos || []).filter((v) => v.kind !== 'pdf' && !Number.isFinite(v.durationSeconds) && (v._url || v._handle));
  if (!pending.length) return;
  const token = (state.probeToken = (state.probeToken || 0) + 1);
  let i = 0;
  let updated = 0;
  const worker = async () => {
    while (i < pending.length) {
      if (token !== state.probeToken) return;
      const v = pending[i++];
      const dur = await probeOne(v).catch(() => null);
      if (token !== state.probeToken) return;
      if (Number.isFinite(dur) && dur > 0) {
        v.durationSeconds = dur;
        v.durationSource = 'probe';
        db.saveDuration(v.id, dur).catch(() => {});
        if (++updated % 10 === 0) refreshDurationsUI();
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  if (token === state.probeToken) refreshDurationsUI();
}

function probeOne(video) {
  return new Promise((resolve, reject) => {
    const probe = document.createElement(video.kind === 'audio' ? 'audio' : 'video');
    probe.preload = 'metadata';
    probe.muted = true;
    let url = null;
    const cleanup = () => { try { probe.removeAttribute('src'); probe.load(); } catch {} if (url) URL.revokeObjectURL(url); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, 20000);
    probe.addEventListener('loadedmetadata', () => {
      clearTimeout(timer);
      const d = probe.duration;
      cleanup();
      resolve(Number.isFinite(d) ? d : null);
    }, { once: true });
    probe.addEventListener('error', () => { clearTimeout(timer); cleanup(); reject(new Error('decode')); }, { once: true });
    if (video._url) {
      probe.src = video._url;
    } else {
      video._handle.getFile()
        .then((file) => { url = URL.createObjectURL(file); probe.src = url; })
        .catch((err) => { clearTimeout(timer); reject(err); });
    }
  });
}

function refreshDurationsUI() {
  if (!state.library) return;
  renderCurriculum();
  if (state.view === 'dashboard') renderStatTiles();
  if (state.selectedVideo) updatePlayerControls();
}

// `scrollToActive` is opt-in so that expanding/collapsing a course, filtering,
// or searching doesn't yank the list back to the currently-playing lesson — we
// only auto-scroll when a lesson is actually selected.
function renderCurriculum(scrollToActive = false) {
  recomputeAggregates();
  const hasCourses = (state.library?.courses?.length ?? 0) > 0;
  const html = (state.library?.courses ?? []).map((c) => renderNode(c, 0, false)).filter(Boolean).join('');
  if (html) {
    el.courseList.innerHTML = html;
    if (scrollToActive) scrollActiveLessonIntoView();
    return;
  }
  el.courseList.innerHTML = hasCourses
    ? '<div class="empty-state">No lessons match your filters.</div>'
    : `<div class="empty-state">
        <p>No courses found on the server.</p>
        <button class="primary-button" type="button" data-action="choose-source">Rescan</button>
      </div>`;
}

function renderNode(node, depth, ancestorMatches) {
  const selfMatches = ancestorMatches || !state.query || nameMatchesQuery(node, state.query);
  const videos = node.videos.filter(
    (v) => (selfMatches || videoMatchesQuery(v, state.query)) && videoMatchesFilter(v)
  );
  const childrenHtml = (node.children || []).map((c) => renderNode(c, depth + 1, selfMatches)).filter(Boolean);
  if (!videos.length && !childrenHtml.length) return '';

  const expanded = shouldExpand(node);
  const progress = Math.round(node.summary.progressPercent || 0);
  const selected = nodeContainsSelectedVideo(node) ? ' selected' : '';
  const complete = node.summary.total > 0 && node.summary.completed === node.summary.total ? ' is-complete' : '';
  const hasProgress = node.summary.completed > 0 || node.summary.started > 0 ? ' has-progress' : '';
  const cls = expanded ? ' expanded' : ' collapsed';

  return `
    <section class="curriculum-node${selected}${complete}${hasProgress}${cls}" style="--depth:${depth}">
      <button class="curriculum-toggle" type="button" data-node-id="${escapeAttr(node.id)}" aria-expanded="${expanded}">
        <span class="toggle-copy">
          <strong>${escapeHtml(node.name)}</strong>
          <span>${node.summary.completed}/${node.summary.total} · ${formatDuration(node.summary.totalDurationSeconds, node.summary.unknownDurationCount)}</span>
        </span>
        <span class="toggle-meta">
          <span class="toggle-pct">${progress}%</span>
          <span class="mini-progress"><span style="--width:${progress}%"></span></span>
        </span>
      </button>
      <button class="node-reset" type="button" data-reset-node="${escapeAttr(node.id)}" title="Reset progress for “${escapeAttr(node.name)}”" aria-label="Reset progress for ${escapeAttr(node.name)}">
        <span class="icon icon-rotate-ccw" aria-hidden="true"></span>
      </button>
      <div class="curriculum-panel" aria-hidden="${!expanded}" ${expanded ? '' : 'inert'}>
        <div class="curriculum-panel-inner">
          ${videos.map((v) => renderLesson(v)).join('')}
          ${childrenHtml.join('')}
        </div>
      </div>
    </section>
  `;
}

function renderLesson(video) {
  const active   = state.selectedVideo?.id === video.id ? ' active' : '';
  const progress = Math.round(video.progress.percent || 0);
  const status   = video.progress.completed ? 'done' : video.progress.startedAt ? 'watching' : 'ready';
  const meta = video.kind === 'pdf'
    ? 'PDF'
    : formatDuration(video.durationSeconds, video.durationSeconds ? 0 : 1);
  const resume = video.kind === 'pdf' ? 0 : resumePoint(video);
  const statusText = status === 'watching' && resume ? `resume ${formatClock(resume)}` : status;
  return `
    <button class="lesson-button${active}" type="button" data-video-id="${escapeAttr(video.id)}">
      <span class="lesson-state ${status} kind-${video.kind}" aria-hidden="true"></span>
      <span class="lesson-copy">
        <strong>${escapeHtml(video.title)}</strong>
        <span>${meta} · ${statusText}</span>
      </span>
      <span class="lesson-percent">${progress ? progress + '%' : ''}</span>
    </button>
  `;
}

function scrollActiveLessonIntoView() {
  if (!state.selectedVideo) return;
  requestAnimationFrame(() => {
    const btn = el.courseList.querySelector(`[data-video-id="${escapeAttr(state.selectedVideo.id)}"]`);
    btn?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

// ── Video selection ──────────────────────────────────────────────────────────
function selectVideoById(videoId, options = {}) {
  const video = state.library.videos.find((v) => v.id === videoId);
  if (video) selectVideo(video, options);
}

function selectVideo(video, options = {}) {
  showPlayer();
  state.selectedVideo = video;
  state.selectedCourseId = video.hierarchy[0] || state.selectedCourseId;
  expandVideoPath(video);
  state.pendingAutoplay   = options.autoplay === true;
  state.isSeeking = false;
  el.playerEmpty.classList.add('hidden');

  const isAudio = video.kind === 'audio';
  const isPdf   = video.kind === 'pdf';
  el.videoFrame.classList.toggle('audio-mode', isAudio);
  el.videoFrame.classList.toggle('pdf-mode', isPdf);
  el.videoFrame.classList.remove('is-playing');

  // Release the previous local file URL before loading the next (server URLs aren't blobs).
  if (state.currentObjectURL) {
    if (state.currentObjectURL.startsWith('blob:')) URL.revokeObjectURL(state.currentObjectURL);
    state.currentObjectURL = null;
  }
  state.pendingResume = 0;

  // Load this lesson's notes.
  state.notes = [];
  renderNotes();
  updateNotesBadge();
  db.getNotes(video.id).then((notes) => {
    if (state.selectedVideo?.id !== video.id) return;
    state.notes = notes;
    renderNotes();
    updateNotesBadge();
  }).catch(() => {});

  // Transcript / captions for this lesson.
  loadTranscript(video);

  // Flashcards for this lesson.
  loadCards(video);

  if (isPdf) {
    state.pendingAutoplay = false;
    el.player.pause();
    el.player.removeAttribute('src');
    el.player.load();
  } else {
    el.pdfFrame.removeAttribute('src');
    state.pendingAutoplay = options.autoplay === true;
    if (isAudio) el.audioTitle.textContent = video.title;
    state.pendingResume = resumePoint(video);
  }

  renderCurriculum(true);   // selecting a lesson scrolls it into view
  renderNowPlaying();
  updatePlayerControls();

  // Resolve the local file to a blob URL (async), guarding against fast re-selection.
  const token = (state.loadToken = (state.loadToken || 0) + 1);
  fileURLFor(video).then((url) => {
    if (token !== state.loadToken) { if (url.startsWith('blob:')) URL.revokeObjectURL(url); return; } // superseded
    state.currentObjectURL = url;
    if (isPdf) {
      el.pdfFrame.src = `${url}#view=FitH`;
      el.pdfOpen.href = url;
      updatePdfToolbar();
    } else {
      el.player.src = url;
      if (state.pendingResume) toast(`Resuming at ${formatClock(state.pendingResume)}`, 'info', 2200);
      attemptPlayback();
    }
  }).catch(() => {
    renderVideoStats('Could not open file');
  });
}

// Seconds to resume from, or 0 to start at the beginning.
// Skips trivial offsets and anything essentially at the end (e.g. finished items).
function resumePoint(video) {
  const resume = Number(video.progress.resumeSeconds || 0);
  const dur = Number(video.durationSeconds || 0);
  if (resume <= 5) return 0;
  if (dur && resume >= dur - 5) return 0;
  return Math.floor(resume);
}

function updatePdfToolbar() {
  const done = Boolean(state.selectedVideo?.progress.completed);
  el.pdfComplete.classList.toggle('is-done', done);
  el.pdfComplete.textContent = done ? '✓ Completed' : 'Mark as complete';
}

function togglePdfComplete() {
  const v = state.selectedVideo;
  if (!v || v.kind !== 'pdf' || v.progress.completed) return;
  patchProgress(v.id, { startedAt: v.progress.startedAt || new Date().toISOString(), completed: true, percent: 100, completedAt: new Date().toISOString() });
  db.saveProgress(v.id, { ...v.progress }).catch(() => {});
  updatePdfToolbar();
  renderVideoStats();
  renderCurriculum();
  renderHero();
  recordActivity({ completed: 1 });
  evaluateAchievements();
  toast(`Completed · ${v.title}`, 'success', 3000);
}

// ── Notes & bookmarks ─────────────────────────────────────────────────────────
function toggleNotes() {
  el.notesDrawer.hidden = !el.notesDrawer.hidden;
  if (!el.notesDrawer.hidden) {
    el.transcriptDrawer.hidden = true;
    el.cardsDrawer.hidden = true;
    updateNoteAt();
    renderNotes();
  }
}
function updateNoteAt() {
  if (el.notesDrawer.hidden) return;
  el.noteAt.textContent = `at ${formatClock(el.player.currentTime || 0)}`;
}
function addNote(kind) {
  const v = state.selectedVideo;
  if (!v) return;
  const text = el.noteInput.value.trim();
  if (kind === 'note' && !text) { el.noteInput.focus(); return; }
  const t = Number.isFinite(el.player.currentTime) ? Math.floor(el.player.currentTime) : 0;
  state.notes.push({ id: `n_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, t, text, kind, createdAt: new Date().toISOString() });
  state.notes.sort((a, b) => a.t - b.t);
  db.saveNotes(v.id, state.notes).catch(() => {});
  el.noteInput.value = '';
  renderNotes();
  updateNotesBadge();
  if (el.notesDrawer.hidden && kind === 'bookmark') return; // bookmarked via shortcut, drawer closed
}
function deleteNote(id) {
  state.notes = state.notes.filter((n) => n.id !== id);
  if (state.selectedVideo) db.saveNotes(state.selectedVideo.id, state.notes).catch(() => {});
  renderNotes();
  updateNotesBadge();
}
function seekTo(seconds) {
  if (!state.selectedVideo) return;
  showPlayer();
  if (state.selectedVideo.kind === 'pdf') return;
  try { el.player.currentTime = seconds; } catch {}
  if (el.player.paused) { state.pendingAutoplay = true; attemptPlayback(); }
}
function renderNotes() {
  if (!state.selectedVideo) { el.notesList.innerHTML = '<div class="notes-empty">Select a lesson to take notes.</div>'; return; }
  if (!state.notes.length) {
    el.notesList.innerHTML = '<div class="notes-empty">No notes yet.<br>Add a note at the current moment, or press <b>B</b> to bookmark.</div>';
    return;
  }
  el.notesList.innerHTML = state.notes.map((n) => `
    <div class="note-item ${n.kind === 'bookmark' ? 'bookmark' : ''}">
      <button class="note-time" data-seek="${n.t}" title="Jump to ${formatClock(n.t)}">
        <span class="icon icon-${n.kind === 'bookmark' ? 'bookmark' : 'play-2'}" aria-hidden="true"></span>${formatClock(n.t)}
      </button>
      <div class="note-text">${escapeHtml(n.text)}</div>
      <button class="note-del" data-del="${escapeAttr(n.id)}" title="Delete" aria-label="Delete note"><span class="icon icon-trash" aria-hidden="true"></span></button>
    </div>`).join('');
}
function updateNotesBadge() {
  const n = state.notes.length;
  el.notesBadge.hidden = n === 0;
  el.notesBadge.textContent = String(n);
}
function exportNotes() {
  const v = state.selectedVideo;
  if (!v) return;
  if (!state.notes.length) { toast('No notes to export', 'info'); return; }
  let md = `# ${v.title}\n\n_${v.hierarchy.join(' / ')}_\n\n`;
  for (const n of state.notes) {
    const label = n.kind === 'bookmark' && !n.text ? '🔖 Bookmark' : n.text;
    md += `- **[${formatClock(n.t)}]** ${label}\n`;
  }
  downloadText(`${sanitizeFilename(v.title)}.md`, md, 'text/markdown');
  toast('Notes exported', 'success');
}
function downloadText(name, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function sanitizeFilename(name) { return String(name).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120) || 'export'; }

// ── Transcript & captions ─────────────────────────────────────────────────────
function loadTranscript(video) {
  // Reset for the new lesson.
  state.transcript = [];
  state.activeCueIndex = -1;
  state.transcriptQuery = '';
  el.transcriptSearch.value = '';
  setCaptions(null, false);
  const has = Boolean(video.hasTranscript) && video.kind !== 'pdf';
  el.transcriptToggle.hidden = !has;
  el.ccButton.hidden = !(has && video.kind === 'video');
  el.quizButton.hidden = video.kind === 'pdf' ? true : !(has || state.rootName === 'Demo Library');
  renderTranscript();
  if (!has) { if (!el.transcriptDrawer.hidden) el.transcriptDrawer.hidden = true; return; }

  const token = (state.transcriptToken = state.transcriptToken + 1);
  (video._subUrl ? fetch(video._subUrl).then((r) => r.text())
                 : video._subHandle.getFile().then((file) => file.text()))
    .then((text) => {
      if (token !== state.transcriptToken || state.selectedVideo?.id !== video.id) return;
      state.transcript = parseSubtitles(text);
      renderTranscript();
      setCaptions(state.transcript, video.kind === 'video');
    })
    .catch(() => {});
}

function setCaptions(cues, isVideo) {
  el.player.querySelectorAll('track').forEach((t) => t.remove());
  if (state.captionsUrl) { URL.revokeObjectURL(state.captionsUrl); state.captionsUrl = null; }
  el.ccButton.classList.toggle('cc-on', state.captionsOn);
  if (!cues || !cues.length || !isVideo) return;
  state.captionsUrl = URL.createObjectURL(new Blob([cuesToVtt(cues)], { type: 'text/vtt' }));
  const track = document.createElement('track');
  track.kind = 'captions'; track.label = 'Captions'; track.srclang = 'en'; track.src = state.captionsUrl;
  el.player.appendChild(track);
  const apply = () => { if (el.player.textTracks[0]) el.player.textTracks[0].mode = state.captionsOn ? 'showing' : 'hidden'; };
  track.addEventListener('load', apply);
  setTimeout(apply, 120);
}

function toggleCaptions() {
  state.captionsOn = !state.captionsOn;
  localStorage.setItem('lt:cc', state.captionsOn ? '1' : '0');
  el.ccButton.classList.toggle('cc-on', state.captionsOn);
  if (el.player.textTracks[0]) el.player.textTracks[0].mode = state.captionsOn ? 'showing' : 'hidden';
  toast(state.captionsOn ? 'Captions on' : 'Captions off', 'info', 1400);
}

function toggleTranscript() {
  el.transcriptDrawer.hidden = !el.transcriptDrawer.hidden;
  if (!el.transcriptDrawer.hidden) {
    el.notesDrawer.hidden = true;
    el.cardsDrawer.hidden = true;
    renderTranscript();
    scrollActiveCueIntoView();
  }
}

function renderTranscript() {
  if (!state.selectedVideo?.hasTranscript) {
    el.transcriptList.innerHTML = '<div class="transcript-empty">No transcript for this lesson.<br>Add a <b>.srt</b> or <b>.vtt</b> file with the same name next to the video.</div>';
    return;
  }
  if (!state.transcript.length) {
    el.transcriptList.innerHTML = '<div class="transcript-empty">Loading transcript…</div>';
    return;
  }
  const q = state.transcriptQuery;
  const rows = state.transcript
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !q || c.text.toLowerCase().includes(q));
  if (!rows.length) {
    el.transcriptList.innerHTML = '<div class="transcript-empty">No lines match your search.</div>';
    return;
  }
  el.transcriptList.innerHTML = rows.map(({ c, i }) => `
    <button class="cue-row ${i === state.activeCueIndex ? 'active' : ''}" type="button" data-cue="${c.start}" data-i="${i}">
      <span class="cue-t">${formatClock(c.start)}</span>
      <span class="cue-text">${highlight(c.text, q)}</span>
    </button>`).join('');
}

function highlight(text, q) {
  const safe = escapeHtml(text);
  if (!q) return safe;
  const idx = text.toLowerCase().indexOf(q);
  if (idx < 0) return safe;
  // Re-find on the escaped string is unreliable; do a simple case-insensitive wrap on the raw text then escape pieces.
  const before = escapeHtml(text.slice(0, idx));
  const match = escapeHtml(text.slice(idx, idx + q.length));
  const after = escapeHtml(text.slice(idx + q.length));
  return `${before}<mark>${match}</mark>${after}`;
}

function updateActiveCue() {
  if (!state.transcript.length) return;
  const t = el.player.currentTime || 0;
  let idx = -1;
  for (let i = 0; i < state.transcript.length; i++) {
    if (t >= state.transcript[i].start && t < state.transcript[i].end) { idx = i; break; }
  }
  if (idx === state.activeCueIndex) return;
  state.activeCueIndex = idx;
  if (el.transcriptDrawer.hidden) return;
  // Cheap active-class update without a full re-render.
  el.transcriptList.querySelectorAll('.cue-row.active').forEach((r) => r.classList.remove('active'));
  const row = el.transcriptList.querySelector(`[data-i="${idx}"]`);
  if (row) { row.classList.add('active'); scrollActiveCueIntoView(); }
}
function scrollActiveCueIntoView() {
  const row = el.transcriptList.querySelector('.cue-row.active');
  row?.scrollIntoView({ block: 'nearest' });
}

// ── Flashcards + spaced repetition (SM-2) ─────────────────────────────────────
function scheduleCard(srs, rating) {
  let { interval = 0, ease = 2.5, reps = 0, lapses = 0 } = srs || {};
  if (rating === 'again') {
    reps = 0; lapses += 1; ease = Math.max(1.3, ease - 0.2); interval = 1;
  } else {
    const q = rating === 'hard' ? 3 : rating === 'good' ? 4 : 5;
    ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    if (reps === 0) interval = rating === 'easy' ? 4 : 1;
    else if (reps === 1) interval = rating === 'hard' ? 3 : 6;
    else {
      const factor = rating === 'hard' ? 1.2 : rating === 'easy' ? ease * 1.3 : ease;
      interval = Math.max(1, Math.round(interval * factor));
    }
    reps += 1;
  }
  const due = new Date(); due.setHours(0, 0, 0, 0); due.setDate(due.getDate() + interval);
  return { interval, ease: Math.round(ease * 100) / 100, reps, lapses, due: localDay(due), lastReviewed: localDay(new Date()) };
}
function isCardDue(card) {
  const due = card.srs?.due;
  return !due || due <= localDay(new Date());
}
function nextIntervalLabel(srs, rating) {
  const i = scheduleCard(srs, rating).interval;
  return i >= 30 ? `${Math.round(i / 30)}mo` : `${i}d`;
}

function loadCards(video) {
  state.cards = [];
  el.cardsBadge.hidden = true;
  el.cardsReviewLesson.hidden = true;
  updateCardAt();
  renderCards();
  db.getAllCards().then((all) => {
    state.allCards = all;
    if (state.selectedVideo?.id !== video.id) return;
    state.cards = all.filter((c) => c.videoId === video.id).sort((a, b) => (a.createdAt || '') < (b.createdAt || '') ? -1 : 1);
    renderCards();
    updateCardsBadge();
  }).catch(() => {});
}
function updateCardAt() {
  if (el.cardsDrawer.hidden) return;
  el.cardAt.textContent = formatClock(el.player.currentTime || 0);
}
function updateCardsBadge() {
  const n = state.cards.length;
  el.cardsBadge.hidden = n === 0;
  el.cardsBadge.textContent = String(n);
}
function toggleCards() {
  el.cardsDrawer.hidden = !el.cardsDrawer.hidden;
  if (!el.cardsDrawer.hidden) {
    el.notesDrawer.hidden = true;
    el.transcriptDrawer.hidden = true;
    updateCardAt();
    renderCards();
  }
}
function renderCards() {
  if (!state.selectedVideo) { el.cardsList.innerHTML = '<div class="notes-empty">Select a lesson to add flashcards.</div>'; el.cardsReviewLesson.hidden = true; return; }
  el.cardsReviewLesson.hidden = state.cards.length === 0;
  if (!state.cards.length) {
    el.cardsList.innerHTML = '<div class="notes-empty">No cards yet.<br>Add a question &amp; answer to study this lesson with spaced repetition.</div>';
    return;
  }
  el.cardsList.innerHTML = state.cards.map((c) => {
    const dueNow = isCardDue(c);
    const dueLabel = dueNow ? 'Due now' : `Due ${fmtShortDate(new Date(c.srs.due + 'T00:00'))}`;
    return `
    <div class="card-item">
      <div>
        <div class="card-front">${escapeHtml(c.front)}</div>
        <div class="card-back">${escapeHtml(c.back)}</div>
        <div class="card-meta">
          <span class="card-due ${dueNow ? 'now' : ''}">${dueLabel}</span>
          ${Number.isFinite(c.t) ? `<button class="card-jump" data-card-seek="${c.t}"><span class="icon icon-play-2" aria-hidden="true"></span>${formatClock(c.t)}</button>` : ''}
        </div>
      </div>
      <button class="card-del" data-del-card="${escapeAttr(c.id)}" title="Delete card" aria-label="Delete card"><span class="icon icon-trash" aria-hidden="true"></span></button>
    </div>`;
  }).join('');
}
function addCard() {
  const v = state.selectedVideo;
  if (!v) return;
  const front = el.cardFront.value.trim();
  const back = el.cardBack.value.trim();
  if (!front || !back) { (front ? el.cardBack : el.cardFront).focus(); return; }
  const t = el.cardLinkTime.checked && Number.isFinite(el.player.currentTime) ? Math.floor(el.player.currentTime) : null;
  const card = {
    id: `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    videoId: v.id, courseId: v.hierarchy[0], lessonTitle: v.title,
    front, back, t, createdAt: new Date().toISOString(),
    srs: { interval: 0, ease: 2.5, reps: 0, lapses: 0, due: localDay(new Date()) }
  };
  db.saveCard(card).catch(() => {});
  state.cards.push(card);
  state.allCards.push(card);
  el.cardFront.value = '';
  el.cardBack.value = '';
  el.cardFront.focus();
  renderCards();
  updateCardsBadge();
  toast('Card added', 'success', 1400);
}
function deleteCard(id) {
  db.deleteCard(id).catch(() => {});
  state.cards = state.cards.filter((c) => c.id !== id);
  state.allCards = state.allCards.filter((c) => c.id !== id);
  renderCards();
  updateCardsBadge();
}

// ── Review session ────────────────────────────────────────────────────────────
function startReview(scope) {
  const source = scope === 'lesson' ? state.cards : state.allCards;
  const pool = source.filter(isCardDue).slice().sort(() => Math.random() - 0.5);
  if (!pool.length) { toast('No cards due right now', 'info'); return; }
  state.review = { queue: pool, index: 0, reviewed: 0, scope };
  el.reviewModal.hidden = false;
  showReviewCard();
}
function showReviewCard() {
  const r = state.review;
  if (!r) return;
  if (r.index >= r.queue.length) { finishReview(); return; }
  const c = r.queue[r.index];
  el.reviewProgress.textContent = `${r.index + 1} / ${r.queue.length}`;
  el.reviewContext.textContent = c.lessonTitle || '';
  el.reviewFront.textContent = c.front;
  el.reviewBack.textContent = c.back;
  el.reviewBack.hidden = true;
  el.reviewDivider.hidden = true;
  el.reviewShow.hidden = false;
  el.reviewGrades.hidden = true;
  el.reviewShow.focus();
}
function revealAnswer() {
  const r = state.review;
  if (!r || !el.reviewGrades.hidden) return;
  el.reviewBack.hidden = false;
  el.reviewDivider.hidden = false;
  el.reviewShow.hidden = true;
  el.reviewGrades.hidden = false;
  const c = r.queue[r.index];
  document.querySelector('#gAgain').textContent = nextIntervalLabel(c.srs, 'again');
  document.querySelector('#gHard').textContent = nextIntervalLabel(c.srs, 'hard');
  document.querySelector('#gGood').textContent = nextIntervalLabel(c.srs, 'good');
  document.querySelector('#gEasy').textContent = nextIntervalLabel(c.srs, 'easy');
}
function gradeCard(rating) {
  const r = state.review;
  if (!r || el.reviewGrades.hidden) return;
  const c = r.queue[r.index];
  c.srs = scheduleCard(c.srs, rating);
  db.saveCard(c).catch(() => {});
  r.reviewed += 1;
  r.index += 1;
  showReviewCard();
}
function finishReview() {
  const reviewed = state.review?.reviewed || 0;
  endReview();
  toast(`Review complete · ${reviewed} card${reviewed === 1 ? '' : 's'} 🧠`, 'success', 3500);
}
function endReview() {
  el.reviewModal.hidden = true;
  state.review = null;
  if (state.view === 'dashboard') renderFlashcards();
  if (!el.cardsDrawer.hidden) renderCards();
}

function renderFlashcards() {
  const total = state.allCards.length;
  if (!total) { el.flashSection.hidden = true; return; }
  el.flashSection.hidden = false;
  const due = state.allCards.filter(isCardDue).length;
  el.flashSub.textContent = `${total} card${total === 1 ? '' : 's'}`;
  el.flashCta.innerHTML = `
    <div class="flash-cta-text"><strong>${due}</strong> <span>card${due === 1 ? '' : 's'} due ${due ? 'for review' : '— all caught up'}</span></div>
    <button class="flash-review-btn" id="flashReviewBtn" ${due ? '' : 'disabled'}><span class="icon icon-brain" aria-hidden="true"></span> Review now</button>`;
  const btn = document.querySelector('#flashReviewBtn');
  if (btn && due) btn.addEventListener('click', () => startReview('all'));
}

// ── AI config & calls ─────────────────────────────────────────────────────────
function aiConfig() {
  return {
    provider: localStorage.getItem('lt:ai-provider') || 'gemini',
    key: localStorage.getItem('lt:ai-key') || '',
    model: localStorage.getItem('lt:ai-model') || ''
  };
}
function defaultModel(provider) {
  return provider === 'openai' ? 'gpt-4o-mini' : provider === 'anthropic' ? 'claude-3-5-haiku-latest' : 'gemini-2.0-flash';
}
async function aiError(res) {
  let detail = '';
  try { const j = await res.json(); detail = j.error?.message || j.error?.type || JSON.stringify(j).slice(0, 180); }
  catch { try { detail = (await res.text()).slice(0, 180); } catch {} }
  return new Error(`HTTP ${res.status}${detail ? ` — ${detail}` : ''}`);
}
async function callAI(prompt) {
  const { provider, key } = aiConfig();
  const model = aiConfig().model || defaultModel(provider);
  if (!key) throw new Error('no-key');
  let res;
  try {
    if (provider === 'gemini') {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.4 } })
      });
      if (!res.ok) throw await aiError(res);
      const d = await res.json();
      if (d.promptFeedback?.blockReason) throw new Error(`Blocked by safety filter (${d.promptFeedback.blockReason})`);
      return (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    }
    if (provider === 'openai') {
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, temperature: 0.4, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] })
      });
      if (!res.ok) throw await aiError(res);
      const d = await res.json();
      return d.choices?.[0]?.message?.content || '';
    }
    if (provider === 'anthropic') {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model, max_tokens: 1600, messages: [{ role: 'user', content: prompt }] })
      });
      if (!res.ok) throw await aiError(res);
      const d = await res.json();
      return (d.content || []).map((c) => c.text || '').join('');
    }
  } catch (e) {
    // fetch() throws a TypeError for network/CORS failures.
    if (e instanceof TypeError) throw new Error('Network or CORS error — the request could not reach the provider.');
    throw e;
  }
  throw new Error('bad-provider');
}
function parseQuizJson(text) {
  let t = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  let data = null;
  try { data = JSON.parse(t); } catch {
    const m = t.match(/[[{][\s\S]*[}\]]/);
    if (m) { try { data = JSON.parse(m[0]); } catch {} }
  }
  if (!data) return [];
  const arr = Array.isArray(data) ? data : (data.questions || data.quiz || []);
  return arr
    .filter((q) => q && q.question && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer))
    .map((q) => ({
      question: String(q.question),
      options: q.options.map(String).slice(0, 6),
      answer: Math.max(0, Math.min(q.options.length - 1, q.answer)),
      explanation: q.explanation ? String(q.explanation) : ''
    }))
    .slice(0, 10);
}
const DEMO_QUIZ = [
  { question: 'What does it mean for an operation to be idempotent?', options: ['It can only ever run once', 'Applying it many times has the same effect as applying it once', 'It always fails when retried', 'It must talk to a database'], answer: 1, explanation: 'Idempotent operations give the same result whether applied once or many times.' },
  { question: 'Why is idempotency valuable for reliable systems?', options: ['It makes code shorter', 'It makes retries safe — no duplicate side effects', 'It removes the need for testing', 'It speeds up the network'], answer: 1, explanation: 'Safe retries matter when a request can fail and be sent again.' },
  { question: 'What characterises a declarative approach?', options: ['You write step-by-step instructions', 'You describe the desired state and let the tool reconcile it', 'You must use a graphical interface', 'It cannot be automated'], answer: 1, explanation: 'Declarative = describe the end state; the tool figures out how to reach it.' }
];

async function generateQuiz(video, n = 5, force = false) {
  // The demo library always uses a built-in quiz so it works offline / without a key.
  if (state.rootName === 'Demo Library') return DEMO_QUIZ.slice(0, n);
  // Reuse a previously generated quiz for this lesson — avoids re-spending quota.
  if (!force) {
    const cached = await db.getQuiz(video.id).catch(() => null);
    if (cached?.questions?.length) return cached.questions;
  }
  if (!aiConfig().key) throw new Error('no-key');
  let source = (state.transcript || []).map((c) => c.text).join(' ').trim();
  if (!source && state.notes.length) source = state.notes.map((nn) => nn.text).filter(Boolean).join('. ');
  if (!source) throw new Error('no-source');
  source = source.slice(0, 6000);
  const prompt = `You are a quiz generator for a learning app. Using ONLY the lesson content below, write ${n} multiple-choice questions that test understanding of the key ideas. Each question must have exactly 4 options with exactly one correct answer. Respond with ONLY minified JSON (no markdown) in this shape: {"questions":[{"question":"...","options":["a","b","c","d"],"answer":0,"explanation":"short reason"}]} where "answer" is the 0-based index of the correct option.\n\nLesson title: ${video.title}\nContent:\n"""${source}"""`;
  const text = await callAI(prompt);
  const qs = parseQuizJson(text);
  if (!qs.length) throw new Error('parse');
  db.saveQuiz(video.id, qs).catch(() => {});
  return qs;
}

// ── Quiz session ──────────────────────────────────────────────────────────────
function quizAvailableFor(v) {
  if (!v || v.kind === 'pdf') return false;
  if (state.rootName === 'Demo Library') return true;
  return Boolean(v.hasTranscript) && Boolean(aiConfig().key);
}
async function startQuiz(auto = false, force = false) {
  const v = state.selectedVideo;
  if (!v || v.kind === 'pdf') return;
  el.quizModal.hidden = false;
  el.quizProgress.textContent = 'Quiz';
  el.quizBody.innerHTML = `<div class="quiz-loading"><div class="gate-spinner"></div><p>${force ? 'Generating a new quiz…' : 'Preparing your quiz…'}</p></div>`;
  try {
    const questions = await generateQuiz(v, 5, force);
    state.quiz = { video: v, questions, index: 0, answers: [], correct: 0, auto };
    renderQuizQuestion();
  } catch (e) {
    if (auto) {
      // Don't interrupt an auto-trigger with an error modal — close and continue.
      el.quizModal.hidden = true;
      state.quiz = null;
      if (e.message !== 'no-source') toast(`Quiz unavailable · ${e.message.slice(0, 70)}`, 'warn', 4500);
      window.setTimeout(() => playAdjacent(1, true), 250);
      return;
    }
    renderQuizError(e.message);
  }
}
function renderQuizError(code) {
  if (code === 'no-key') {
    el.quizBody.innerHTML = `<div class="quiz-msg"><span class="icon icon-wand"></span><h3>Add an AI key to generate quizzes</h3><p>Quizzes are written by an AI model from the lesson transcript, using your own key — stored only in this browser.</p><button class="primary-button" id="quizOpenSettings">Open AI settings</button><p class="quiz-hint">Tip: Google Gemini has a free tier — no credit card needed.</p></div>`;
    document.querySelector('#quizOpenSettings')?.addEventListener('click', () => { endQuiz(); openSettings(); });
  } else if (code === 'no-source') {
    el.quizBody.innerHTML = `<div class="quiz-msg"><h3>No transcript for this lesson</h3><p>AI quizzes read the lesson's transcript (a <b>.srt</b>/<b>.vtt</b> file next to the video) or your notes. Add one to enable quizzes here.</p><button class="primary-button" id="quizCloseMsg">Close</button></div>`;
    document.querySelector('#quizCloseMsg')?.addEventListener('click', endQuiz);
  } else if (code === 'parse') {
    el.quizBody.innerHTML = `<div class="quiz-msg"><h3>Couldn't read the quiz</h3><p>The AI replied but the response wasn't valid quiz JSON. This is usually transient — try again, or switch model in Settings.</p><div class="quiz-result-actions" style="justify-content:center"><button class="pill-button" id="quizOpenSettings2">Settings</button><button class="primary-button" id="quizRetry">Retry</button></div></div>`;
    document.querySelector('#quizRetry')?.addEventListener('click', () => startQuiz());
    document.querySelector('#quizOpenSettings2')?.addEventListener('click', () => { endQuiz(); openSettings(); });
  } else {
    const net = /network or cors/i.test(code);
    const quota = /\b429\b|quota|rate limit|resource_exhausted/i.test(code);
    let title = "Couldn't generate a quiz";
    let hint = 'Check your provider, API key and model name in Settings, then retry.';
    if (quota) {
      title = 'AI rate limit reached';
      hint = 'Your key works — you’ve just hit the provider’s rate or daily limit. Wait a minute and retry. (Generated quizzes are cached per lesson, so you won’t re-spend on this one.) For higher free limits, try the model <b>gemini-2.0-flash-lite</b> in Settings.';
    } else if (net) {
      hint = 'The request couldn’t reach the provider — check your connection. Some providers block direct browser calls.';
    }
    el.quizBody.innerHTML = `<div class="quiz-msg"><h3>${title}</h3><p>${escapeHtml(code)}</p><p class="quiz-hint">${hint}</p><div class="quiz-result-actions" style="justify-content:center"><button class="pill-button" id="quizOpenSettings2">Open settings</button><button class="primary-button" id="quizRetry">Retry</button></div></div>`;
    document.querySelector('#quizRetry')?.addEventListener('click', () => startQuiz());
    document.querySelector('#quizOpenSettings2')?.addEventListener('click', () => { endQuiz(); openSettings(); });
  }
}
function renderQuizQuestion() {
  const q = state.quiz;
  if (!q) return;
  if (q.index >= q.questions.length) { showQuizResults(); return; }
  const item = q.questions[q.index];
  el.quizProgress.textContent = `Question ${q.index + 1} / ${q.questions.length}`;
  el.quizBody.innerHTML = `
    <div class="quiz-q">${escapeHtml(item.question)}</div>
    <div class="quiz-options">
      ${item.options.map((o, i) => `<button class="quiz-opt" data-opt="${i}">${escapeHtml(o)}</button>`).join('')}
    </div>
    <div class="quiz-feedback" id="quizFeedback" hidden></div>
    <button class="primary-button quiz-next" id="quizNext" hidden>${q.index + 1 < q.questions.length ? 'Next question' : 'See results'}</button>`;
}
function answerQuiz(optIndex) {
  const q = state.quiz;
  if (!q || q.answers[q.index] != null) return;
  const item = q.questions[q.index];
  q.answers[q.index] = optIndex;
  const correct = optIndex === item.answer;
  if (correct) q.correct++;
  el.quizBody.querySelectorAll('.quiz-opt').forEach((b, i) => {
    b.disabled = true;
    if (i === item.answer) b.classList.add('correct');
    else if (i === optIndex) b.classList.add('wrong');
  });
  const fb = document.querySelector('#quizFeedback');
  fb.hidden = false;
  fb.className = `quiz-feedback ${correct ? 'good' : 'bad'}`;
  fb.innerHTML = `<strong>${correct ? 'Correct' : 'Not quite'}</strong>${item.explanation ? ` · ${escapeHtml(item.explanation)}` : ''}`;
  const next = document.querySelector('#quizNext');
  next.hidden = false;
  next.focus();
}
function nextQuiz() { if (state.quiz) { state.quiz.index++; renderQuizQuestion(); } }
function showQuizResults() {
  const q = state.quiz;
  const pct = Math.round((q.correct / q.questions.length) * 100);
  el.quizProgress.textContent = 'Results';
  el.quizBody.innerHTML = `
    <div class="quiz-result">
      <div class="quiz-score ${pct >= 70 ? 'good' : pct >= 40 ? 'mid' : 'low'}">${q.correct} / ${q.questions.length}</div>
      <p>${pct >= 70 ? 'Great recall! 🎉' : pct >= 40 ? 'Good effort — revisit the ones you missed.' : 'Worth another pass through this lesson.'}</p>
      <div class="quiz-result-actions">
        <button class="pill-button" id="quizRegen"><span class="icon icon-rotate-cw"></span> New quiz</button>
        <button class="pill-button" id="quizSaveCards"><span class="icon icon-layers"></span> Save as flashcards</button>
        <button class="primary-button" id="quizDone">Done</button>
      </div>
    </div>`;
  document.querySelector('#quizDone').addEventListener('click', endQuiz);
  document.querySelector('#quizSaveCards').addEventListener('click', saveQuizAsCards);
  document.querySelector('#quizRegen').addEventListener('click', () => startQuiz(false, true));
}
function saveQuizAsCards() {
  const q = state.quiz;
  if (!q) return;
  const v = q.video;
  let added = 0;
  for (const item of q.questions) {
    const card = {
      id: `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}_${added}`,
      videoId: v.id, courseId: v.hierarchy[0], lessonTitle: v.title,
      front: item.question, back: item.options[item.answer] + (item.explanation ? ` — ${item.explanation}` : ''),
      t: null, createdAt: new Date().toISOString(),
      srs: { interval: 0, ease: 2.5, reps: 0, lapses: 0, due: localDay(new Date()) }
    };
    db.saveCard(card).catch(() => {});
    state.allCards.push(card);
    if (state.selectedVideo?.id === v.id) state.cards.push(card);
    added++;
  }
  updateCardsBadge();
  if (!el.cardsDrawer.hidden) renderCards();
  const btn = document.querySelector('#quizSaveCards');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="icon icon-circle-check"></span> Saved'; }
  toast(`${added} flashcard${added === 1 ? '' : 's'} added`, 'success');
}
function endQuiz() {
  el.quizModal.hidden = true;
  state.quiz = null;
}

// ── Settings (AI) ─────────────────────────────────────────────────────────────
const KEY_HINTS = {
  gemini: 'Free key at <b>aistudio.google.com</b> — no credit card needed.',
  openai: 'Key at <b>platform.openai.com</b> (paid, pay-as-you-go).',
  anthropic: 'Key at <b>console.anthropic.com</b> (paid, pay-as-you-go).'
};
function openSettings() {
  const cfg = aiConfig();
  el.aiProvider.value = cfg.provider;
  el.aiKey.value = cfg.key;
  el.aiModel.value = cfg.model;
  el.autoQuizToggle.checked = localStorage.getItem('lt:auto-quiz') !== '0';
  syncSettingsProvider();
  el.settingsModal.hidden = false;
}
function syncSettingsProvider() {
  const p = el.aiProvider.value;
  el.aiKeyHint.innerHTML = KEY_HINTS[p] || '';
  el.aiModel.placeholder = `default: ${defaultModel(p)}`;
}
function saveSettings() {
  localStorage.setItem('lt:ai-provider', el.aiProvider.value);
  localStorage.setItem('lt:ai-key', el.aiKey.value.trim());
  localStorage.setItem('lt:ai-model', el.aiModel.value.trim());
  localStorage.setItem('lt:auto-quiz', el.autoQuizToggle.checked ? '1' : '0');
  el.settingsModal.hidden = true;
  toast('Settings saved', 'success');
}

// ── Backup & restore ──────────────────────────────────────────────────────────
const BACKUP_STORES = ['progress', 'durations', 'activity', 'goals', 'achievements', 'notes', 'cards', 'quizzes'];
async function exportData() {
  const data = {};
  for (const s of BACKUP_STORES) {
    const entries = await idbEntries(s);
    data[s] = entries.map(({ key, value }) => ({ k: key, v: value }));
  }
  // Carry over preferences but never the API key (keep secrets out of backups).
  const settings = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('lt:') && k !== 'lt:ai-key' && k !== 'lt:sidebar-collapsed') settings[k] = localStorage.getItem(k);
  }
  const payload = { app: 'learning-tracker', version: 1, exportedAt: new Date().toISOString(), data, settings };
  downloadText(`learning-tracker-backup-${localDay(new Date())}.json`, JSON.stringify(payload, null, 2), 'application/json');
  const totalItems = BACKUP_STORES.reduce((n, s) => n + data[s].length, 0);
  toast(`Backup downloaded · ${totalItems} items`, 'success');
}

async function importData(file) {
  let payload;
  try { payload = JSON.parse(await file.text()); } catch { toast('That file isn’t valid JSON', 'warn'); return; }
  if (payload.app !== 'learning-tracker' || !payload.data) { toast('Not a Learning Tracker backup', 'warn'); return; }
  const counts = BACKUP_STORES
    .map((s) => [(payload.data[s] || []).length, s])
    .filter(([n]) => n > 0)
    .map(([n, s]) => `${n} ${s}`)
    .join(', ') || 'no items';
  const ok = await confirmDialog({
    title: 'Restore from backup?',
    body: `This <strong>replaces</strong> your current progress, notes, cards, goals and stats with the backup (${escapeHtml(counts)}). Your course files aren’t affected.`,
    okLabel: 'Restore'
  });
  if (!ok) return;
  for (const s of BACKUP_STORES) {
    await idbClear(s);
    for (const { k, v } of (payload.data[s] || [])) await idbPut(s, k, v);
  }
  if (payload.settings) {
    for (const [k, val] of Object.entries(payload.settings)) {
      if (typeof k === 'string' && k.startsWith('lt:') && k !== 'lt:ai-key') localStorage.setItem(k, val);
    }
  }
  toast('Backup restored — reloading…', 'success');
  setTimeout(() => location.reload(), 900);
}

function expandVideoPath(video) {
  let path = '';
  for (const segment of video.hierarchy) {
    path = path ? `${path}/${segment}` : segment;
    state.expandedIds.add(path);
  }
}

// ── Now playing ──────────────────────────────────────────────────────────────
function renderNowPlaying() {
  if (!state.selectedVideo) {
    el.breadcrumb.textContent = 'Select a lesson';
    el.videoTitle.textContent = 'Ready to learn';
    renderVideoStats();
    return;
  }
  el.breadcrumb.textContent = state.selectedVideo.hierarchy.join('  ›  ');
  el.videoTitle.textContent = state.selectedVideo.title;
  renderVideoStats();
}

function renderVideoStats(extraMessage = '') {
  if (!state.selectedVideo) { el.videoStats.innerHTML = ''; el.resetLesson.hidden = true; return; }
  const v = state.selectedVideo;
  const status = v.progress.completed ? 'Completed' : v.progress.startedAt ? 'In progress' : 'Not started';
  const pills = [
    pill(status, v.progress.completed ? 'good' : v.progress.startedAt ? 'warn' : ''),
    pill(`${Math.round(v.progress.percent || 0)}%`),
    pill(v.ext.toUpperCase().slice(1), v.playableHint === 'likely' ? 'good' : 'warn')
  ];
  if (extraMessage) pills.push(pill(extraMessage, 'bad'));
  el.videoStats.innerHTML = pills.join('');
  el.resetLesson.hidden = !(v.progress.startedAt || v.progress.percent > 0 || v.progress.completed);
}

// ── Playback ─────────────────────────────────────────────────────────────────
function attemptPlayback() {
  if (!state.pendingAutoplay || !state.selectedVideo) return;
  const promise = el.player.play();
  if (!promise) return;
  promise
    .then(() => { state.pendingAutoplay = false; updatePlayerControls(); scheduleControlsHide(); })
    .catch(() => {
      if (el.player.error) { state.pendingAutoplay = false; renderVideoStats('Needs codec/transcoder'); return; }
      renderVideoStats('Press play');
    });
}

function togglePlayback() {
  if (!state.selectedVideo || state.selectedVideo.kind === 'pdf') return;
  if (el.player.paused) { state.pendingAutoplay = true; attemptPlayback(); }
  else el.player.pause();
}

function playAdjacent(direction, autoplay) {
  const playlist = getActivePlaylist();
  if (!playlist.length) return;
  const index = playlist.findIndex((v) => v.id === state.selectedVideo?.id);
  const next  = playlist[index + direction];
  if (next) {
    selectVideo(next, { autoplay });
    if (direction === 1) toast(`Up next · ${next.title}`, 'info', 2500);
  }
}

function getActivePlaylist() {
  if (!state.library) return [];
  if (!state.selectedVideo) return state.library.videos;
  const course = findNodeById(state.library.courses, state.selectedVideo.hierarchy[0]);
  return course ? flattenVideos(course) : state.library.videos;
}

function flattenVideos(node) {
  const videos = [...(node.videos || [])];
  for (const child of node.children || []) videos.push(...flattenVideos(child));
  return videos;
}

async function toggleFullscreen() {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await el.playerStage.requestFullscreen();
}

// ── Player controls update ───────────────────────────────────────────────────
function updatePlayerControls() {
  const duration = getDuration();
  const current  = Number.isFinite(el.player.currentTime) ? el.player.currentTime : 0;
  updateTimeLabels(current, duration);
  updateSeekFill(current, duration);
  updateNoteAt();
  updateCardAt();
  updateActiveCue();

  el.seekSlider.value = String(duration ? Math.max(0, Math.min(1000, Math.round((current / duration) * 1000))) : 0);

  setButtonIcon(el.playToggle, el.player.paused ? 'play' : 'pause');
  el.playToggle.setAttribute('aria-label', el.player.paused ? 'Play' : 'Pause');
  setButtonIcon(el.muteToggle, el.player.muted || el.player.volume === 0 ? 'volume-x' : 'volume-2');
  el.volumeSlider.value = String(el.player.muted ? 0 : el.player.volume);
  el.speedSelect.value  = String(el.player.playbackRate || 1);
  updateVolumeFill();

  const playlist = getActivePlaylist();
  const index    = playlist.findIndex((v) => v.id === state.selectedVideo?.id);
  el.prevButton.disabled = index <= 0;
  el.nextButton.disabled = index < 0 || index >= playlist.length - 1;
}

function updateSeekFill(current, duration) {
  el.seekFill.style.width = `${duration ? Math.min(100, (current / duration) * 100) : 0}%`;
}

function updateBuffered() {
  const duration = getDuration();
  if (!duration || !el.player.buffered.length) return;
  const buffered = el.player.buffered.end(el.player.buffered.length - 1);
  el.seekBuffer.style.width = `${Math.min(100, (buffered / duration) * 100)}%`;
}

function updateVolumeFill() {
  el.volumeSlider.style.setProperty('--vol', `${(el.player.muted ? 0 : el.player.volume) * 100}%`);
}

function setButtonIcon(button, name) {
  const icon = button.querySelector('.icon');
  if (icon) icon.className = `icon icon-${name}`;
}

function updateTimeLabels(current, duration) {
  el.currentTime.textContent  = formatClock(current);
  el.durationTime.textContent = duration ? formatClock(duration) : '0:00';
}

function getDuration() {
  if (Number.isFinite(el.player.duration) && el.player.duration > 0) return el.player.duration;
  if (Number.isFinite(state.selectedVideo?.durationSeconds)) return state.selectedVideo.durationSeconds;
  return 0;
}

// ── Progress saving ──────────────────────────────────────────────────────────
function saveProgress(event, options = {}) {
  if (state.suppressSave) return;
  const video = state.selectedVideo;
  if (!video || !Number.isFinite(el.player.currentTime)) return;
  const now = Date.now();
  if (options.throttle && now - (video._lastProgressSaveAt || 0) < 5000) return;
  video._lastProgressSaveAt = now;

  const durationSeconds = getDuration();
  const resumeSeconds   = el.player.currentTime;
  const percent         = durationSeconds ? Math.min(100, (resumeSeconds / durationSeconds) * 100) : video.progress.percent;
  const wasCompleted    = video.progress.completed;
  const nowIso          = new Date().toISOString();

  const newPercent = Math.max(video.progress.percent || 0, percent || 0);
  const completed = video.progress.completed || event === 'ended' || newPercent >= 99;
  patchProgress(video.id, {
    startedAt: video.progress.startedAt || nowIso,
    lastWatchedAt: nowIso,
    completedAt: completed ? (video.progress.completedAt || nowIso) : video.progress.completedAt,
    resumeSeconds,
    watchSeconds: Math.max(video.progress.watchSeconds || 0, resumeSeconds),
    percent: newPercent,
    completed
  });
  db.saveProgress(video.id, { ...video.progress }).catch(() => {});

  if (!wasCompleted && video.progress.completed) {
    recordActivity({ completed: 1 });
    renderHero();
    evaluateAchievements();
    toast(`Completed · ${video.title}`, 'success', 3500);
    // If the user finished by reaching the end, the 'ended' handler offers the quiz.
    // If they completed early (e.g. scrubbed to ~end), offer a tappable quiz instead.
    if (event !== 'ended' && quizAvailableFor(video) && localStorage.getItem('lt:auto-quiz') !== '0') {
      toast('Quiz yourself on this lesson 🎓', 'info', 6000, () => startQuiz());
    }
  }

  renderVideoStats();
  if (options.renderList || event === 'pause' || event === 'ended') renderCurriculum();
}

// ── Filtering helpers ────────────────────────────────────────────────────────
function shouldExpand(node) {
  return state.expandedIds.has(node.id);
}

// Ids of nodes that have visible lessons under the current query + filter.
// Used to auto-expand matches on search/filter without forcing them open.
function nodesWithMatches() {
  const ids = new Set();
  const walk = (node, ancestorMatches) => {
    const selfMatches = ancestorMatches || !state.query || nameMatchesQuery(node, state.query);
    const hasVideos = node.videos.some(
      (v) => (selfMatches || videoMatchesQuery(v, state.query)) && videoMatchesFilter(v)
    );
    let childHas = false;
    for (const child of node.children || []) if (walk(child, selfMatches)) childHas = true;
    const visible = hasVideos || childHas;
    if (visible) ids.add(node.id);
    return visible;
  };
  for (const course of state.library?.courses ?? []) walk(course, false);
  return ids;
}

function videoMatchesFilter(v) {
  switch (state.filter) {
    case 'done':     return v.progress.completed;
    case 'progress': return !v.progress.completed && (Boolean(v.progress.startedAt) || v.progress.percent > 0);
    case 'new':      return !v.progress.completed && !v.progress.startedAt && !(v.progress.percent > 0);
    default:         return true;
  }
}

function nameMatchesQuery(node, query) {
  return node.name.toLowerCase().includes(query) || node.path.toLowerCase().includes(query);
}

function videoMatchesQuery(video, query) {
  return video.title.toLowerCase().includes(query) || video.hierarchy.join(' ').toLowerCase().includes(query);
}

function nodeContainsSelectedVideo(node) {
  if (!state.selectedVideo) return false;
  const nodePath = node.path || node.id;
  return state.selectedVideo.hierarchy.join('/').startsWith(nodePath);
}

function pill(text, tone = '') { return `<span class="pill ${tone}">${escapeHtml(text)}</span>`; }

function findNodeById(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findNodeById(node.children || [], id);
    if (child) return child;
  }
  return null;
}

function formatDuration(seconds, unknownCount = 0) {
  if (!Number.isFinite(seconds) || seconds <= 0) return unknownCount ? `${unknownCount} unknown` : '0m';
  const rounded = Math.round(seconds);
  const hours   = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const suffix  = unknownCount ? ` + ${unknownCount} ?` : '';
  return hours ? `${hours}h ${minutes}m${suffix}` : `${minutes}m${suffix}`;
}

function formatClock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    method:  options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body:    options.body ? JSON.stringify(options.body) : undefined
  });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return res.json();
}

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
function escapeAttr(value) { return escapeHtml(value); }
