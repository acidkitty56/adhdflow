'use strict';

/* ══════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════ */
const STORAGE_CODE = 'adhdf_code';
const STORAGE_DATA = 'adhdf_data';
const CIRCUMFERENCE = 2 * Math.PI * 52; // 326.73

/* ══════════════════════════════════════════════════
   BRAIN STATES
══════════════════════════════════════════════════ */
const STATES = {
  hyperfocus: {
    emoji: '🔥',
    name: 'Hyperfocus',
    tagline: "You're locked in — ride the wave",
    color: '#7c3aed',
    bg: '#f5f3ff',
    tips: [
      'Set a timer so you don\'t lose track of time',
      'Eat and drink something before you dive in',
      'Take on your most demanding task first',
    ],
    hint: 'Start with your highest-energy task.',
  },
  lowbattery: {
    emoji: '🔋',
    name: 'Low Battery',
    tagline: 'Running on fumes — small wins only',
    color: '#64748b',
    bg: '#f8fafc',
    tips: [
      'Only do tasks that require minimal decisions',
      'Give yourself permission to go slow today',
      '15-minute focus blocks are more than enough',
    ],
    hint: 'Low-energy tasks only. That\'s valid.',
  },
  scattered: {
    emoji: '⚡',
    name: 'Scattered',
    tagline: 'A lot is happening — time to ground',
    color: '#dc2626',
    bg: '#fff7f7',
    tips: [
      'Do a 2-minute brain dump before anything else',
      'Pick ONE task. Just one.',
      'Change your environment if you can',
    ],
    hint: 'Reduce to 1 task if needed. No judgment.',
  },
  flowseeking: {
    emoji: '🌊',
    name: 'Flow-Seeking',
    tagline: 'Looking for traction — start small',
    color: '#0891b2',
    bg: '#f0f9ff',
    tips: [
      'Start with a 2-minute task to build momentum',
      'Use the "just open the file" rule',
      'Music or background noise can help today',
    ],
    hint: 'Start with your easiest task to get moving.',
  },
};

/* ══════════════════════════════════════════════════
   DATA MODEL
══════════════════════════════════════════════════ */
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function uid() {
  return 'tk_' + Math.random().toString(36).slice(2, 9);
}

function blankData() {
  return {
    brainState: null,
    brainStateDate: null,
    tasks: [],
    history: [], // [{date, completed, total}]
    lastOpenedDate: todayStr(),
  };
}

let data = blankData();

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_DATA);
    if (raw) data = Object.assign(blankData(), JSON.parse(raw));
  } catch (e) {
    data = blankData();
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_DATA, JSON.stringify(data));
  } catch (e) {}
}

function todayTasks()  { return data.tasks.filter(t => t.inToday); }
function queueTasks()  { return data.tasks.filter(t => !t.inToday); }
function todayDone()   { return todayTasks().filter(t => t.done).length; }
function totalDone()   { return data.tasks.filter(t => t.done).length; }

/* ══════════════════════════════════════════════════
   GATE
══════════════════════════════════════════════════ */
function initGate() {
  const codeInput  = document.getElementById('code-input');
  const unlockBtn  = document.getElementById('unlock-btn');
  const gateError  = document.getElementById('gate-error');

  // Auto-format as user types: ADHF-XXXX-XXXX
  codeInput.addEventListener('input', function () {
    let v = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (v.length > 4)  v = v.slice(0, 4) + '-' + v.slice(4);
    if (v.length > 9)  v = v.slice(0, 9) + '-' + v.slice(9);
    if (v.length > 14) v = v.slice(0, 14);
    this.value = v;
    this.classList.remove('error');
    gateError.textContent = '';
  });

  codeInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') tryUnlock();
  });

  unlockBtn.addEventListener('click', tryUnlock);

  // Check if already unlocked
  const saved = localStorage.getItem(STORAGE_CODE);
  if (saved && VALID_CODES.indexOf(saved) !== -1) {
    showApp();
    return;
  }

  function tryUnlock() {
    const code = codeInput.value.trim().toUpperCase();
    if (VALID_CODES.indexOf(code) !== -1) {
      localStorage.setItem(STORAGE_CODE, code);
      showApp();
    } else {
      codeInput.classList.add('error');
      gateError.textContent = 'Invalid code. Check your order confirmation and try again.';
      codeInput.focus();
    }
  }
}

