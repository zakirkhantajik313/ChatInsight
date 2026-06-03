/* ══════════════════════════════════════════════════
   WhatsApp Chat Viewer — app.js
   Full client-side processing, no server needed
══════════════════════════════════════════════════ */

'use strict';

/* ──────────── STATE ──────────── */
let state = {
  rawMessages:  [],
  messages:     [],
  senders:      [],
  myName:       '',
  chatName:     '',
  dateMap:      {},
  searchQuery:  '',
  filterSender: '',
  calYear:      0,
  calMonth:     0,
  activeDates:  new Set(),
};

/* Palette for per-sender coloring in stats */
const SENDER_COLORS = [
  '#00a884', '#53bdeb', '#f0a500', '#e05d6f',
  '#7c6af7', '#43c59e', '#f77f6a', '#a78bfa',
];

/* ══════════════════════════════════════════════════
   SCREEN MANAGEMENT
══════════════════════════════════════════════════ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ══════════════════════════════════════════════════
   FILE UPLOAD HANDLING
══════════════════════════════════════════════════ */
const fileInput = document.getElementById('fileInput');
const dropZone  = document.getElementById('dropZone');

fileInput.addEventListener('change', e => {
  if (e.target.files[0]) processFile(e.target.files[0]);
});

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.txt')) processFile(file);
  else alert('Please drop a .txt WhatsApp export file.');
});

function processFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const text   = e.target.result;
    const parsed = parseWhatsApp(text);
    if (!parsed.length) {
      alert('Could not parse this file. Make sure it is a WhatsApp exported .txt chat.');
      return;
    }
    state.rawMessages = parsed;
    state.messages    = parsed;
    state.senders     = getSenders(parsed);
    state.chatName    = file.name.replace(/\.txt$/i, '');
    buildIdentityScreen();
    showScreen('identityScreen');
  };
  reader.readAsText(file, 'utf-8');
}

