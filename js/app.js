// ── Firebase config ──────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyC5H6W_fPa0nk3oB2kCXNQW4fs1jc0vOKk",
  authDomain:        "dance-timetable.firebaseapp.com",
  databaseURL:       "https://dance-timetable-default-rtdb.firebaseio.com",
  projectId:         "dance-timetable",
  storageBucket:     "dance-timetable.firebasestorage.app",
  messagingSenderId: "321760637093",
  appId:             "1:321760637093:web:105476ea59651764bc9d4c"
};

// ── State ─────────────────────────────────────────────────────────
let privateLesson    = {};
let firebaseReady    = false;
let db               = null;
let currentDay       = 'Monday';
let currentChild     = 'Aubree';
let currentView      = 'day';
let currentWeekOffset = 0;   // 0 = this week, -1 = last week, +1 = next week
let extraClasses     = {};   // user-added class names { key: { title } }
let deletedBuiltins  = {};   // deleted built-in class names { key: 'ClassName' }

// ── Init Firebase ─────────────────────────────────────────────────
function initFirebase() {
  try {
    if (FIREBASE_CONFIG.apiKey === "REPLACE_WITH_YOUR_API_KEY") {
      showSyncStatus("⚠️ Firebase not configured – private lessons won't sync", 4000);
      loadFromLocalStorage();
      return;
    }
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
    db.ref('privates').on('value', snapshot => {
      privateLesson = snapshot.val() || {};
      firebaseReady = true;
      render();
    });
    db.ref('extraClasses').on('value', snapshot => {
      extraClasses = snapshot.val() || {};
      render();
    });
    db.ref('deletedBuiltins').on('value', snapshot => {
      deletedBuiltins = snapshot.val() || {};
      render();
    });
    showSyncStatus("Connected – lessons will sync live", 2500);
  } catch (e) {
    console.error(e);
    showSyncStatus("⚠️ Firebase error – using local storage", 4000);
    loadFromLocalStorage();
  }
}

function loadFromLocalStorage() {
  try { privateLesson   = JSON.parse(localStorage.getItem('dance_privates') || '{}'); } catch { privateLesson   = {}; }
  try { extraClasses    = JSON.parse(localStorage.getItem('dance_extra')    || '{}'); } catch { extraClasses    = {}; }
  try { deletedBuiltins = JSON.parse(localStorage.getItem('dance_deleted')  || '{}'); } catch { deletedBuiltins = {}; }
  render();
}

function saveToLocalStorage() {
  localStorage.setItem('dance_privates', JSON.stringify(privateLesson));
}

function saveExtraClassesToLocalStorage() {
  localStorage.setItem('dance_extra', JSON.stringify(extraClasses));
}

function saveDeletedToLocalStorage() {
  localStorage.setItem('dance_deleted', JSON.stringify(deletedBuiltins));
}

// ── Display helpers ───────────────────────────────────────────────
function fmt(time24) {
  const [h, m] = time24.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12    = h % 12 || 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2,'0')}${suffix}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Time / duration builders ──────────────────────────────────────
// Start time options: 9am–10pm in 15-min steps
function buildTimeOptions() {
  const opts = ['<option value="">Select time…</option>'];
  for (let h = 9; h <= 22; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 22 && m > 0) break;
      const val = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      opts.push(`<option value="${val}">${fmt(val)}</option>`);
    }
  }
  return opts.join('');
}

// Duration options: 15 min → 2 hrs in 15-min steps
function buildDurationOptions() {
  return [
    [15,  '15 min'],
    [30,  '30 min'],
    [45,  '45 min'],
    [60,  '1 hr'],
    [75,  '1 hr 15'],
    [90,  '1 hr 30'],
    [105, '1 hr 45'],
    [120, '2 hrs'],
  ].map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
}

function addMinutes(time24, mins) {
  const [h, m] = time24.split(':').map(Number);
  const total  = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
}