function showApp() {
  document.getElementById('gate').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  loadData();
  initApp();
}

/* ══════════════════════════════════════════════════
   APP INIT
══════════════════════════════════════════════════ */
function initApp() {
  checkNewDay();
  renderTopbar();
  renderStateCard();
  renderTodaySlots();
  renderQueue();
  initTimer();
  bindEvents();

  // Prompt brain state on first open of day — but not if day summary is already showing
  if (!data.brainState || data.brainStateDate !== todayStr()) {
    setTimeout(function () {
      const summary = document.getElementById('modal-daysummary');
      if (summary && !summary.classList.contains('hidden')) return;
      openModal('modal-brainstate');
    }, 400);
  }
}

function bindEvents() {
  // State pill + set-state button
  document.getElementById('state-pill').addEventListener('click', function () { openModal('modal-brainstate'); });
  document.getElementById('set-state-btn').addEventListener('click', function () { openModal('modal-brainstate'); });
  document.getElementById('sc-change-btn').addEventListener('click', function () { openModal('modal-brainstate'); });

  // New day
  document.getElementById('newday-btn').addEventListener('click', function () {
    if (confirm('Start a new day? Unfinished tasks will return to your queue.')) {
      triggerNewDay(true);
    }
  });

  // SOS
  document.getElementById('sos-btn').addEventListener('click', function () { openModal('modal-sos'); });
  document.getElementById('sos-ready').addEventListener('click', function () {
    closeModal('modal-sos');
    // Start 15-min timer automatically
    setTimerDuration(15);
    startTimer();
  });
  document.getElementById('sos-close').addEventListener('click', function () { closeModal('modal-sos'); });

  // Brain state modal
  document.getElementById('modal-state-skip').addEventListener('click', function () { closeModal('modal-brainstate'); });

  // Add task
  document.getElementById('add-task-btn').addEventListener('click', openAddTask);
  document.getElementById('add-task-inline').addEventListener('click', openAddTask);
  document.getElementById('task-confirm').addEventListener('click', confirmAddTask);
  document.getElementById('task-cancel').addEventListener('click', function () { closeModal('modal-addtask'); });
  document.getElementById('task-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') confirmAddTask();
  });

  // Energy options
  document.getElementById('energy-opts').addEventListener('click', function (e) {
    const btn = e.target.closest('.eopt');
    if (!btn) return;
    document.querySelectorAll('.eopt').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
  });

  // Where options
  document.getElementById('where-opts').addEventListener('click', function (e) {
    const btn = e.target.closest('.wopt');
    if (!btn) return;
    document.querySelectorAll('.wopt').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
  });

  // Day summary
  document.getElementById('summary-go').addEventListener('click', function () {
    closeModal('modal-daysummary');
    openModal('modal-brainstate');
  });

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
}

/* ══════════════════════════════════════════════════
   TOPBAR
══════════════════════════════════════════════════ */
function renderTopbar() {
  // Date
  const dateEl = document.getElementById('topbar-date');
  const now = new Date();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  dateEl.textContent = days[now.getDay()] + ', ' + months[now.getMonth()] + ' ' + now.getDate();

  // Wins today
  const wins = todayDone();
  const winsEl = document.getElementById('topbar-wins');
  if (wins > 0) {
    winsEl.textContent = wins + ' done today';
  } else {
    winsEl.textContent = '';
  }

  // State pill
  renderStatePill();
}