/* ══════════════════════════════════════════════════
   WHATSAPP PARSER
══════════════════════════════════════════════════ */
function parseWhatsApp(text) {
  const LINE_RE = /^(?:\[(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]|(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\s[-\u2013])\s*(.+)$/;

  const lines    = text.split(/\r?\n/);
  const messages = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m    = LINE_RE.exec(line);

    if (m) {
      const dateRaw = m[1] || m[3];
      const timeRaw = m[2] || m[4];
      const rest    = m[5];

      const colonIdx = rest.indexOf(':');
      let sender, body;

      if (colonIdx > -1 && colonIdx < 60) {
        sender = rest.slice(0, colonIdx).trim();
        body   = rest.slice(colonIdx + 1).trim();
      } else {
        sender = 'System';
        body   = rest.trim();
      }

      const date = normalizeDate(dateRaw);
      const type = detectType(body);
      messages.push({ date, time: timeRaw.trim(), sender, body, type, id: messages.length });
    } else if (messages.length > 0) {
      messages[messages.length - 1].body += '\n' + line;
    }
  }

  return messages;
}

function normalizeDate(raw) {
  const parts = raw.split(/[\/\.\-]/);
  if (parts.length !== 3) return raw;
  let [a, b, c] = parts;
  if (c.length <= 2 && a.length === 4) [a, b, c] = [b, c, a];
  if (c.length === 2) c = '20' + c;
  return `${a.padStart(2,'0')}/${b.padStart(2,'0')}/${c}`;
}

function detectType(body) {
  const b = body.toLowerCase().trim();

  if (b === '<media omitted>' || b === 'image omitted' || b === 'video omitted'
      || b === 'sticker omitted' || b === 'audio omitted' || b === 'gif omitted'
      || b === 'document omitted' || b.includes('<media omitted>')) return 'media';

  // Explicit missed-call strings from WhatsApp
  if (b === 'missed voice call' || b === 'missed video call' || b.includes('missed call'))
    return 'missed_call';

  // Named call events (voice call, video call) but NOT missed
  if (b === 'null' || b.includes('voice call') || b.includes('video call'))
    return 'call';

  // Empty body — could be a call or a missed call; we can't tell, so label ambiguously
  if (b === '') return 'call_ambiguous';

  return 'text';
}

/* ══════════════════════════════════════════════════
   IDENTITY SCREEN
══════════════════════════════════════════════════ */
function getSenders(messages) {
  const map = {};
  messages.forEach(m => {
    if (m.sender !== 'System') map[m.sender] = (map[m.sender] || 0) + 1;
  });
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

function buildIdentityScreen() {
  const list = document.getElementById('senderList');
  list.innerHTML = '';
  state.senders.forEach(({ name, count }) => {
    const item = document.createElement('div');
    item.className = 'sender-item';
    item.innerHTML = `
      <div class="sender-avatar">${name.charAt(0).toUpperCase()}</div>
      <div class="sender-detail">
        <strong>${escHtml(name)}</strong>
        <small>${count} message${count !== 1 ? 's' : ''}</small>
      </div>`;
    item.addEventListener('click', () => {
      document.querySelectorAll('.sender-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      state.myName = name;
    });
    list.appendChild(item);
  });

  if (state.senders.length > 0) {
    list.children[0].classList.add('selected');
    state.myName = state.senders[0].name;
  }
}

function loadChat() {
  if (!state.myName) { alert('Please select your name first.'); return; }

  state.activeDates = new Set(state.rawMessages.map(m => m.date));

  const sel = document.getElementById('filterSender');
  sel.innerHTML = '<option value="">Everyone</option>';
  state.senders.forEach(({ name }) => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    sel.appendChild(opt);
  });

  document.getElementById('chatName').textContent = state.chatName;
  document.getElementById('chatInfo').textContent =
    `${state.senders.length} participants · ${state.rawMessages.length} messages`;

  buildStats();
  applyFilters();
  showScreen('appScreen');
  document.getElementById('appScreen').classList.add('active');

  // Init calendar to the last date with messages
  if (state.activeDates.size) {
    const dates = [...state.activeDates].sort();
    const last  = dates[dates.length - 1].split('/');
    state.calMonth = parseInt(last[1]) - 1;
    state.calYear  = parseInt(last[2]);
  } else {
    const today    = new Date();
    state.calYear  = today.getFullYear();
    state.calMonth = today.getMonth();
  }

  setupScrollToBottom();
}

/* ══════════════════════════════════════════════════
   FILTERING & SEARCH
══════════════════════════════════════════════════ */
function onSearch() {
  state.searchQuery = document.getElementById('searchInput').value.trim();
  applyFilters();
}

function onMobileSearch() {
  state.searchQuery = document.getElementById('mobileSearchInput').value.trim();
  document.getElementById('searchInput').value = state.searchQuery;
  applyFilters();
}

function onFilter() {
  state.filterSender = document.getElementById('filterSender').value;
  applyFilters();
}

function applyFilters() {
  let msgs = state.rawMessages;

  if (state.filterSender) {
    msgs = msgs.filter(m => m.sender === state.filterSender);
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    msgs = msgs.filter(m =>
      m.body.toLowerCase().includes(q) || m.sender.toLowerCase().includes(q)
    );
  }

  state.messages = msgs;
  renderChat();
}

/* ══════════════════════════════════════════════════
   RENDER CHAT
══════════════════════════════════════════════════ */

/*
  Call label helper
  ─────────────────
  'call'          → a named call event (voice/video call text present)   → "Call"
  'missed_call'   → WhatsApp explicitly said "Missed voice/video call"   → "Missed Call"
  'call_ambiguous'→ empty body; could be either                          → "Call / Missed Call"
*/
function callLabel(msg) {
  if (msg.type === 'missed_call')   return 'Missed Call';
  if (msg.type === 'call_ambiguous') return 'Call / Missed Call';
  // type === 'call' with an actual body string (e.g. "voice call" text)
  return msg.body.trim() !== '' ? escHtml(msg.body) : 'Call';
}

function renderChat() {
  const container = document.getElementById('chatMessages');
  container.innerHTML = '';
  state.dateMap = {};

  if (!state.messages.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="big-icon">🔍</div>
      <p>No messages found</p></div>`;
    updateSearchCount(0);
    return;
  }

  updateSearchCount(state.messages.length);

  let lastDate   = null;
  let lastSender = null;

  state.messages.forEach((msg) => {
    if (msg.date !== lastDate) {
      const sep = document.createElement('div');
      sep.className = 'date-separator';
      sep.id = `date-${msg.date.replace(/\//g, '-')}`;
      sep.innerHTML = `<span class="date-separator-label">${formatDateLabel(msg.date)}</span>`;
      container.appendChild(sep);
      state.dateMap[msg.date] = sep;
      lastDate   = msg.date;
      lastSender = null;
    }

    if (msg.sender === 'System') {
      const div = document.createElement('div');
      div.className = 'msg-system';
      div.textContent = msg.body;
      container.appendChild(div);
      lastSender = null;
      return;
    }

    const isOut        = msg.sender === state.myName;
    const isGroupStart = msg.sender !== lastSender;

    const row = document.createElement('div');
    row.className = `msg-row ${isOut ? 'out' : 'in'}${isGroupStart ? ' group-start' : ''}`;
    row.dataset.msgId = msg.id;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    let innerHtml = '';

    if (!isOut && isGroupStart) {
      innerHtml += `<div class="msg-sender">${escHtml(msg.sender)}</div>`;
    }

    let bodyHtml = escHtml(msg.body);
    if (state.searchQuery) bodyHtml = highlightText(bodyHtml, state.searchQuery);

    if (msg.type === 'media') {
      innerHtml += `<div class="msg-text msg-media">Media</div>`;
    } else if (msg.type === 'call' || msg.type === 'missed_call' || msg.type === 'call_ambiguous') {
      innerHtml += `<div class="msg-text msg-call">${callLabel(msg)}</div>`;
    } else {
      innerHtml += `<div class="msg-text">${bodyHtml}</div>`;
    }

    innerHtml += `<div class="msg-meta"><span class="msg-time">${msg.time}</span></div>`;

    bubble.innerHTML = innerHtml;
    row.appendChild(bubble);
    container.appendChild(row);

    lastSender = msg.sender;
  });

  container.scrollTop = container.scrollHeight;
  updateScrollBottomBtn();
}

function updateSearchCount(total) {
  const txt = state.searchQuery ? `${total}` : '';
  document.getElementById('searchCount').textContent       = txt;
  document.getElementById('mobileSearchCount').textContent = txt;
}

function highlightText(html, query) {
  const re = new RegExp(`(${escRegex(query)})`, 'gi');
  return html.replace(re, '<span class="highlight">$1</span>');
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function formatDateLabel(dateStr) {
  const [d, mo, y] = dateStr.split('/').map(Number);
  const date  = new Date(y, mo - 1, d);
  const today = new Date(); today.setHours(0,0,0,0);
  const yest  = new Date(today); yest.setDate(today.getDate() - 1);
  if (+date === +today) return 'Today';
  if (+date === +yest)  return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

/* ══════════════════════════════════════════════════
   SCROLL-TO-BOTTOM FAB
══════════════════════════════════════════════════ */
function setupScrollToBottom() {
  const container = document.getElementById('chatMessages');
  const btn       = document.getElementById('scrollBottomBtn');

  container.addEventListener('scroll', () => {
    const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    btn.style.display = distFromBottom > 120 ? 'flex' : 'none';
  });
}

function updateScrollBottomBtn() {
  const container = document.getElementById('chatMessages');
  const btn       = document.getElementById('scrollBottomBtn');
  const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  btn.style.display = distFromBottom > 120 ? 'flex' : 'none';
}

function scrollToBottom() {
  const container = document.getElementById('chatMessages');
  container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  document.getElementById('scrollBottomBtn').style.display = 'none';
}

/* ══════════════════════════════════════════════════
   STATS — Engaging per-person analytics
══════════════════════════════════════════════════ */
function buildStats() {
  const msgs   = state.rawMessages.filter(m => m.sender !== 'System');
  const total  = msgs.length;
  const pCount = state.senders.length;
  const panel  = document.getElementById('statsPanel');

  /* ── Overview tiles ── */
  const uniqueDates = new Set(msgs.map(m => m.date)).size;
  const overviewHtml = `
    <div class="stat-overview">
      <div class="stat-tile">
        <div class="stat-tile-val">${fmtNum(total)}</div>
        <div class="stat-tile-label">Messages</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-val">${pCount}</div>
        <div class="stat-tile-label">People</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-val">${uniqueDates}</div>
        <div class="stat-tile-label">Days</div>
      </div>
    </div>`;

  /* ── Donut chart (SVG) ── */
  const donutR  = 28;
  const donutC  = 2 * Math.PI * donutR;
  let donutSegments = '';
  let donutOffset   = 0;
  const legendItems = state.senders.slice(0, 5).map(({ name, count }, i) => {
    const pct   = count / total;
    const color = SENDER_COLORS[i % SENDER_COLORS.length];
    const dash  = pct * donutC;
    donutSegments += `
      <circle r="${donutR}" cx="36" cy="36"
        fill="none" stroke="${color}" stroke-width="10"
        stroke-dasharray="${dash.toFixed(2)} ${(donutC - dash).toFixed(2)}"
        style="stroke-dashoffset: -${(donutOffset * donutC).toFixed(2)}"/>`;
    donutOffset += pct;
    return { name, pct, color, count };
  });

  const donutHtml = `
    <div class="stat-donut-wrap">
      <div class="stat-donut">
        <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
          <circle r="${donutR}" cx="36" cy="36" fill="none"
            stroke="rgba(255,255,255,.06)" stroke-width="10"/>
          ${donutSegments}
        </svg>
      </div>
      <div class="stat-donut-legend">
        ${legendItems.map(({ name, pct, color }) => `
          <div class="donut-legend-item">
            <div class="donut-legend-dot" style="background:${color}"></div>
            <span class="donut-legend-name">${escHtml(name)}</span>
            <span class="donut-legend-pct" style="color:${color}">${Math.round(pct * 100)}%</span>
          </div>`).join('')}
      </div>
    </div>`;

  /* ── Per-sender animated bars ── */
  const maxCount = state.senders[0]?.count || 1;
  const barsHtml = `
    <div class="sender-bars">
      ${state.senders.map(({ name, count }, i) => {
        const color = SENDER_COLORS[i % SENDER_COLORS.length];
        const pct   = Math.round((count / total) * 100);
        const width = Math.round((count / maxCount) * 100);
        return `
          <div class="sender-bar-item">
            <div class="sender-bar-header">
              <span class="sender-bar-name">${escHtml(name)}</span>
              <div class="sender-bar-meta">
                <span class="sender-bar-count">${fmtNum(count)}</span>
                <span class="sender-bar-pct" style="color:${color}">${pct}%</span>
              </div>
            </div>
            <div class="sender-bar-track">
              <div class="sender-bar-fill"
                style="width:0%; background: linear-gradient(90deg, ${color}99, ${color});"
                data-target="${width}">
              </div>
            </div>
          </div>`;
      }).join('')}
    </div>`;

  panel.innerHTML = overviewHtml + donutHtml + barsHtml;

  /* Animate bars in after a frame */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      panel.querySelectorAll('.sender-bar-fill').forEach(el => {
        el.style.width = el.dataset.target + '%';
      });
    });
  });

  /* ── Most active days ── */
  const dayMap = {};
  msgs.forEach(m => { dayMap[m.date] = (dayMap[m.date] || 0) + 1; });
  const topDays = Object.entries(dayMap).sort((a, b) => b[1] - a[1]).slice(0, 7);

  document.getElementById('activeDays').innerHTML = topDays.map(([date, cnt]) =>
    `<div class="active-day-row">
      <span class="active-day-date">${formatDateLabel(date)}</span>
      <span class="active-day-count">${cnt}</span>
    </div>`).join('');
}

