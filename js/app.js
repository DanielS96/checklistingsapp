import { loadCategories, loadChecklists } from './api.js';
import { 
  getPaidChecklists, 
  setPaid, 
  isPaid, 
  verifyChecklistAccess,
  payForChecklist,
  restorePurchases,
  restorePurchasesUI,
  isChecklistPaid,
  showPaymentModal,
  closePaymentModal,
  showSuccessNotification,
  getChecklistPrice,
  isTelegramWebApp
} from './payments.js';

const app = document.getElementById('app');

// Удаляем все старые функции платежей, они теперь в payments.js

let state = {
  screen: 'categories',
  categories: [],
  category: null,
  checklists: [],
  current: null
};

// STORAGE
const getProgress = () => {
  try {
    return JSON.parse(localStorage.getItem('progress') || '{}');
  } catch {
    return {};
  }
};

const getOpened = () => {
  try {
    return JSON.parse(localStorage.getItem('opened') || '{}');
  } catch {
    return {};
  }
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

// Уровень
function getLevel(percent) {
  if (percent < 20) return 'Новичок';
  if (percent < 50) return 'Любитель';
  if (percent < 80) return 'Продвинутый';
  return 'Мастер';
}

// Инициализация
async function init() {
  console.log('Запуск приложения...');
  
  app.innerHTML = `
    <div style="text-align:center;padding:40px;">
      <div style="font-size:18px;color:#666;">Загрузка...</div>
    </div>
  `;
  
  await restorePurchases();
  
  try {
    state.categories = await loadCategories();
    render();
  } catch (error) {
    console.error('Ошибка инициализации:', error);
    app.innerHTML = `
      <div style="text-align:center;padding:40px;">
        <div style="font-size:18px;color:#ff3b30;">Ошибка загрузки</div>
        <button class="btn btn-primary" onclick="init()">Попробовать снова</button>
      </div>
    `;
  }
}

function render() {
  if (state.screen === 'categories') renderCategories();
  else if (state.screen === 'list') renderList();
  else if (state.screen === 'check') renderCheck();
}

// ===== КАТЕГОРИИ =====
async function renderCategories() {
  const progress = getProgress();

  try {
    const categoriesWithProgress = await Promise.all(
      state.categories.map(async (c) => {
        const lists = await loadChecklists(c.id);
        const total = lists.length;
        const done = lists.filter(l => progress[l.id]).length;
        const percent = total ? Math.round(done / total * 100) : 0;
        return { ...c, percent, total, done };
      })
    );

    const totalPercent = categoriesWithProgress.reduce((acc, c) => acc + c.percent, 0);
    const percent = categoriesWithProgress.length > 0 
      ? Math.round(totalPercent / categoriesWithProgress.length) 
      : 0;

    const level = getLevel(percent);

    categoriesWithProgress.sort((a, b) => b.percent - a.percent);

    app.innerHTML = `
      <h1>Checklistings</h1>

      <div class="dashboard">
        <div class="dashboard-title">Ваш прогресс</div>
        <div class="dashboard-level">${level}</div>

        <div class="dashboard-bar">
          <div class="dashboard-fill" style="width:${percent}%"></div>
        </div>

        <div style="margin-top:6px;">${percent}% завершено</div>
      </div>

      ${isTelegramWebApp() ? `
        <div style="margin-bottom:16px;">
          <button class="btn btn-ghost" onclick="window.restorePurchasesUI()">
            🔄 Восстановить покупки
          </button>
        </div>
      ` : ''}

      ${categoriesWithProgress.map(c => `
        <div class="card category" onclick="openCategory('${c.id}')">
          <div class="category-header">
            <div>
              <div class="category-title">${c.icon} ${c.title}</div>
              <div style="font-size:13px;color:#666;margin-top:4px;">
                ${c.description}
              </div>
            </div>
            <div class="category-percent">${c.percent}%</div>
          </div>

          <div class="progress-bar">
            <div class="progress-fill" style="width:${c.percent}%"></div>
          </div>
          
          <div style="font-size:12px;color:#999;margin-top:4px;">
            ${c.done}/${c.total} чек-листов
          </div>
        </div>
      `).join('')}
    `;
  } catch (error) {
    console.error('Ошибка рендеринга категорий:', error);
    app.innerHTML = `
      <div style="text-align:center;padding:40px;">
        <p>Ошибка загрузки категорий</p>
        <button class="btn btn-primary" onclick="init()">Перезагрузить</button>
      </div>
    `;
  }
}

// ===== КАТЕГОРИЯ =====
window.openCategory = async (id) => {
  try {
    state.category = state.categories.find(c => c.id === id);
    state.checklists = await loadChecklists(id);
    state.screen = 'list';
    render();
  } catch (error) {
    console.error('Ошибка загрузки категории:', error);
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
  const currentCategory = state.category;

  if (!currentCategory) {
    goBack();
    return;
  }

  const price = getChecklistPrice();
  const freeCount = state.checklists.filter(c => !isChecklistPaid(c, currentCategory)).length;
  const paidCount = state.checklists.filter(c => isPaid(c.id)).length;

  app.innerHTML = `
    <button class="btn btn-ghost" onclick="goBack()">← Назад</button>
    
    <h2>${currentCategory.icon} ${currentCategory.title}</h2>
    <div style="font-size:13px;color:#666;margin-bottom:16px;">
      ${currentCategory.description}
    </div>
    
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <div style="font-size:12px;background:#f2f2f7;padding:4px 8px;border-radius:8px;">
        🆓 Бесплатно: ${freeCount}
      </div>
      <div style="font-size:12px;background:#f2f2f7;padding:4px 8px;border-radius:8px;">
        ⭐ Куплено: ${paidCount}
      </div>
    </div>

    ${state.checklists.map(c => {
      const s = getStatus(c.id);
      const needsPayment = isChecklistPaid(c, currentCategory);

      return `
        <div class="card" onclick="${needsPayment ? 
          `window.showPaymentModal('${c.id}', '${c.title.replace(/'/g, "\\'")}', (id) => openChecklist(id))` : 
          `openChecklist('${c.id}')`}">
          <div class="card-row">
            <div style="flex:1;">
              <div style="font-weight:700;font-size:16px;">
                ${c.title}
                ${needsPayment ? ' 🔒' : ' 📖'}
              </div>

              ${c.subtitle ? `
                <div class="checklist-subtitle">${c.subtitle}</div>
              ` : ''}
              
              <div style="margin-top:8px;font-size:13px;">
                ${needsPayment ? 
                  `<span style="color:#ff9500;">⭐ ${price} звезд</span>` : 
                  `<span style="color:#34c759;">✓ Бесплатно</span>`
                }
              </div>
            </div>

            <div class="status ${s.class}">${s.text}</div>
          </div>
        </div>
      `;
    }).join('')}
  `;
}

// ===== ЧЕКЛИСТ =====
window.openChecklist = async (id) => {
  const checklist = state.checklists.find(x => x.id === id);
  
  if (!checklist) {
    return;
  }
  
  // Проверяем доступ
  const needsPayment = isChecklistPaid(checklist, state.category);
  
  if (needsPayment) {
    const hasAccess = await verifyChecklistAccess(id);
    
    if (hasAccess) {
      setPaid(id);
      showSuccessNotification('✅ Доступ восстановлен');
    } else {
      showPaymentModal(checklist.id, checklist.title, (id) => openChecklist(id));
      return;
    }
  }
  
  setOpened(id);
  state.current = checklist;
  state.screen = 'check';
  render();
  window.scrollTo(0, 0);
};

function renderCheck() {
  const c = state.current;
  
  if (!c) {
    goBack();
    return;
  }

  app.innerHTML = `
    <button class="btn btn-ghost" onclick="goBack()">← Назад</button>

    <h2>${c.title}</h2>

    ${c.subtitle ? `
      <div style="font-size:14px;color:#666;margin-bottom:8px;">${c.subtitle}</div>
    ` : ''}

    ${c.description ? `
      <div class="checklist-description">${c.description}</div>
    ` : ''}

    <div style="font-size:13px;color:#999;margin-bottom:16px;">
      ${c.items ? c.items.length : 0} пунктов • ${c.quiz ? c.quiz.length : 0} вопросов
    </div>

    ${(c.items || []).map((item, i) => `
      <div class="item">
        <div class="item-header" onclick="toggle(${i})">
          ${item.emoji || '📌'} ${item.title}
        </div>

        <div class="item-body" id="i${i}">
          <p>${item.text}</p>

          ${item.source ? `
            <div style="font-size:12px;color:#888;margin-top:8px;">
              📚 ${item.source}
            </div>
          ` : ''}

          ${item.tip ? `
            <div style="margin-top:8px;padding:10px;background:#f2f2f7;border-radius:10px;font-size:13px;">
              💡 ${item.tip}
            </div>
          ` : ''}
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
  
  if (isOpen) {
    items[i].classList.remove('open');
  } else {
    items[i].classList.add('open');
  }
};

// ===== КВИЗ =====
function renderQuiz(c) {
  if (!c.quiz || c.quiz.length === 0) return '';

  return `
    <div class="quiz-section">
      <div class="quiz-title">🧠 Мини-тест</div>

      ${c.quiz.map((q, i) => `
        <div class="quiz-question">
          <p>${q.q}</p>

          ${q.a.map((a, j) => `
            <label class="quiz-option">
              <input type="radio" name="q${i}" value="${j}">
              ${a}
            </label>
          `).join('')}
        </div>
      `).join('')}

      <div style="text-align:center;margin-top:12px;">
        <button class="btn btn-primary" onclick="checkQuiz()">Проверить</button>
      </div>
    </div>
  `;
}

window.checkQuiz = () => {
  const c = state.current;
  if (!c || !c.quiz) return;
  
  let allAnswered = true;
  c.quiz.forEach((q, i) => {
    const v = document.querySelector(`input[name="q${i}"]:checked`);
    if (!v) allAnswered = false;
  });
  
  if (!allAnswered) {
    alert('Пожалуйста, ответьте на все вопросы');
    return;
  }
  
  let score = 0;

  c.quiz.forEach((q, i) => {
    const v = document.querySelector(`input[name="q${i}"]:checked`);
    if (v && Number(v.value) === q.correct) score++;
  });

  const modal = document.createElement('div');
  modal.className = 'modal';

  const success = score === c.quiz.length;

  if (navigator.vibrate) {
    navigator.vibrate(success ? [100, 50, 100] : [200]);
  }

  try {
    const audio = new Audio(
      success
        ? 'https://assets.mixkit.co/sfx/preview/mixkit-achievement-bell-600.mp3'
        : 'https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3'
    );
    audio.volume = 0.4;
    audio.play().catch(() => {});
  } catch (e) {}

  if (success) {
    setDone(c.id);

    modal.innerHTML = `
      <div class="modal-content">
        <div style="font-size:48px;margin-bottom:12px;">🎉</div>
        <h3>Отлично!</h3>
        <p style="font-size:24px;font-weight:bold;color:#34c759;">${score}/${c.quiz.length}</p>
        <p>Ты полностью прошёл чек-лист! 🚀</p>
        <button class="btn btn-primary" onclick="closeQuizModal(true)">Завершить</button>
      </div>
    `;
  } else {
    modal.innerHTML = `
      <div class="modal-content">
        <div style="font-size:48px;margin-bottom:12px;">📝</div>
        <h3>Результат</h3>
        <p style="font-size:24px;font-weight:bold;color:#ff9500;">${score}/${c.quiz.length}</p>
        <p>Попробуй ещё раз — ты почти у цели 🎯</p>
        <button class="btn btn-primary" onclick="closeQuizModal(false)">Вернуться</button>
      </div>
    `;
  }

  document.body.appendChild(modal);
};

window.closeQuizModal = (done) => {
  const modal = document.querySelector('.modal');
  if (modal) modal.remove();
  if (done) goBack();
};

// ===== НАВИГАЦИЯ =====
window.goBack = () => {
  if (state.screen === 'check') {
    state.screen = 'list';
    state.current = null;
  } else {
    state.screen = 'categories';
    state.category = null;
    state.checklists = [];
  }
  render();
  window.scrollTo(0, 0);
};

// Инициализация
init();