function renderStatePill() {
  const pill    = document.getElementById('state-pill');
  const emojiEl = document.getElementById('state-pill-emoji');
  const nameEl  = document.getElementById('state-pill-name');
  if (data.brainState && STATES[data.brainState]) {
    const s = STATES[data.brainState];
    emojiEl.textContent = s.emoji;
    nameEl.textContent  = s.name;
    pill.style.borderColor = s.color;
    pill.style.color       = s.color;
  } else {
    emojiEl.textContent = '';
    nameEl.textContent  = 'Set brain state';
    pill.style.borderColor = '';
    pill.style.color       = '';
  }
}

/* ══════════════════════════════════════════════════
   BRAIN STATE
══════════════════════════════════════════════════ */
function renderStateCard() {
  const emptyEl   = document.getElementById('state-card-empty');
  const contentEl = document.getElementById('state-card-content');

  if (!data.brainState || !STATES[data.brainState]) {
    emptyEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  contentEl.classList.remove('hidden');

  const s = STATES[data.brainState];
  document.getElementById('sc-emoji').textContent   = s.emoji;
  document.getElementById('sc-name').textContent    = s.name;
  document.getElementById('sc-tagline').textContent = s.tagline;
  document.getElementById('sc-hint').textContent    = s.hint;

  // Apply state color to card top
  document.getElementById('state-card').style.borderColor = s.color + '55';
  document.getElementById('state-card-content').querySelector('.state-card__top').style.background = s.bg;

  // Tips
  const tipsEl = document.getElementById('sc-tips');
  tipsEl.innerHTML = '';
  s.tips.forEach(function (tip) {
    const li = document.createElement('li');
    li.textContent = tip;
    tipsEl.appendChild(li);
  });
}

function renderStateGrid() {
  const grid = document.getElementById('state-grid');
  grid.innerHTML = '';
  Object.keys(STATES).forEach(function (key) {
    const s = STATES[key];
    const btn = document.createElement('button');
    btn.className = 'state-card-option' + (data.brainState === key ? ' selected' : '');
    btn.dataset.state = key;
    btn.style.setProperty('--sc-color', s.color);
    btn.style.setProperty('--sc-bg', s.bg);
    btn.innerHTML =
      '<span class="sc-opt__emoji">' + s.emoji + '</span>' +
      '<div class="sc-opt__name">' + s.name + '</div>' +
      '<div class="sc-opt__tagline">' + s.tagline + '</div>';
    btn.addEventListener('click', function () {
      selectState(key);
    });
    grid.appendChild(btn);
  });
}

function selectState(key) {
  data.brainState     = key;
  data.brainStateDate = todayStr();
  saveData();
  closeModal('modal-brainstate');
  renderStateCard();
  renderStatePill();
  // Update today's 3 task hint
  updateTodayHint();
}

function updateTodayHint() {
  // Visual flash on state card change
  const card = document.getElementById('state-card');
  card.classList.add('win-flash');
  setTimeout(function () { card.classList.remove('win-flash'); }, 600);
}

/* ══════════════════════════════════════════════════
   TASKS — TODAY'S 3
══════════════════════════════════════════════════ */
function renderTodaySlots() {
  const container = document.getElementById('today-slots');
  const tt = todayTasks();
  // Sort: undone first, then done
  const undone = tt.filter(function (t) { return !t.done; });
  const done   = tt.filter(function (t) { return t.done; });
  const ordered = undone.concat(done);

  container.innerHTML = '';

  // Show up to 3 slots
  for (let i = 0; i < 3; i++) {
    const task = ordered[i];
    const slot = document.createElement('div');
    slot.className = 'task-slot';

    if (!task) {
      // Empty slot
      slot.classList.add('empty');
      slot.innerHTML =
        '<div class="task-slot__empty" id="empty-slot-' + i + '">' +
          '<div class="task-slot__plus">+</div>' +
          '<span class="task-slot__empty-text">Empty — add a task</span>' +
        '</div>';
      slot.querySelector('.task-slot__empty').addEventListener('click', function () {
        openAddTask('today');
      });
    } else {
      // Filled slot
      if (task.done) slot.classList.add('done');
      slot.classList.add('filled');
      slot.dataset.id = task.id;

      const energyLabel = { high: 'High', medium: 'Medium', low: 'Low' }[task.energy] || 'Medium';

      slot.innerHTML =
        '<div class="task-slot__row">' +
          '<button class="task-check" data-id="' + task.id + '" title="Mark complete">' +
            '<svg width="11" height="9" viewBox="0 0 12 10" fill="none">' +
              '<path d="M1 5l3.5 3.5 6.5-7" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
            '</svg>' +
          '</button>' +
          '<span class="task-text">' + escHtml(task.text) + '</span>' +
          '<span class="task-energy"><span class="edot edot--' + task.energy + '"></span>' + energyLabel + '</span>' +
          '<button class="task-remove" data-id="' + task.id + '" title="Move to queue">' +
            '<svg width="12" height="12" viewBox="0 0 14 14" fill="none">' +
              '<path d="M2 7h10M7 2v10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" transform="rotate(45 7 7)"/>' +
            '</svg>' +
          '</button>' +
        '</div>';

      slot.querySelector('.task-check').addEventListener('click', function (e) {
        e.stopPropagation();
        completeTask(task.id);
      });
      slot.querySelector('.task-remove').addEventListener('click', function (e) {
        e.stopPropagation();
        removeFromToday(task.id);
      });
    }

    container.appendChild(slot);
  }

  // Update count
  const countEl = document.getElementById('today-count');
  const doneCount = done.length;
  const totalCount = ordered.length;
  countEl.textContent = doneCount + ' / ' + Math.max(totalCount, 1);
  countEl.className = 'today-count' + (totalCount > 0 && doneCount === totalCount ? ' all-done' : '');

  // Update topbar wins
  const winsEl = document.getElementById('topbar-wins');
  winsEl.textContent = doneCount > 0 ? doneCount + ' done today' : '';
}

/* ══════════════════════════════════════════════════
   TASKS — QUEUE
══════════════════════════════════════════════════ */
function renderQueue() {
  const list    = document.getElementById('queue-list');
  const emptyEl = document.getElementById('queue-empty');
  const qt      = queueTasks();

  list.innerHTML = '';

  if (qt.length === 0) {
    emptyEl.style.display = 'block';
    list.style.display    = 'none';
    return;
  }

  emptyEl.style.display = 'none';
  list.style.display    = 'flex';

  qt.forEach(function (task) {
    const item = document.createElement('div');
    item.className = 'queue-item' + (task.done ? ' done-q' : '');
    item.dataset.id = task.id;

    const todayCount = todayTasks().length;
    const canPromote = !task.done && todayCount < 3;

    item.innerHTML =
      '<span class="edot edot--' + task.energy + '" style="flex-shrink:0"></span>' +
      '<span class="queue-item__text">' + escHtml(task.text) + '</span>' +
      (canPromote
        ? '<button class="btn-promote" data-id="' + task.id + '" title="Move to Today\'s 3">→ Today</button>'
        : '') +
      '<button class="btn-queue-remove" data-id="' + task.id + '" title="Delete task">' +
        '<svg width="12" height="12" viewBox="0 0 14 14" fill="none">' +
          '<path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>' +
      '</button>';

    const promoteBtn = item.querySelector('.btn-promote');
    if (promoteBtn) {
      promoteBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        promoteToToday(task.id);
      });
    }
    item.querySelector('.btn-queue-remove').addEventListener('click', function (e) {
      e.stopPropagation();
      deleteTask(task.id);
    });

    list.appendChild(item);
  });
}