function fmtNum(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}

/* ══════════════════════════════════════════════════
   SIDEBAR TOGGLE
══════════════════════════════════════════════════ */
let sidebarOpen = true;

document.getElementById('toggleSidebar').addEventListener('click', toggleSidebar);

function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  const sb  = document.getElementById('sidebar');
  const btn = document.getElementById('toggleSidebar');
  const fab = document.getElementById('sidebarFab');
  sb.classList.toggle('collapsed', !sidebarOpen);
  btn.textContent = sidebarOpen ? '◀' : '▶';
  if (fab) fab.style.display = sidebarOpen ? 'none' : 'flex';
}

/* ══════════════════════════════════════════════════
   MOBILE SEARCH TOGGLE
══════════════════════════════════════════════════ */
let mobileSearchVisible = false;

function toggleSearch() {
  mobileSearchVisible = !mobileSearchVisible;
  const ms = document.getElementById('mobileSearch');
  ms.classList.toggle('open', mobileSearchVisible);
  if (mobileSearchVisible) {
    document.getElementById('mobileSearchInput').focus();
  } else {
    document.getElementById('mobileSearchInput').value = '';
    state.searchQuery = '';
    document.getElementById('searchInput').value = '';
    applyFilters();
  }
}

/* ══════════════════════════════════════════════════
   CALENDAR — Drum-roll month/year pickers
══════════════════════════════════════════════════ */
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