function calcDuration(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

// ── Week helpers ──────────────────────────────────────────────────
const DAY_OFFSET = { Monday:0, Tuesday:1, Wednesday:2, Thursday:3, Friday:4, Saturday:5, Sunday:6 };

function getMondayOfWeek(offset = 0) {
  const now  = new Date();
  const dow  = now.getDay();                    // 0=Sun … 6=Sat
  const diff = dow === 0 ? -6 : 1 - dow;       // days back to Monday
  const mon  = new Date(now);
  mon.setDate(now.getDate() + diff + offset * 7);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function getDateForDay(dayName, weekStart) {
  const d = new Date(weekStart);
  d.setDate(weekStart.getDate() + (DAY_OFFSET[dayName] ?? 0));
  return d;
}

function toDateStr(date) {
  // YYYY-MM-DD in local time
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMondayOfDate(date) {
  const d   = new Date(date);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(monday) {
  const d = monday.getDate();
  const m = monday.getMonth() + 1;
  const y = String(monday.getFullYear()).slice(2);
  return `w/c ${d}/${m}/${y}`;
}

// ── Misc helpers ──────────────────────────────────────────────────
function sortedLessons(arr) {
  return [...arr].sort((a, b) => a.start.localeCompare(b.start));
}

function childPill(name) {
  return `<span class="pill ${name.toLowerCase()}">${name}</span>`;
}

// ── Render ────────────────────────────────────────────────────────
function render() {
  if (currentView === 'day') renderDayView();
  else                       renderChildView();
  renderManageModal();
}

function updateWeekUI() {
  const weekStart = getMondayOfWeek(currentWeekOffset);
  document.getElementById('week-label').textContent = formatWeekLabel(weekStart);
  // Update each tab label to show "Mon 23" etc.
  document.querySelectorAll('#day-tabs .tab').forEach(tab => {
    const date = getDateForDay(tab.dataset.day, weekStart);
    tab.textContent = `${tab.dataset.day.slice(0, 3)} ${date.getDate()}`;
  });
}

function renderDayView() {
  const weekStart = getMondayOfWeek(currentWeekOffset);
  const dayDate   = getDateForDay(currentDay, weekStart);
  const container = document.getElementById('day-content');
  const lessons   = getLessonsForDay(currentDay, null, dayDate);
  if (!lessons.length) {
    container.innerHTML = '<p class="empty">No lessons on this day.</p>';
    return;
  }
  container.innerHTML = sortedLessons(lessons).map(l => cardHTML(l)).join('');
  attachEditListeners(container);
}

function renderChildView() {
  const container = document.getElementById('child-content');
  const html = [];
  for (const day of DAYS) {
    // Child view shows recurring + all one-offs (no week filter — let user see them all)
    const lessons = getLessonsForDay(day, currentChild, null);
    if (!lessons.length) continue;
    html.push(`<div class="day-heading">${day}</div>`);
    html.push(...sortedLessons(lessons).map(l => cardHTML(l, true)));
  }
  if (!html.length) {
    container.innerHTML = '<p class="empty">No lessons found.</p>';
    return;
  }
  container.innerHTML = html.join('');
  attachEditListeners(container);
}

// weekDate = specific Date object for this slot; null = no date filter (child view)
function getLessonsForDay(day, filterChild = null, weekDate = null) {
  const fixed = SCHEDULE
    .filter(l => l.day === day && (filterChild ? l.children.includes(filterChild) : true))
    .map(l => ({ ...l, isPrivate: false }));

  const privs = Object.entries(privateLesson)
    .filter(([, l]) => {
      if (l.day !== day) return false;
      if (filterChild && l.child !== filterChild) return false;
      if (l.recurring === false) {
        if (weekDate === null) return true;            // child view — show all
        return l.date === toDateStr(weekDate);         // day view — exact date match
      }
      if (l.recurring === 'biweekly') {
        if (weekDate === null) return true;            // child view — show all
        const anchor      = getMondayOfDate(new Date(l.startDate + 'T00:00:00'));
        const current     = getMondayOfWeek(currentWeekOffset);
        const diffWeeks   = Math.round((current - anchor) / (7 * 24 * 60 * 60 * 1000));
        return diffWeeks >= 0 && diffWeeks % 2 === 0;
      }
      return true;  // weekly (or legacy true) — always shows
    })
    .map(([id, l]) => ({
      id,
      day:       l.day,
      start:     l.start,
      end:       l.end,
      title:     l.desc,
      children:  [l.child],
      isPrivate: true,
      recurring: l.recurring,               // preserve 'weekly' | 'biweekly' | false
      date:      l.date || null,
    }));

  return [...fixed, ...privs];
}

function cardHTML(lesson, hideChildren = false) {
  const isMulti     = lesson.children.length > 1;
  const borderClass = isMulti ? 'multi' : lesson.children[0]?.toLowerCase();
  const stripeStyle = isMulti
    ? `style="--stripe: linear-gradient(to bottom, ${lesson.children.map(c => `var(--${c.toLowerCase()})`).join(', ')})"`
    : '';

  const pills       = hideChildren ? '' : `<div class="card-children">${lesson.children.map(childPill).join('')}</div>`;
  const privBadge     = lesson.isPrivate ? `<span class="badge-private">Private</span>` : '';
  const biweeklyBadge = (lesson.isPrivate && lesson.recurring === 'biweekly')
    ? `<span class="badge-biweekly">Bi-weekly</span>` : '';
  const oneoffBadge   = (lesson.isPrivate && lesson.recurring === false && lesson.date)
    ? `<span class="badge-oneoff">📅 ${formatDate(lesson.date)}</span>` : '';
  const editBtn       = lesson.isPrivate
    ? `<button class="btn-edit" data-id="${lesson.id}" title="Edit">✏️</button>` : '';

  return `
  <div class="card ${borderClass} ${lesson.isPrivate ? 'private' : ''}" ${stripeStyle}>
    <div class="card-time">
      <div class="start">${fmt(lesson.start)}</div>
      <div class="end">${fmt(lesson.end)}</div>
    </div>
    <div class="card-body">
      <div class="card-title">${lesson.title}${privBadge}${biweeklyBadge}${oneoffBadge}</div>
      ${pills}
    </div>
    ${editBtn}
  </div>`;
}

function attachEditListeners(container) {
  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.id));
  });
}