/* ══════════════════════════════════════════════════
   TASK ACTIONS
══════════════════════════════════════════════════ */
function addTask(text, energy, where) {
  const inToday = where === 'today';
  // Enforce max 3 in today
  if (inToday && todayTasks().length >= 3) {
    alert("Today's 3 is full. Add to queue or complete an existing task first.");
    return;
  }
  const task = {
    id:          uid(),
    text:        text.trim(),
    energy:      energy || 'medium',
    inToday:     inToday,
    done:        false,
    createdAt:   Date.now(),
    completedAt: null,
  };
  data.tasks.push(task);
  saveData();
  renderTodaySlots();
  renderQueue();
}

function completeTask(id) {
  const task = data.tasks.find(function (t) { return t.id === id; });
  if (!task) return;
  task.done = !task.done; // toggle
  task.completedAt = task.done ? Date.now() : null;
  saveData();
  renderTodaySlots();
  renderQueue();

  // Celebrate if all today tasks are done
  if (task.done) {
    const tt = todayTasks();
    const allDone = tt.length > 0 && tt.every(function (t) { return t.done; });
    if (allDone) celebrateAllDone();
  }
}

function removeFromToday(id) {
  const task = data.tasks.find(function (t) { return t.id === id; });
  if (!task) return;
  task.inToday = false;
  task.done    = false;
  task.completedAt = null;
  saveData();
  renderTodaySlots();
  renderQueue();
}