function openCalendar() {
  renderDrums();
  renderCalendar();
  document.getElementById('calendarOverlay').classList.remove('hidden');
}

function closeCalendar(e) {
  if (!e || e.target === document.getElementById('calendarOverlay')) {
    document.getElementById('calendarOverlay').classList.add('hidden');
  }
}

function animateDrum(id, direction) {
  const el  = document.getElementById(id);
  const cls = direction > 0 ? 'slide-up' : 'slide-down';
  el.classList.remove('slide-up', 'slide-down');
  void el.offsetWidth;
  el.classList.add(cls);
}

function renderDrums() {
  document.getElementById('monthDrum').textContent = MONTH_NAMES[state.calMonth];
  document.getElementById('yearDrum').textContent  = state.calYear;
}

function calPickerNav(type, dir) {
  if (type === 'month') {
    animateDrum('monthDrum', dir);
    state.calMonth += dir;
    if (state.calMonth > 11) { state.calMonth = 0;  state.calYear++; animateDrum('yearDrum', 1); }
    if (state.calMonth < 0)  { state.calMonth = 11; state.calYear--; animateDrum('yearDrum', -1); }
  } else {
    animateDrum('yearDrum', dir);
    state.calYear += dir;
  }
  renderDrums();
  renderCalendar();
}