// ── Class pool ────────────────────────────────────────────────────
function getClassPool() {
  const deletedSet = new Set(Object.values(deletedBuiltins));
  const titles = new Set();
  SCHEDULE.forEach(l => { if (!deletedSet.has(l.title)) titles.add(l.title); });
  Object.values(extraClasses).forEach(c => { if (c.title) titles.add(c.title); });
  return [...titles].sort();
}

function updateDescOptions(child, currentVal = '') {
  const sel     = document.getElementById('p-desc');
  const classes = getClassPool();
  const opts    = ['<option value="">Select class…</option>'];
  classes.forEach(t => opts.push(`<option value="${t}"${t === currentVal ? ' selected' : ''}>${t}</option>`));
  if (currentVal && !classes.includes(currentVal)) {
    opts.push(`<option value="${currentVal}" selected>${currentVal}</option>`);
  }
  sel.innerHTML = opts.join('');
}

// ── Modal ─────────────────────────────────────────────────────────
function setLessonType(type) {
  document.getElementById('type-weekly').classList.toggle('active',    type === 'weekly');
  document.getElementById('type-biweekly').classList.toggle('active',  type === 'biweekly');
  document.getElementById('type-oneoff').classList.toggle('active',    type === 'oneoff');
  const dateRow   = document.getElementById('date-row');
  const dateInput = document.getElementById('p-date');
  dateRow.style.display = type === 'oneoff' ? 'flex' : 'none';
  dateInput.required    = type === 'oneoff';
  // Auto-fill date with the currently viewed day when switching to one-off
  if (type === 'oneoff' && !dateInput.value) {
    if (currentView === 'day') {
      const weekStart = getMondayOfWeek(currentWeekOffset);
      dateInput.value = toDateStr(getDateForDay(currentDay, weekStart));
    } else {
      dateInput.value = toDateStr(new Date());
    }
  }
}