function promoteToToday(id) {
  if (todayTasks().length >= 3) {
    alert("Today's 3 is full. Complete or remove a task first.");
    return;
  }
  const task = data.tasks.find(function (t) { return t.id === id; });
  if (!task) return;
  task.inToday = true;
  saveData();
  renderTodaySlots();
  renderQueue();
}

function deleteTask(id) {
  data.tasks = data.tasks.filter(function (t) { return t.id !== id; });
  saveData();
  renderTodaySlots();
  renderQueue();
}

function celebrateAllDone() {
  const panel = document.querySelector('.today-panel');
  if (panel) {
    panel.classList.add('win-flash');
    setTimeout(function () { panel.classList.remove('win-flash'); }, 600);
  }
}

/* ══════════════════════════════════════════════════
   ADD TASK MODAL
══════════════════════════════════════════════════ */
function openAddTask(where) {
  // Reset form
  document.getElementById('task-input').value = '';
  document.querySelectorAll('.eopt').forEach(function (b) { b.classList.remove('active'); });
  document.querySelector('.eopt[data-energy="medium"]').classList.add('active');

  // Set where
  document.querySelectorAll('.wopt').forEach(function (b) { b.classList.remove('active'); });
  const targetWhere = (where === 'today' && todayTasks().length < 3) ? 'today' : 'queue';
  const whereBtn = document.querySelector('.wopt[data-where="' + targetWhere + '"]');
  if (whereBtn) whereBtn.classList.add('active');

  // Disable Today option if full
  const todayBtn = document.getElementById('where-today-btn');
  if (todayTasks().length >= 3) {
    todayBtn.disabled = true;
    todayBtn.title    = "Today's 3 is full";
    todayBtn.style.opacity = '0.4';
    todayBtn.style.cursor  = 'not-allowed';
  } else {
    todayBtn.disabled = false;
    todayBtn.title    = '';
    todayBtn.style.opacity = '';
    todayBtn.style.cursor  = '';
  }

  openModal('modal-addtask');
  setTimeout(function () { document.getElementById('task-input').focus(); }, 100);
}

function confirmAddTask() {
  const text   = document.getElementById('task-input').value.trim();
  if (!text) {
    document.getElementById('task-input').focus();
    return;
  }
  const energy = (document.querySelector('.eopt.active') || {}).dataset.energy || 'medium';
  const where  = (document.querySelector('.wopt.active') || {}).dataset.where  || 'queue';
  addTask(text, energy, where);
  closeModal('modal-addtask');
}

