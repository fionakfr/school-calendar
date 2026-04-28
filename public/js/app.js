/* ── State ── */
let currentUser = null;
let events = [];
let currentDate = new Date();
let currentView = 'month';
let selectedType = null;

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/* ── Boot ── */
async function init() {
  const res = await fetch('/auth/me');
  if (!res.ok) { location.href = '/'; return; }
  currentUser = await res.json();
  document.getElementById('user-name').textContent = currentUser.name || currentUser.email;
  await loadEvents();
  renderView();
  bindUI();
}

/* ── Data ── */
async function loadEvents() {
  const res = await fetch('/api/events');
  if (!res.ok) return;
  events = await res.json();
  updateStats();
}

function updateStats() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const thisMonth = events.filter(e => {
    const d = new Date(e.start_date);
    return d.getFullYear() === y && d.getMonth() === m;
  });
  document.getElementById('stat-available').textContent = thisMonth.filter(e => e.event_type === 'available').length;
  document.getElementById('stat-camps').textContent = thisMonth.filter(e => e.event_type === 'holiday_camp').length;
  document.getElementById('stat-playdates').textContent = thisMonth.filter(e => e.event_type === 'playdate').length;
  document.getElementById('stat-away').textContent = thisMonth.filter(e => e.event_type === 'away').length;
}

/* ── Render ── */
function renderView() {
  if (currentView === 'month') renderMonth();
  else renderList();
}

function renderMonth() {
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();
  document.getElementById('month-label').textContent = `${MONTHS[m]} ${y}`;
  document.getElementById('calendar-view').style.display = '';
  document.getElementById('list-view').style.display = 'none';

  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysInPrev = new Date(y, m, 0).getDate();
  const today = new Date();

  let html = `<div class="cal-grid">
    <div class="cal-weekdays">${WEEKDAYS.map(d => `<div class="cal-weekday">${d}</div>`).join('')}</div>
    <div class="cal-days">`;

  // Prev month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrev - i;
    html += `<div class="cal-day other-month"><span class="day-num">${day}</span><div class="day-events"></div></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayEvents = events.filter(e => e.start_date <= dateStr && e.end_date >= dateStr);

    const evHtml = dayEvents.slice(0, 3).map(e =>
      `<div class="day-event ev-${e.event_type}" data-id="${e.id}" onclick="openDetail(${e.id},event)">${e.title}</div>`
    ).join('') + (dayEvents.length > 3 ? `<div class="more-events">+${dayEvents.length - 3} more</div>` : '');

    html += `<div class="cal-day${isToday ? ' today' : ''}" data-date="${dateStr}" onclick="clickDay('${dateStr}',event)">
      <span class="day-num">${d}</span>
      <div class="day-events">${evHtml}</div>
    </div>`;
  }

  // Next month padding
  const total = firstDay + daysInMonth;
  const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= remaining; d++) {
    html += `<div class="cal-day other-month"><span class="day-num">${d}</span><div class="day-events"></div></div>`;
  }

  html += `</div></div>`;
  document.getElementById('calendar-view').innerHTML = html;
}

function renderList() {
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();
  document.getElementById('month-label').textContent = `${MONTHS[m]} ${y}`;
  document.getElementById('calendar-view').style.display = 'none';
  document.getElementById('list-view').style.display = '';

  const monthStr = `${y}-${String(m+1).padStart(2,'0')}`;
  const monthEvents = events.filter(e => e.start_date.startsWith(monthStr) || e.end_date.startsWith(monthStr));

  if (!monthEvents.length) {
    document.getElementById('list-view').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🗓️</div>
        <p>Nothing added for ${MONTHS[m]} yet.<br>Be the first to add something!</p>
      </div>`;
    return;
  }

  const html = monthEvents.map(e => {
    const start = new Date(e.start_date + 'T12:00:00');
    const isMine = e.user_id === currentUser.id;
    const typeLabel = { available: 'Free', holiday_camp: 'Holiday Camp', playdate: 'Playdate Request', away: 'Away' }[e.event_type];
    const dateRange = e.start_date === e.end_date
      ? formatDate(e.start_date)
      : `${formatDate(e.start_date)} – ${formatDate(e.end_date)}`;

    let rsvpHtml = '';
    if (e.event_type === 'playdate') {
      const myRsvp = e.my_rsvp;
      rsvpHtml = `
        <div class="rsvp-group">
          <button class="rsvp-btn ${myRsvp === 'yes' ? 'active-yes' : ''}" onclick="rsvp(${e.id},'yes',event)">✓ Yes</button>
          <button class="rsvp-btn ${myRsvp === 'maybe' ? 'active-maybe' : ''}" onclick="rsvp(${e.id},'maybe',event)">? Maybe</button>
          <button class="rsvp-btn ${myRsvp === 'no' ? 'active-no' : ''}" onclick="rsvp(${e.id},'no',event)">✕ No</button>
        </div>
        <div class="rsvp-counts">✓ ${e.rsvp_yes || 0} going · ? ${e.rsvp_maybe || 0} maybe
          <a href="#" style="color:var(--purple);font-size:11px;margin-left:6px;" onclick="openRsvpList(${e.id},event)">see all</a>
        </div>`;
    }

    return `<div class="event-card ${e.event_type}">
      <div class="event-date-col">
        <div class="event-day">${start.getDate()}</div>
        <div class="event-month">${MONTHS[start.getMonth()].slice(0,3)}</div>
      </div>
      <div class="event-body">
        <div class="event-title">${escHtml(e.title)}</div>
        <div class="event-meta">${dateRange} · ${escHtml(e.user_name)}</div>
        ${e.description ? `<div class="event-desc">${escHtml(e.description)}</div>` : ''}
        <span class="event-badge badge-${e.event_type}">${typeLabel}</span>
        ${rsvpHtml}
      </div>
      <div class="event-actions">
        ${isMine ? `<button class="btn btn-danger btn-sm" onclick="deleteEvent(${e.id},event)">Delete</button>` : ''}
      </div>
    </div>`;
  }).join('');

  document.getElementById('list-view').innerHTML = `<div class="list-view">${html}</div>`;
}

