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
let deletedBuiltins      = {};   // deleted built-in class names { key: 'ClassName' }
let scheduleCancellations = {};  // hidden built-in slots { key: { day,start,title,fromDate } }
let editingBuiltin       = null; // { day,start,title,children,end } when editing a built-in card
let editingGroup         = null; // { childName: id, ... } when editing a grouped private card
let isEditMode           = false;

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
    db.ref('scheduleCancellations').on('value', snapshot => {
      scheduleCancellations = snapshot.val() || {};
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
  try { deletedBuiltins      = JSON.parse(localStorage.getItem('dance_deleted')      || '{}'); } catch { deletedBuiltins = {}; }
  try { scheduleCancellations = JSON.parse(localStorage.getItem('dance_cancellations') || '{}'); } catch { scheduleCancellations = {}; }
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

function saveCancellationsToLocalStorage() {
  localStorage.setItem('dance_cancellations', JSON.stringify(scheduleCancellations));
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
  container.innerHTML = sortedLessons(groupLessons(lessons)).map(l => cardHTML(l)).join('');
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
  // weekMon = Monday of the viewed week as 'YYYY-MM-DD', or null in child view
  const weekMon = weekDate ? toDateStr(getMondayOfDate(weekDate)) : null;

  const fixed = SCHEDULE
    .filter(l => {
      if (l.day !== day) return false;
      if (filterChild && !l.children.includes(filterChild)) return false;
      // In child view (weekMon=null) hide if any cancellation exists;
      // in day view hide if cancellation covers the current week.
      const cancelled = Object.values(scheduleCancellations).some(c =>
        c.day === l.day && c.start === l.start && c.title === l.title &&
        (!weekMon || weekMon >= c.fromDate)
      );
      if (cancelled) return false;
      return true;
    })
    .map(l => ({ ...l, isPrivate: false, builtinKey: `${l.day}|${l.start}|${l.title}` }));

  const privs = Object.entries(privateLesson)
    .filter(([, l]) => {
      if (l.day !== day) return false;
      if (filterChild && l.child !== filterChild) return false;
      if (l.recurring === false) {
        if (weekDate === null) return true;            // child view — show all one-offs
        return l.date === toDateStr(weekDate);
      }
      // Recurring (weekly or biweekly)
      // Hide if soft-deleted — in child view hide entirely, in day view hide from endDate onwards
      if (l.endDate && (weekMon === null || weekMon >= l.endDate)) return false;
      if (weekMon !== null) {
        if (l.startDate) {
          if (weekMon < l.startDate) return false;              // not started yet
          if (l.recurring === 'biweekly') {
            const anchor    = new Date(l.startDate + 'T00:00:00');
            const current   = new Date(weekMon    + 'T00:00:00');
            const diffWeeks = Math.round((current - anchor) / (7 * 24 * 60 * 60 * 1000));
            if (diffWeeks % 2 !== 0) return false;
          }
        }
      }
      return true;
    })
    .map(([id, l]) => ({
      id,
      day:       l.day,
      start:     l.start,
      end:       l.end,
      title:     l.desc,
      children:  [l.child],
      isPrivate: true,
      recurring: l.recurring,
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

  const pills         = hideChildren ? '' : `<div class="card-children">${lesson.children.map(childPill).join('')}</div>`;
  const biweeklyBadge = (lesson.isPrivate && lesson.recurring === 'biweekly')
    ? `<span class="badge-biweekly">Bi-weekly</span>` : '';
  const oneoffBadge   = (lesson.isPrivate && lesson.recurring === false && lesson.date)
    ? `<span class="badge-oneoff">📅 ${formatDate(lesson.date)}</span>` : '';
  const editBtn       = lesson.isPrivate
    ? `<button class="btn-edit" data-ids="${(lesson.ids || [lesson.id]).join(',')}" title="Edit">✏️</button>`
    : `<button class="btn-edit-builtin" data-builtin-key="${lesson.builtinKey}" title="Edit">✏️</button>`;

  return `
  <div class="card ${borderClass} ${lesson.isPrivate ? 'private' : ''}" ${stripeStyle}>
    <div class="card-time">
      <div class="start">${fmt(lesson.start)}</div>
      <div class="end">${fmt(lesson.end)}</div>
    </div>
    <div class="card-body">
      <div class="card-title">${lesson.title}${biweeklyBadge}${oneoffBadge}</div>
      ${pills}
    </div>
    ${editBtn}
  </div>`;
}

function attachEditListeners(container) {
  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const ids = btn.dataset.ids.split(',').filter(Boolean);
      openModal(ids);
    });
  });
  container.querySelectorAll('.btn-edit-builtin').forEach(btn => {
    btn.addEventListener('click', () => {
      const [bDay, bStart, bTitle] = btn.dataset.builtinKey.split('|');
      const lesson = SCHEDULE.find(l => l.day === bDay && l.start === bStart && l.title === bTitle);
      if (lesson) openModal(null, lesson);
    });
  });
}

// ── Group same-slot private lessons into one card ─────────────────
// Only used in day view so that Nelly+Winnie added to same class merge visually.
function groupLessons(lessons) {
  const result = [];
  const seen   = new Map(); // groupKey → index in result
  for (const l of lessons) {
    if (!l.isPrivate) { result.push(l); continue; }
    const key = `${l.start}|${l.end}|${l.title}`;
    if (seen.has(key)) {
      const g = result[seen.get(key)];
      g.children.push(l.children[0]);
      g.ids.push(l.id);
    } else {
      seen.set(key, result.length);
      result.push({ ...l, ids: [l.id] }); // ids array for multi-edit
    }
  }
  return result;
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

// ── Clash detection ───────────────────────────────────────────────
function detectClashes(day, start, end, children, excludeIds = [], excludeBuiltinKey = null, checkDate = null) {
  const toMins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const newS = toMins(start);
  const newE = toMins(end);
  const clashes = [];
  const weekStart = getMondayOfWeek(currentWeekOffset);
  const dayDate   = checkDate || getDateForDay(day, weekStart);

  for (const child of children) {
    const lessons = getLessonsForDay(day, child, dayDate);
    for (const l of lessons) {
      if (l.id         && excludeIds.includes(l.id))           continue;
      if (l.builtinKey && l.builtinKey === excludeBuiltinKey) continue;
      if (!l.start || !l.end) continue;
      const lS = toMins(l.start);
      const lE = toMins(l.end);
      if (lS < newE && newS < lE) {
        clashes.push({ child, title: l.title, start: l.start, end: l.end });
      }
    }
  }
  return clashes;
}

// ── Child selection helpers ───────────────────────────────────────
function setSelectedChildren(children) {
  document.querySelectorAll('.child-btn').forEach(btn => {
    btn.classList.toggle('active', children.includes(btn.dataset.child));
  });
}

function getSelectedChildren() {
  return [...document.querySelectorAll('.child-btn.active')].map(btn => btn.dataset.child);
}

// ── Cancel a built-in class slot from the current viewed week ─────
function cancelBuiltin(day, start, title) {
  const fromDate = toDateStr(getMondayOfWeek(currentWeekOffset));
  const data = { day, start, title, fromDate };
  if (db) {
    db.ref('scheduleCancellations').push().set(data).catch(console.error);
  } else {
    scheduleCancellations['local_sc_' + Date.now()] = data;
    saveCancellationsToLocalStorage();
    render();
  }
}

// ── Soft-delete a recurring private lesson from the current viewed week ──
function endPrivate(id) {
  const endDate = toDateStr(getMondayOfWeek(currentWeekOffset));
  // Optimistic local update — apply immediately, Firebase write follows
  if (privateLesson[id]) {
    privateLesson[id] = { ...privateLesson[id], endDate };
    render();
  }
  if (db) {
    db.ref(`privates/${id}/endDate`).set(endDate).catch(console.error);
  } else {
    saveToLocalStorage();
  }
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

// editIds = array of private lesson ids (1 = single edit, 2+ = group edit)
function openModal(editIds = null, builtinData = null) {
  const overlay  = document.getElementById('modal-overlay');
  const titleEl  = document.getElementById('modal-title');
  const delBtn   = document.getElementById('btn-delete');
  const editIdEl = document.getElementById('edit-id');

  editingBuiltin = builtinData || null;
  editingGroup   = null;

  if (builtinData) {
    // ── Editing a built-in SCHEDULE class ──
    titleEl.textContent = 'Edit from This Week';
    editIdEl.value      = '';
    document.getElementById('p-day').value   = builtinData.day;
    document.getElementById('p-start').value = builtinData.start;
    const dur = calcDuration(builtinData.start, builtinData.end);
    document.getElementById('p-duration').value = String(dur);
    updateDescOptions('', builtinData.title);
    setLessonType('weekly');
    document.getElementById('p-date').value = '';
    setSelectedChildren(builtinData.children);
    delBtn.style.display = 'inline-block';

  } else if (editIds && editIds.length) {
    // ── Editing one or more private lessons ──
    const firstId = editIds[0];
    const l       = privateLesson[firstId];
    titleEl.textContent = 'Edit Lesson';
    document.getElementById('p-day').value   = l.day;
    document.getElementById('p-start').value = l.start;
    const dur = calcDuration(l.start, l.end);
    document.getElementById('p-duration').value = String(dur);
    updateDescOptions(l.child, l.desc);
    setLessonType(l.recurring === false ? 'oneoff' : l.recurring === 'biweekly' ? 'biweekly' : 'weekly');
    document.getElementById('p-date').value = l.date || '';
    delBtn.style.display = 'inline-block';

    if (editIds.length > 1) {
      // Group: build child→id map so we can update/remove individually
      editingGroup = {};
      editIds.forEach(id => {
        const child = privateLesson[id]?.child;
        if (child) editingGroup[child] = id;
      });
      editIdEl.value = '';
      setSelectedChildren(Object.keys(editingGroup));
    } else {
      // Single lesson
      editIdEl.value = firstId;
      setSelectedChildren([l.child]);
    }

  } else {
    // ── Adding a new lesson ──
    titleEl.textContent = 'Add Lesson';
    editIdEl.value      = '';
    document.getElementById('private-form').reset();
    document.getElementById('p-duration').value = '60';
    setLessonType('weekly');
    document.getElementById('p-date').value = '';
    if (currentView === 'day')   document.getElementById('p-day').value = currentDay;
    setSelectedChildren(currentView === 'child' ? [currentChild] : []);
    updateDescOptions();
    delBtn.style.display = 'none';
  }
  overlay.classList.add('open');
}

function closeModal() {
  editingBuiltin = null;
  editingGroup   = null;
  document.getElementById('modal-overlay').classList.remove('open');
}

// ── Firebase save / delete ────────────────────────────────────────
function savePrivate(data, id = null) {
  if (db) {
    const ref = id ? db.ref(`privates/${id}`) : db.ref('privates').push();
    ref.set(data).catch(console.error);
    // Use ref.key (Firebase's own key) for the optimistic update — guaranteed unique,
    // so calling twice in the same JS tick doesn't clobber the first entry.
    privateLesson[ref.key] = data;
    render();
  } else {
    const key = id || ('local_' + Date.now());
    privateLesson[key] = data;
    saveToLocalStorage();
    render();
  }
}

function deletePrivate(id) {
  // Optimistic local update — remove immediately, Firebase write follows
  delete privateLesson[id];
  render();
  if (db) {
    db.ref(`privates/${id}`).remove().catch(console.error);
  } else {
    saveToLocalStorage();
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

// ── Settings action sheet ──────────────────────────────────────────
function openSettings() {
  document.getElementById('settings-overlay').classList.add('open');
}

function closeSettings() {
  document.getElementById('settings-overlay').classList.remove('open');
}

function enterEditMode() {
  isEditMode = true;
  document.body.classList.add('edit-mode');
  const fab = document.getElementById('fab-manage');
  fab.textContent = 'Done';
  fab.classList.add('done-mode');
}

function exitEditMode() {
  isEditMode = false;
  document.body.classList.remove('edit-mode');
  const fab = document.getElementById('fab-manage');
  fab.textContent = '⚙';
  fab.classList.remove('done-mode');
}

// ── Event wiring ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Populate time & duration selects
  document.getElementById('p-start').innerHTML    = buildTimeOptions();
  document.getElementById('p-duration').innerHTML = buildDurationOptions();

  // Child toggle buttons — single-select only when editing a lone private lesson
  document.querySelectorAll('.child-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const isSingleEdit = !editingBuiltin && !editingGroup &&
                           !!document.getElementById('edit-id').value;
      if (isSingleEdit) {
        setSelectedChildren([btn.dataset.child]);
      } else {
        btn.classList.toggle('active');
      }
      updateDescOptions();
    });
  });

  // Settings / Manage FAB — toggles edit mode if active, else opens settings
  document.getElementById('fab-manage').addEventListener('click', () => {
    if (isEditMode) exitEditMode();
    else openSettings();
  });

  // Settings overlay: close on backdrop click
  document.getElementById('settings-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeSettings();
  });

  // Settings items
  document.getElementById('settings-edit').addEventListener('click', () => {
    closeSettings();
    enterEditMode();
  });
  document.getElementById('settings-library').addEventListener('click', () => {
    closeSettings();
    openManageModal();
  });
  document.getElementById('settings-cancel').addEventListener('click', closeSettings);

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
  document.getElementById('week-today').addEventListener('click', () => {
    currentWeekOffset = 0;
    const todayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
    currentDay = todayName;
    document.querySelectorAll('#day-tabs .tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.day === currentDay);
    });
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
    if (editingBuiltin) {
      if (confirm(`Stop "${editingBuiltin.title}" from this week onwards?`)) {
        cancelBuiltin(editingBuiltin.day, editingBuiltin.start, editingBuiltin.title);
        closeModal();
        showSyncStatus('Class removed from this week onwards ✓');
      }
    } else if (editingGroup) {
      const groupIds   = Object.values(editingGroup);
      const firstLesson = privateLesson[groupIds[0]];
      const isOneoff   = firstLesson?.recurring === false;
      const weekLabel  = formatWeekLabel(getMondayOfWeek(currentWeekOffset));
      const msg = isOneoff
        ? 'Delete these lessons?'
        : `Stop these lessons from ${weekLabel} onwards?`;
      if (confirm(msg)) {
        groupIds.forEach(gid => {
          const gl = privateLesson[gid];
          if (gl?.recurring === false) deletePrivate(gid); else endPrivate(gid);
        });
        closeModal();
        showSyncStatus(isOneoff ? 'Lessons deleted' : 'Lessons stopped from this week ✓');
      }
    } else if (id) {
      const l = privateLesson[id];
      if (l.recurring === false) {
        if (confirm('Delete this lesson?')) {
          deletePrivate(id);
          closeModal();
          showSyncStatus('Lesson deleted');
        }
      } else {
        const weekLabel = formatWeekLabel(getMondayOfWeek(currentWeekOffset));
        if (confirm(`Stop this lesson from ${weekLabel} onwards?`)) {
          endPrivate(id);
          closeModal();
          showSyncStatus('Lesson stopped from this week ✓');
        }
      }
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
    const desc        = document.getElementById('p-desc').value;
    const day         = document.getElementById('p-day').value;
    const selectedChildren = getSelectedChildren();
    if (!desc || !selectedChildren.length) return;

    const weekMon = toDateStr(getMondayOfWeek(currentWeekOffset));

    // ── Clash check ──────────────────────────────────────────────
    const excludeIds     = editingGroup   ? Object.values(editingGroup) : (id ? [id] : []);
    const excludeKey     = editingBuiltin
      ? `${editingBuiltin.day}|${editingBuiltin.start}|${editingBuiltin.title}` : null;
    const checkDate      = isOneoff
      ? new Date(document.getElementById('p-date').value + 'T00:00:00') : null;
    const clashes        = detectClashes(day, start, end, selectedChildren, excludeIds, excludeKey, checkDate);
    if (clashes.length) {
      const msgs = clashes.map(c =>
        `• ${c.child}: clashes with "${c.title}" (${fmt(c.start)}–${fmt(c.end)})`
      ).join('\n');
      if (!confirm(`⚠️ Time clash detected:\n\n${msgs}\n\nSave anyway?`)) return;
    }

    if (editingBuiltin) {
      // Cancel the built-in from this week and replace with new private lessons
      cancelBuiltin(editingBuiltin.day, editingBuiltin.start, editingBuiltin.title);
      selectedChildren.forEach(child => {
        savePrivate({ child, day, start, end, desc, recurring: 'weekly', startDate: weekMon }, null);
      });
      editingBuiltin = null;

    } else if (editingGroup) {
      // Group edit: remove deselected children, update/create selected children
      Object.entries(editingGroup).forEach(([child, gid]) => {
        if (!selectedChildren.includes(child)) {
          const gl = privateLesson[gid];
          if (gl?.recurring === false) deletePrivate(gid); else endPrivate(gid);
        }
      });
      selectedChildren.forEach(child => {
        const existingId = editingGroup[child] || null;
        const data = { child, day, start, end, desc,
          recurring: isOneoff ? false : isBiweekly ? 'biweekly' : 'weekly' };
        if (isOneoff) data.date = document.getElementById('p-date').value;
        if (!isOneoff) data.startDate = (existingId && privateLesson[existingId]?.startDate) || weekMon;
        savePrivate(data, existingId);
      });
      editingGroup = null;

    } else if (id) {
      // Edit existing private lesson (single child)
      const child = selectedChildren[0] || privateLesson[id]?.child;
      const data = { child, day, start, end, desc,
        recurring: isOneoff ? false : isBiweekly ? 'biweekly' : 'weekly' };
      if (isOneoff) data.date = document.getElementById('p-date').value;
      if (!isOneoff) data.startDate = privateLesson[id]?.startDate || weekMon;
      savePrivate(data, id);

    } else {
      // Add new lesson — one record per selected child
      selectedChildren.forEach(child => {
        const data = { child, day, start, end, desc,
          recurring: isOneoff ? false : isBiweekly ? 'biweekly' : 'weekly' };
        if (isOneoff) data.date = document.getElementById('p-date').value;
        if (!isOneoff) data.startDate = weekMon;
        savePrivate(data, null);
      });
    }

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