/* ══════════════════════════════════════════════════
   FOCUS TIMER
══════════════════════════════════════════════════ */
let timer = {
  totalSeconds:     15 * 60,
  remainingSeconds: 15 * 60,
  running:          false,
  startedAt:        null,
  interval:         null,
};

function initTimer() {
  document.getElementById('timer-durations').addEventListener('click', function (e) {
    const btn = e.target.closest('.dur-btn');
    if (!btn || timer.running) return;
    document.querySelectorAll('.dur-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    setTimerDuration(parseInt(btn.dataset.min, 10));
  });

  document.getElementById('timer-start').addEventListener('click', function () {
    if (timer.running) {
      pauseTimer();
    } else {
      startTimer();
    }
  });

  document.getElementById('timer-reset').addEventListener('click', resetTimer);
  updateTimerDisplay();
}

function setTimerDuration(minutes) {
  timer.totalSeconds     = minutes * 60;
  timer.remainingSeconds = minutes * 60;
  timer.running          = false;
  timer.startedAt        = null;
  clearInterval(timer.interval);
  updateTimerDisplay();
}

function startTimer() {
  if (timer.remainingSeconds <= 0) resetTimer();
  timer.running   = true;
  timer.startedAt = Date.now();
  timer.interval  = setInterval(tickTimer, 500);
  updateTimerDisplay();
}

function pauseTimer() {
  if (!timer.running) return;
  // Capture remaining before pausing
  const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
  timer.remainingSeconds = Math.max(0, timer.remainingSeconds - elapsed);
  timer.running   = false;
  timer.startedAt = null;
  clearInterval(timer.interval);
  updateTimerDisplay();
}

function resetTimer() {
  clearInterval(timer.interval);
  timer.running          = false;
  timer.startedAt        = null;
  timer.remainingSeconds = timer.totalSeconds;
  updateTimerDisplay();
  document.getElementById('timer-status').textContent = 'Pick a duration and start your focus block.';
  document.getElementById('timer-status').className   = 'timer-status';
  document.getElementById('timer-progress').classList.remove('done-ring');
}

function tickTimer() {
  if (!timer.running) return;
  const elapsed    = Math.floor((Date.now() - timer.startedAt) / 1000);
  const remaining  = timer.remainingSeconds - elapsed;
  if (remaining <= 0) {
    timer.remaining = 0;
    timer.running   = false;
    clearInterval(timer.interval);
    playDoneSound();
    document.getElementById('timer-status').textContent = 'Focus block complete! Take a short break.';
    document.getElementById('timer-status').className   = 'timer-status complete';
    document.getElementById('timer-progress').classList.add('done-ring');
    updateTimerDisplay(0);
    return;
  }
  updateTimerDisplay(remaining);
}

function updateTimerDisplay(remaining) {
  if (remaining === undefined) {
    remaining = timer.running
      ? Math.max(0, timer.remainingSeconds - Math.floor((Date.now() - timer.startedAt) / 1000))
      : timer.remainingSeconds;
  }

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  document.getElementById('timer-time').textContent =
    String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');

  // Ring progress
  const progress = timer.totalSeconds > 0 ? remaining / timer.totalSeconds : 1;
  const offset   = CIRCUMFERENCE * (1 - progress);
  document.getElementById('timer-progress').style.strokeDashoffset = offset;

  // Label + button
  const labelEl  = document.getElementById('timer-label');
  const startBtn = document.getElementById('timer-start');
  const startTxt = document.getElementById('timer-start-text');

  if (timer.running) {
    labelEl.textContent  = 'focusing';
    startTxt.textContent = 'Pause';
    startBtn.classList.add('running');
    document.getElementById('timer-status').textContent = 'Stay with it. You\'re doing great.';
    document.getElementById('timer-status').className   = 'timer-status';
  } else {
    labelEl.textContent  = remaining === timer.totalSeconds ? 'ready' : 'paused';
    startTxt.textContent = remaining === timer.totalSeconds ? 'Start' : 'Resume';
    startBtn.classList.remove('running');
  }
}

function playDoneSound() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    // Two-tone chime
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.0);
  } catch (e) {}
}