/* ── Helpers ── */
function formatDate(str) {
  const d = new Date(str + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* ── Actions ── */
function clickDay(dateStr, e) {
  if (e.target.closest('.day-event')) return;
  openAddModal(dateStr);
}

function openAddModal(prefillDate) {
  const today = prefillDate || isoDate(new Date());
  document.getElementById('ev-start').value = today;
  document.getElementById('ev-end').value = today;
  document.getElementById('ev-title').value = '';
  document.getElementById('ev-desc').value = '';
  document.getElementById('add-error').style.display = 'none';
  selectType(null);
  document.getElementById('add-modal').classList.add('open');
}

function selectType(type) {
  selectedType = type;
  document.querySelectorAll('.type-option').forEach(btn => {
    btn.classList.remove('selected-available','selected-holiday_camp','selected-playdate');
    if (btn.dataset.type === type) btn.classList.add(`selected-${type}`);
  });
}

async function saveEvent() {
  const title = document.getElementById('ev-title').value.trim();
  const description = document.getElementById('ev-desc').value.trim();
  const start_date = document.getElementById('ev-start').value;
  const end_date = document.getElementById('ev-end').value;
  const errEl = document.getElementById('add-error');

  if (!selectedType) { errEl.textContent = 'Please choose a type.'; errEl.style.display = 'block'; return; }
  if (!title) { errEl.textContent = 'Please add a title.'; errEl.style.display = 'block'; return; }
  if (!start_date || !end_date) { errEl.textContent = 'Please choose dates.'; errEl.style.display = 'block'; return; }

  const btn = document.getElementById('save-event-btn');
  btn.disabled = true; btn.textContent = 'Saving…';

  const res = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, start_date, end_date, event_type: selectedType }),
  });
  const data = await res.json();
  btn.disabled = false; btn.textContent = 'Save';

  if (!res.ok) { errEl.textContent = data.error || 'Failed to save.'; errEl.style.display = 'block'; return; }

  document.getElementById('add-modal').classList.remove('open');
  await loadEvents();
  renderView();
}

async function deleteEvent(id, e) {
  e.stopPropagation();
  if (!confirm('Delete this event?')) return;
  const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
  if (res.ok) { await loadEvents(); renderView(); }
}

