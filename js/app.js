import { loadCategories, loadChecklists } from './api.js';
import { isPaid, needsPayment, showPaymentModal, getPrice } from './payments.js';

const app = document.getElementById('app');

let state = {
  screen: 'categories',
  categories: [],
  category: null,
  checklists: [],
  current: null
};

const getProgress = () => {
  try { return JSON.parse(localStorage.getItem('progress') || '{}'); }
  catch { return {}; }
};

const getOpened = () => {
  try { return JSON.parse(localStorage.getItem('opened') || '{}'); }
  catch { return {}; }
};

const setDone = (id) => {
  const p = getProgress();
  p[id] = true;
  localStorage.setItem('progress', JSON.stringify(p));
};

const setOpened = (id) => {
  const o = getOpened();
  o[id] = true;
  localStorage.setItem('opened', JSON.stringify(o));
};

function getLevel(percent) {
  if (percent < 20) return 'Новичок';
  if (percent < 50) return 'Любитель';
  if (percent < 80) return 'Продвинутый';
  return 'Мастер';
}

async function init() {
  try {
    state.categories = await loadCategories();
    render();
  } catch (e) {
    console.error('Init error:', e);
    app.innerHTML = '<p style="text-align:center;padding:40px;">Ошибка загрузки</p>';
  }
}

function render() {
  if (state.screen === 'categories') renderCategories();
  else if (state.screen === 'list') renderList();
  else if (state.screen === 'check') renderCheck();
}

async function renderCategories() {
  const progress = getProgress();
  const categoriesWithProgress = await Promise.all(
    state.categories.map(async (c) => {
      const lists = await loadChecklists(c.id);
      const total = lists.length;
      const done = lists.filter(l => progress[l.id]).length;
      const percent = total ? Math.round(done / total * 100) : 0;
      return { ...c, percent };
    })
  );

  const percent = Math.round(
    categoriesWithProgress.reduce((acc, c) => acc + c.percent, 0) / categoriesWithProgress.length
  );
  const level = getLevel(percent);
  categoriesWithProgress.sort((a, b) => b.percent - a.percent);

  app.innerHTML = `
    <h1>Checklistings</h1>
    <div class="dashboard">
      <div class="dashboard-title">Ваш прогресс</div>
      <div class="dashboard-level">${level}</div>
      <div class="dashboard-bar"><div class="dashboard-fill" style="width:${percent}%"></div></div>
      <div style="margin-top:6px;">${percent}% завершено</div>
    </div>
    ${categoriesWithProgress.map(c => `
      <div class="card category" onclick="openCategory('${c.id}')">
        <div class="category-header">
          <div>
            <div class="category-title">${c.icon} ${c.title}</div>
            <div style="font-size:13px;color:#666;margin-top:4px;">${c.description}</div>
          </div>
          <div class="category-percent">${c.percent}%</div>
        </div>
        <div class="progress-bar" style="margin-top:8px;"><div class="progress-fill" style="width:${c.percent}%"></div></div>
      </div>
    `).join('')}
  `;
}

window.openCategory = async (id) => {
  try {
    state.category = state.categories.find(c => c.id === id);
    state.checklists = await loadChecklists(id);
    state.screen = 'list';
    render();
  } catch (e) {
    console.error('Error:', e);
  }
};

function getStatus(id) {
  const progress = getProgress();
  const opened = getOpened();
  if (progress[id]) return { text: 'Выполнен', class: 'done' };
  if (opened[id]) return { text: 'Не завершен', class: 'progress' };
  return { text: 'Новый', class: 'new' };
}

