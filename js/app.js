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
let privateLesson = {};   // keyed by Firebase push-key
let firebaseReady = false;
let db = null;

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
    showSyncStatus("Connected – lessons will sync live", 2500);
  } catch (e) {
    console.error(e);
    showSyncStatus("⚠️ Firebase error – using local storage", 4000);
    loadFromLocalStorage();
  }
}

function loadFromLocalStorage() {
  try { privateLesson = JSON.parse(localStorage.getItem('dance_privates') || '{}'); } catch { privateLesson = {}; }
  render();
}

function saveToLocalStorage() {
  localStorage.setItem('dance_privates', JSON.stringify(privateLesson));
}

// ── Helpers ───────────────────────────────────────────────────────
function fmt(time24) {
  const [h, m] = time24.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2,'0')}${suffix}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Build <option> list for time selects (07:00–22:00, 15-min steps)
function buildTimeOptions() {
  const opts = ['<option value="">Select time…</option>'];
  for (let h = 7; h <= 22; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 22 && m > 0) break;
      const val = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      opts.push(`<option value="${val}">${fmt(val)}</option>`);
    }
  }
  return opts.join('');
}

function sortedLessons(lessons) {
  return [...lessons].sort((a, b) => a.start.localeCompare(b.start));
}

function childPill(name) {
  return `<span class="pill ${name.toLowerCase()}">${name}</span>`;
}

// ── Render ────────────────────────────────────────────────────────
let currentDay   = 'Monday';
let currentChild = 'Aubree';
let currentView  = 'day';

function render() {
  if (currentView === 'day') renderDayView();
  else                       renderChildView();
}

function renderDayView() {
  const container = document.getElementById('day-content');
  const lessons   = getLessonsForDay(currentDay);
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
    const lessons = getLessonsForDay(day, currentChild);
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

function getLessonsForDay(day, filterChild = null) {
  const fixed = SCHEDULE
    .filter(l => l.day === day && (filterChild ? l.children.includes(filterChild) : true))
    .map(l => ({ ...l, isPrivate: false }));

  const privs = Object.entries(privateLesson)
    .filter(([, l]) => l.day === day && (filterChild ? l.child === filterChild : true))
    .map(([id, l]) => ({
      id,
      day:       l.day,
      start:     l.start,
      end:       l.end,
      title:     l.desc,
      children:  [l.child],
      isPrivate: true,
      recurring: l.recurring !== false,   // default true for existing data
      date:      l.date || null,
    }));

  return [...fixed, ...privs];
}

function cardHTML(lesson, hideChildren = false) {
  const childClasses = lesson.children.map(c => c.toLowerCase()).join(' ');
  const isMulti      = lesson.children.length > 1;
  const borderClass  = isMulti ? 'multi' : lesson.children[0]?.toLowerCase();
  const stripeStyle  = isMulti
    ? `style="--stripe: linear-gradient(to bottom, ${lesson.children.map(c => `var(--${c.toLowerCase()})`).join(', ')})"`
    : '';

  const pills      = hideChildren ? '' : `<div class="card-children">${lesson.children.map(childPill).join('')}</div>`;
  const privBadge  = lesson.isPrivate ? `<span class="badge-private">Private</span>` : '';
  const oneoffBadge = (lesson.isPrivate && lesson.recurring === false && lesson.date)
    ? `<span class="badge-oneoff">📅 ${formatDate(lesson.date)}</span>` : '';
  const editBtn    = lesson.isPrivate
    ? `<button class="btn-edit" data-id="${lesson.id}" title="Edit">✏️</button>` : '';

  return `
  <div class="card ${borderClass} ${lesson.isPrivate ? 'private' : ''}" ${stripeStyle}>
    <div class="card-time">
      <div class="start">${fmt(lesson.start)}</div>
      <div class="end">${fmt(lesson.end)}</div>
    </div>
    <div class="card-body">
      <div class="card-title">${lesson.title}${privBadge}${oneoffBadge}</div>
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

// ── Modal ─────────────────────────────────────────────────────────
function setLessonType(type) {
  document.getElementById('type-recurring').classList.toggle('active', type === 'recurring');
  document.getElementById('type-oneoff').classList.toggle('active', type === 'oneoff');
  const dateRow = document.getElementById('date-row');
  const dateInput = document.getElementById('p-date');
  dateRow.style.display  = type === 'oneoff' ? 'flex' : 'none';
  dateInput.required     = type === 'oneoff';
}

function openModal(editId = null) {
  const overlay  = document.getElementById('modal-overlay');
  const titleEl  = document.getElementById('modal-title');
  const delBtn   = document.getElementById('btn-delete');
  const editIdEl = document.getElementById('edit-id');

  if (editId) {
    const l = privateLesson[editId];
    titleEl.textContent = 'Edit Private Lesson';
    editIdEl.value      = editId;
    document.getElementById('p-child').value = l.child;
    document.getElementById('p-day').value   = l.day;
    document.getElementById('p-start').value = l.start;
    document.getElementById('p-end').value   = l.end;
    document.getElementById('p-desc').value  = l.desc;
    setLessonType(l.recurring === false ? 'oneoff' : 'recurring');
    document.getElementById('p-date').value  = l.date || '';
    delBtn.style.display = 'inline-block';
  } else {
    titleEl.textContent = 'Add Private Lesson';
    editIdEl.value      = '';
    document.getElementById('private-form').reset();
    setLessonType('recurring');
    document.getElementById('p-date').value = '';
    if (currentView === 'day')
      document.getElementById('p-day').value = currentDay;
    if (currentView === 'child')
      document.getElementById('p-child').value = currentChild;
    delBtn.style.display = 'none';
  }
  overlay.classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

// ── Sync helpers ──────────────────────────────────────────────────
function savePrivate(data, id = null) {
  if (db) {
    const ref = id ? db.ref(`privates/${id}`) : db.ref('privates').push();
    ref.set(data).catch(console.error);
    // Firebase listener will re-render
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

function showSyncStatus(msg, duration = 2000) {
  const el = document.getElementById('sync-status');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

// ── Event wiring ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Populate time selects
  const timeHtml = buildTimeOptions();
  document.getElementById('p-start').innerHTML = timeHtml;
  document.getElementById('p-end').innerHTML   = timeHtml;

  // Type toggle buttons
  document.getElementById('type-recurring').addEventListener('click', () => setLessonType('recurring'));
  document.getElementById('type-oneoff').addEventListener('click',    () => setLessonType('oneoff'));

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

  // Cancel / close
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

  // Form submit
  document.getElementById('private-form').addEventListener('submit', e => {
    e.preventDefault();
    const id      = document.getElementById('edit-id').value || null;
    const isOneoff = document.getElementById('type-oneoff').classList.contains('active');
    const data = {
      child:     document.getElementById('p-child').value,
      day:       document.getElementById('p-day').value,
      start:     document.getElementById('p-start').value,
      end:       document.getElementById('p-end').value,
      desc:      document.getElementById('p-desc').value.trim(),
      recurring: !isOneoff,
    };
    if (isOneoff) {
      data.date = document.getElementById('p-date').value;
    }
    savePrivate(data, id);
    closeModal();
    showSyncStatus(id ? 'Lesson updated ✓' : 'Lesson added ✓');
  });

  // Initial render + Firebase
  initFirebase();
  render();
});