function openModal(editId = null) {
  const overlay  = document.getElementById('modal-overlay');
  const titleEl  = document.getElementById('modal-title');
  const delBtn   = document.getElementById('btn-delete');
  const editIdEl = document.getElementById('edit-id');

  if (editId) {
    const l = privateLesson[editId];
    titleEl.textContent = 'Edit Lesson';
    editIdEl.value      = editId;
    document.getElementById('p-child').value = l.child;
    document.getElementById('p-day').value   = l.day;
    document.getElementById('p-start').value = l.start;
    // Show duration derived from stored start/end
    const dur = calcDuration(l.start, l.end);
    document.getElementById('p-duration').value = String(dur);
    updateDescOptions(l.child, l.desc);
    setLessonType(l.recurring === false ? 'oneoff' : l.recurring === 'biweekly' ? 'biweekly' : 'weekly');
    document.getElementById('p-date').value  = l.date || '';
    delBtn.style.display = 'inline-block';
  } else {
    titleEl.textContent = 'Add Lesson';
    editIdEl.value      = '';
    document.getElementById('private-form').reset();
    // Default duration to 1 hr
    document.getElementById('p-duration').value = '60';
    setLessonType('weekly');
    document.getElementById('p-date').value = '';
    if (currentView === 'day')   document.getElementById('p-day').value   = currentDay;
    if (currentView === 'child') document.getElementById('p-child').value = currentChild;
    updateDescOptions();
    delBtn.style.display = 'none';
  }
  overlay.classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

// ── Firebase save / delete ────────────────────────────────────────
function savePrivate(data, id = null) {
  if (db) {
    const ref = id ? db.ref(`privates/${id}`) : db.ref('privates').push();
    ref.set(data).catch(console.error);
  } else {
    const key = id || ('local_' + Date.now());
    privateLesson[key] = data;
    saveToLocalStorage();
    render();
  }
}

function deletePrivate(id) {
  if (db) {
    db.ref(`privates/${id}`).remove().catch(console.error);
  } else {
    delete privateLesson[id];
    saveToLocalStorage();
    render();
  }
}

// ── Extra class library helpers ───────────────────────────────────
function addExtraClass(title) {
  title = title.trim();
  if (!title) return;
  // If it was a deleted built-in, restore it instead of adding as extra
  const deletedEntry = Object.entries(deletedBuiltins).find(([, t]) => t === title);
  if (deletedEntry) {
    if (db) {
      db.ref(`deletedBuiltins/${deletedEntry[0]}`).remove().catch(console.error);
    } else {
      delete deletedBuiltins[deletedEntry[0]];
      saveDeletedToLocalStorage();
      render();
    }
    return;
  }
  if (getClassPool().includes(title)) return;
  const data = { title };
  if (db) {
    db.ref('extraClasses').push().set(data).catch(console.error);
  } else {
    extraClasses['local_ec_' + Date.now()] = data;
    saveExtraClassesToLocalStorage();
    render();
  }
}

function deleteExtraClass(id) {
  if (db) {
    db.ref(`extraClasses/${id}`).remove().catch(console.error);
  } else {
    delete extraClasses[id];
    saveExtraClassesToLocalStorage();
    render();
  }
}

function deleteClass(title) {
  // Check if it's a user-added extra class
  const extraEntry = Object.entries(extraClasses).find(([, c]) => c.title === title);
  if (extraEntry) {
    deleteExtraClass(extraEntry[0]);
  } else {
    // It's a built-in — mark as deleted
    if (db) {
      db.ref('deletedBuiltins').push().set(title).catch(console.error);
    } else {
      deletedBuiltins['local_db_' + Date.now()] = title;
      saveDeletedToLocalStorage();
      render();
    }
  }
}

function showSyncStatus(msg, duration = 2000) {
  const el = document.getElementById('sync-status');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

// ── Manage Class Library modal ────────────────────────────────────
function renderManageModal() {
  const overlay = document.getElementById('manage-overlay');
  if (!overlay || !overlay.classList.contains('open')) return;
  const container = document.getElementById('manage-content');

  const pool = getClassPool();

  if (!pool.length) {
    container.innerHTML = '<p class="empty">No classes in library. Add one below.</p>';
    return;
  }

  container.innerHTML = pool.map(title => `
    <div class="manage-class-row">
      <span class="manage-class-name">${title}</span>
      <button class="manage-btn remove" data-title="${title}" title="Remove">✕</button>
    </div>`).join('');

  container.querySelectorAll('.manage-btn.remove').forEach(btn => {
    btn.addEventListener('click', () => deleteClass(btn.dataset.title));
  });
}

function openManageModal() {
  document.getElementById('manage-overlay').classList.add('open');
  document.getElementById('new-class-input').value = '';
  renderManageModal();
}

function closeManageModal() {
  document.getElementById('manage-overlay').classList.remove('open');
}

// ── Event wiring ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Populate time & duration selects
  document.getElementById('p-start').innerHTML    = buildTimeOptions();
  document.getElementById('p-duration').innerHTML = buildDurationOptions();

  // Child selection → update allowed class list
  document.getElementById('p-child').addEventListener('change', () => {
    updateDescOptions(document.getElementById('p-child').value);
  });

  // Manage FAB
  document.getElementById('fab-manage').addEventListener('click', openManageModal);

  // Manage overlay: close on backdrop click
  document.getElementById('manage-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeManageModal();
  });

  // Manage close button
  document.getElementById('btn-manage-close').addEventListener('click', closeManageModal);

  // Add class via button or Enter key in the text input
  function submitNewClass() {
    const input = document.getElementById('new-class-input');
    addExtraClass(input.value);
    input.value = '';
  }
  document.getElementById('btn-add-class').addEventListener('click', submitNewClass);
  document.getElementById('new-class-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); submitNewClass(); }
  });

  // Type toggle
  document.getElementById('type-weekly').addEventListener('click',   () => setLessonType('weekly'));
  document.getElementById('type-biweekly').addEventListener('click', () => setLessonType('biweekly'));
  document.getElementById('type-oneoff').addEventListener('click',   () => setLessonType('oneoff'));

  // Week navigation
  document.getElementById('week-prev').addEventListener('click', () => {
    currentWeekOffset--;
    updateWeekUI();
    renderDayView();
  });
  document.getElementById('week-next').addEventListener('click', () => {
    currentWeekOffset++;
    updateWeekUI();
    renderDayView();
  });

  // View toggle
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(`view-${currentView}`).classList.add('active');
      render();
    });
  });

  // Day tabs
  document.querySelectorAll('#day-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#day-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentDay = tab.dataset.day;
      renderDayView();
    });
  });

  // Child tabs
  document.querySelectorAll('#child-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#child-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentChild = tab.dataset.child;
      renderChildView();
    });
  });

  // FAB
  document.getElementById('fab-add').addEventListener('click', () => openModal());

  // Cancel / close overlay
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Delete
  document.getElementById('btn-delete').addEventListener('click', () => {
    const id = document.getElementById('edit-id').value;
    if (id && confirm('Delete this private lesson?')) {
      deletePrivate(id);
      closeModal();
      showSyncStatus('Lesson deleted');
    }
  });

  // Form submit — calculate end from start + duration
  document.getElementById('private-form').addEventListener('submit', e => {
    e.preventDefault();
    const id          = document.getElementById('edit-id').value || null;
    const isBiweekly  = document.getElementById('type-biweekly').classList.contains('active');
    const isOneoff    = document.getElementById('type-oneoff').classList.contains('active');
    const start       = document.getElementById('p-start').value;
    const duration    = parseInt(document.getElementById('p-duration').value, 10);
    const end         = addMinutes(start, duration);
    const desc = document.getElementById('p-desc').value;
    if (!desc) return;
    const data = {
      child:     document.getElementById('p-child').value,
      day:       document.getElementById('p-day').value,
      start,
      end,
      desc,
      recurring: isOneoff ? false : isBiweekly ? 'biweekly' : 'weekly',
    };
    if (isOneoff)   data.date      = document.getElementById('p-date').value;
    if (isBiweekly) data.startDate = (id && privateLesson[id]?.startDate)
                                     || toDateStr(getMondayOfWeek(currentWeekOffset));
    savePrivate(data, id);
    closeModal();
    showSyncStatus(id ? 'Lesson updated ✓' : 'Lesson added ✓');
  });

  // Auto-navigate to today's day
  const TODAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const todayName = TODAY_NAMES[new Date().getDay()];
  currentDay = todayName;
  document.querySelectorAll('#day-tabs .tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.day === todayName);
  });

  // Init week UI labels, then Firebase + render
  updateWeekUI();
  initFirebase();
  render();
});