function renderCalendar() {
  const { calYear: y, calMonth: mo } = state;
  const grid     = document.getElementById('calGrid');
  const firstDay = new Date(y, mo, 1).getDay();
  const daysInMo = new Date(y, mo + 1, 0).getDate();
  const today    = new Date();
  const todayStr = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;

  let html = '';
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-cell empty"></div>`;
  for (let d = 1; d <= daysInMo; d++) {
    const dateStr = `${String(d).padStart(2,'0')}/${String(mo+1).padStart(2,'0')}/${y}`;
    const hasMsg  = state.activeDates.has(dateStr);
    const isToday = dateStr === todayStr;
    const cls     = `cal-cell ${hasMsg ? 'active' : 'inactive'}${isToday ? ' today' : ''}`;
    const onclick = hasMsg ? `jumpToDate('${dateStr}')` : '';
    html += `<div class="${cls}" ${onclick ? `onclick="${onclick}"` : ''}>${d}</div>`;
  }
  grid.innerHTML = html;
}

function jumpToDate(dateStr) {
  closeCalendar();
  state.filterSender = '';
  state.searchQuery  = '';
  document.getElementById('filterSender').value = '';
  document.getElementById('searchInput').value  = '';
  applyFilters();

  setTimeout(() => {
    const el = state.dateMap[dateStr];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);
}

/* ══════════════════════════════════════════════════
   RESET
══════════════════════════════════════════════════ */
function resetApp() {
  state = {
    rawMessages: [], messages: [], senders: [],
    myName: '', chatName: '', dateMap: {},
    searchQuery: '', filterSender: '',
    calYear: 0, calMonth: 0, activeDates: new Set(),
  };
  document.getElementById('fileInput').value            = '';
  document.getElementById('searchInput').value          = '';
  document.getElementById('chatMessages').innerHTML     = '';
  document.getElementById('appScreen').classList.remove('active');
  document.getElementById('scrollBottomBtn').style.display = 'none';

  mobileSearchVisible = false;
  document.getElementById('mobileSearch').classList.remove('open');
  document.getElementById('mobileSearchInput').value = '';

  sidebarOpen = true;
  document.getElementById('sidebar').classList.remove('collapsed');
  const fab = document.getElementById('sidebarFab');
  if (fab) fab.style.display = 'none';

  showScreen('uploadScreen');
}
function toggleTheme() {
    document.body.classList.toggle("light-mode");
}