/* ══════════════════════════════════════════════════
   SOS MODAL
══════════════════════════════════════════════════ */
function openSOSModal() {
  const done  = totalDone();
  const winsEl = document.getElementById('sos-wins');
  if (done > 0) {
    winsEl.textContent = 'By the way — you\'ve completed ' + done + ' task' + (done !== 1 ? 's' : '') + ' today. That counts.';
    winsEl.classList.add('visible');
  } else {
    winsEl.classList.remove('visible');
  }
}

/* ══════════════════════════════════════════════════
   NEW DAY / DAY RESET
══════════════════════════════════════════════════ */
function checkNewDay() {
  const today = todayStr();
  if (data.lastOpenedDate && data.lastOpenedDate !== today) {
    triggerNewDay(false);
  }
}

function triggerNewDay(manual) {
  const prevDate = data.lastOpenedDate;

  // Save yesterday's stats to history
  const doneYesterday  = data.tasks.filter(function (t) { return t.done; }).length;
  const totalYesterday = data.tasks.length;
  if (totalYesterday > 0) {
    data.history.push({
      date:      prevDate || todayStr(),
      completed: doneYesterday,
      total:     totalYesterday,
    });
    if (data.history.length > 30) data.history.shift(); // keep 30 days
  }

  // Reset tasks: move today's incomplete back to queue, clear done
  data.tasks.forEach(function (t) {
    if (t.inToday && !t.done) {
      t.inToday = false;
    }
    t.done        = false;
    t.completedAt = null;
    t.inToday     = false; // All go to queue on new day — user picks fresh 3
  });

  data.brainState    = null;
  data.brainStateDate = null;
  data.lastOpenedDate = todayStr();
  saveData();

  renderTopbar();
  renderStateCard();
  renderTodaySlots();
  renderQueue();

  // Show day summary
  showDaySummary(doneYesterday, totalYesterday, prevDate, manual);
}

function showDaySummary(done, total, date, manual) {
  const titleEl   = document.getElementById('summary-title');
  const messageEl = document.getElementById('summary-message');
  const statsEl   = document.getElementById('summary-stats');

  if (done === 0 && total === 0) {
    if (!manual) return; // silent if nothing happened yesterday
    titleEl.textContent   = 'Fresh start.';
    messageEl.textContent = 'New day, new 3 tasks. Pick your brain state and let\'s go.';
    statsEl.innerHTML     = '';
  } else {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    if (done === total && total > 0) {
      titleEl.textContent = 'You crushed it.';
      messageEl.textContent = 'Every task done. That\'s a real win — carry that forward.';
    } else if (done > 0) {
      titleEl.textContent   = 'Good work.';
      messageEl.textContent = 'You got things done yesterday. The rest is waiting in your queue, no judgment.';
    } else {
      titleEl.textContent   = 'New day, fresh start.';
      messageEl.textContent = 'Yesterday is done. Your tasks are back in the queue whenever you\'re ready.';
    }
    statsEl.innerHTML =
      '<div class="summary-stat"><div class="summary-stat__num">' + done + '</div><div class="summary-stat__label">completed</div></div>' +
      '<div class="summary-stat"><div class="summary-stat__num">' + total + '</div><div class="summary-stat__label">total tasks</div></div>' +
      '<div class="summary-stat"><div class="summary-stat__num">' + pct + '%</div><div class="summary-stat__label">done rate</div></div>';
  }

  openModal('modal-daysummary');
}

/* ══════════════════════════════════════════════════
   MODALS
══════════════════════════════════════════════════ */
function openModal(id) {
  if (id === 'modal-brainstate') renderStateGrid();
  if (id === 'modal-sos')        openSOSModal();
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

/* ══════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════ */
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ══════════════════════════════════════════════════
   START
══════════════════════════════════════════════════ */
initGate();