async function rsvp(eventId, response, e) {
  e.stopPropagation();
  await fetch(`/api/events/${eventId}/rsvp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response }),
  });
  await loadEvents();
  renderView();
}

function openDetail(id, e) {
  e.stopPropagation();
  const ev = events.find(x => x.id === id);
  if (!ev) return;
  const typeLabel = { available: '🟢 Free', holiday_camp: '🏕️ Holiday Camp', playdate: '🎉 Playdate Request', away: '✈️ Away' }[ev.event_type];
  document.getElementById('detail-title').textContent = ev.title;
  const dateRange = ev.start_date === ev.end_date
    ? formatDate(ev.start_date)
    : `${formatDate(ev.start_date)} – ${formatDate(ev.end_date)}`;

  let body = `<p style="color:var(--gray-500);font-size:13px;margin-bottom:12px;">${typeLabel} · ${dateRange} · Added by ${escHtml(ev.user_name)}</p>`;
  if (ev.description) body += `<p style="margin-bottom:12px;">${escHtml(ev.description)}</p>`;

  if (ev.event_type === 'playdate') {
    body += `<div class="rsvp-group">
      <button class="rsvp-btn ${ev.my_rsvp === 'yes' ? 'active-yes' : ''}" onclick="rsvp(${ev.id},'yes',event);closeDetail()">✓ Yes</button>
      <button class="rsvp-btn ${ev.my_rsvp === 'maybe' ? 'active-maybe' : ''}" onclick="rsvp(${ev.id},'maybe',event);closeDetail()">? Maybe</button>
      <button class="rsvp-btn ${ev.my_rsvp === 'no' ? 'active-no' : ''}" onclick="rsvp(${ev.id},'no',event);closeDetail()">✕ No</button>
    </div>`;
  }

  document.getElementById('detail-body').innerHTML = body;
  document.getElementById('detail-modal').classList.add('open');
}

function closeDetail() {
  document.getElementById('detail-modal').classList.remove('open');
}

async function openRsvpList(eventId, e) {
  e.preventDefault(); e.stopPropagation();
  const ev = events.find(x => x.id === eventId);
  const res = await fetch(`/api/events/${eventId}/rsvps`);
  const rsvps = await res.json();

  document.getElementById('detail-title').textContent = `RSVPs – ${ev.title}`;
  const labelMap = { yes: 'Going', no: 'Can\'t make it', maybe: 'Maybe' };
  const badgeMap = { yes: 'rbadge-yes', no: 'rbadge-no', maybe: 'rbadge-maybe' };

  let body = rsvps.length
    ? `<div class="rsvp-list">${rsvps.map(r => `
        <div class="rsvp-row">
          <span class="rsvp-name">${escHtml(r.name)}</span>
          <span class="rsvp-badge ${badgeMap[r.response]}">${labelMap[r.response]}</span>
        </div>`).join('')}</div>`
    : `<p style="color:var(--gray-400);text-align:center;padding:20px 0;">No responses yet.</p>`;

  document.getElementById('detail-body').innerHTML = body;
  document.getElementById('detail-modal').classList.add('open');
}

/* ── UI bindings ── */
function bindUI() {
  document.getElementById('prev-btn').onclick = () => { currentDate.setMonth(currentDate.getMonth() - 1); renderView(); };
  document.getElementById('next-btn').onclick = () => { currentDate.setMonth(currentDate.getMonth() + 1); renderView(); };
  document.getElementById('today-btn').onclick = () => { currentDate = new Date(); renderView(); };

  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentView = tab.dataset.view;
      renderView();
    };
  });

  document.getElementById('fab-btn').onclick = () => openAddModal();
  document.getElementById('add-event-sidebar').onclick = () => openAddModal();
  document.getElementById('close-add-modal').onclick = () => document.getElementById('add-modal').classList.remove('open');
  document.getElementById('close-detail-modal').onclick = closeDetail;
  document.getElementById('save-event-btn').onclick = saveEvent;

  document.querySelectorAll('.type-option').forEach(btn => {
    btn.onclick = () => selectType(btn.dataset.type);
  });

  // Auto-set end date when start changes
  document.getElementById('ev-start').onchange = (e) => {
    if (!document.getElementById('ev-end').value || document.getElementById('ev-end').value < e.target.value) {
      document.getElementById('ev-end').value = e.target.value;
    }
  };

  // Close modals on overlay click
  document.getElementById('add-modal').onclick = (e) => { if (e.target.id === 'add-modal') e.target.classList.remove('open'); };
  document.getElementById('detail-modal').onclick = (e) => { if (e.target.id === 'detail-modal') e.target.classList.remove('open'); };

  document.getElementById('logout-btn').onclick = async () => {
    await fetch('/auth/logout', { method: 'POST' });
    location.href = '/';
  };
}

init();