function renderList() {
  const price = getPrice();
  const cat = state.category;

  app.innerHTML = `
    <button class="btn btn-ghost" onclick="goBack()">← Назад</button>
    ${state.checklists.map(c => {
      const s = getStatus(c.id);
      const locked = needsPayment(c, cat);
      return `
        <div class="card" onclick="${locked ? `window.showPay('${c.id}', '${c.title.replace(/'/g, "\\'")}')` : `openChecklist('${c.id}')`}">
          <div class="card-row">
            <div>
              <div style="font-weight:700;font-size:16px;">${locked ? '🔒 ' : '📖 '}${c.title}</div>
              ${c.subtitle ? `<div class="checklist-subtitle">${c.subtitle}</div>` : ''}
            </div>
            <div style="text-align:right;">
              <div class="status ${s.class}">${s.text}</div>
              ${locked ? `<div style="font-size:14px;font-weight:600;color:#ff9500;margin-top:4px;">${price}⭐</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('')}
  `;
}

window.showPay = (id, title) => {
  const checklist = state.checklists.find(c => c.id === id);
  const subtitle = checklist?.subtitle || '';
  showPaymentModal(id, title, subtitle, () => openChecklist(id));
};

window.openChecklist = (id) => {
  setOpened(id);
  state.current = state.checklists.find(x => x.id === id);
  state.screen = 'check';
  render();
};

function renderCheck() {
  const c = state.current;
  app.innerHTML = `
    <button class="btn btn-ghost" onclick="goBack()">← Назад</button>
    <h2>${c.title}</h2>
    ${c.description ? `<div class="checklist-description">${c.description}</div>` : ''}
    ${(c.items || []).map((item, i) => `
      <div class="item">
        <div class="item-header" onclick="toggle(${i})">${item.emoji} ${item.title}</div>
        <div class="item-body" id="i${i}">
          <p>${item.text}</p>
          ${item.source ? `<div style="font-size:12px;color:#888;margin-top:8px;">📚 ${item.source}</div>` : ''}
          ${item.tip ? `<div style="margin-top:8px;padding:10px;background:#f2f2f7;border-radius:10px;font-size:13px;">💡 ${item.tip}</div>` : ''}
        </div>
      </div>
    `).join('')}
    ${renderQuiz(c)}
  `;
}

window.toggle = (i) => {
  const items = document.querySelectorAll('.item');
  const body = document.getElementById('i' + i);
  if (!items[i] || !body) return;
  const isOpen = body.style.display === 'block';
  body.style.display = isOpen ? 'none' : 'block';
  items[i].classList.toggle('open');
};

function renderQuiz(c) {
  if (!c.quiz || !c.quiz.length) return '';
  return `
    <div class="quiz-section">
      <div class="quiz-title">🧠 Мини-тест</div>
      ${c.quiz.map((q, i) => `
        <div class="quiz-question">
          <p>${q.q}</p>
          ${q.a.map((a, j) => `<label class="quiz-option"><input type="radio" name="q${i}" value="${j}"> ${a}</label>`).join('')}
        </div>
      `).join('')}
      <div style="text-align:center;margin-top:12px;"><button class="btn btn-primary" onclick="checkQuiz()">Проверить</button></div>
    </div>
  `;
}

window.checkQuiz = () => {
  const c = state.current;
  let score = 0;
  let all = true;
  
  c.quiz.forEach((q, i) => {
    const v = document.querySelector(`input[name="q${i}"]:checked`);
    if (!v) all = false;
    if (v && Number(v.value) === q.correct) score++;
  });

  if (!all) { alert('Ответьте на все вопросы'); return; }

  const modal = document.createElement('div');
  modal.className = 'modal';
  const ok = score === c.quiz.length;
  if (ok) setDone(c.id);

  modal.innerHTML = ok ? `
    <div class="modal-content">
      <h3>🎉 Отлично!</h3><p>${score}/${c.quiz.length}</p>
      <p>Ты прошёл чек-лист 🚀</p>
      <button class="btn btn-primary" onclick="closeModal(true)">Завершить</button>
    </div>
  ` : `
    <div class="modal-content">
      <h3>Результат</h3><p>${score}/${c.quiz.length}</p>
      <p>Попробуй ещё раз 🎯</p>
      <button class="btn btn-primary" onclick="closeModal(false)">Вернуться</button>
    </div>
  `;
  
  document.body.appendChild(modal);
};

window.closeModal = (done) => {
  const m = document.querySelector('.modal');
  if (m) m.remove();
  if (done) goBack();
};

window.goBack = () => {
  if (state.screen === 'check') state.screen = 'list';
  else state.screen = 'categories';
  render();
};

init();
