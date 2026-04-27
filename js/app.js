import { loadCategories, loadChecklists, CHECKLIST_PRICE } from './api.js';

const app = document.getElementById('app');

let state = {
  screen: 'categories',
  categories: [],
  category: null,
  checklists: [],
  current: null
};

// Инициализация Telegram WebApp
let tg = null;
try {
  if (window.Telegram && window.Telegram.WebApp) {
    tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
  }
} catch (e) {
  console.log('Не в Telegram окружении');
}

// STORAGE
const getProgress = () => JSON.parse(localStorage.getItem('progress') || '{}');
const getOpened = () => JSON.parse(localStorage.getItem('opened') || '{}');
const getPaidChecklists = () => JSON.parse(localStorage.getItem('paidChecklists') || '{}');

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

const setPaid = (id) => {
  const paid = getPaidChecklists();
  paid[id] = true;
  localStorage.setItem('paidChecklists', JSON.stringify(paid));
};

const isPaid = (id) => {
  return getPaidChecklists()[id] === true;
};

// Функция для проверки, является ли чек-лист платным
function isChecklistPaid(checklist, category) {
  // Если чек-лист помечен как бесплатный в данных
  if (checklist.isFree) return false;
  
  // Если это бесплатный чек-лист категории
  if (category.free_checklist === checklist.id) return false;
  
  // Если уже оплачен
  if (isPaid(checklist.id)) return false;
  
  return true;
}

// Уровень
function getLevel(percent) {
  if(percent < 20) return 'Новичок';
  if(percent < 50) return 'Любитель';
  if(percent < 80) return 'Продвинутый';
  return 'Мастер';
}

// Инициализация
async function init() {
  state.categories = await loadCategories();
  render();
}

function render() {
  if(state.screen === 'categories') renderCategories();
  if(state.screen === 'list') renderList();
  if(state.screen === 'check') renderCheck();
}

// Создание инвойса и оплата
async function payForChecklist(checklistId, checklistTitle) {
  if (!tg) {
    // Для тестирования в браузере
    alert('Оплата работает только в Telegram мини-приложении');
    // Для теста все равно открываем
    handleSuccessfulPayment(checklistId);
    return;
  }

  try {
    // Здесь должен быть запрос к вашему бэкенду для создания инвойса
    // В реальном приложении нужно отправлять запрос на ваш сервер
    // который использует Bot API для создания счета
    
    // Пример структуры инвойса
    const invoice = {
      title: checklistTitle,
      description: `Доступ к чек-листу "${checklistTitle}"`,
      payload: JSON.stringify({ checklist_id: checklistId }),
      currency: 'XTR', // валюта Telegram Stars
      prices: [{ amount: CHECKLIST_PRICE, label: 'Чек-лист' }]
    };

    // Отправляем запрос на создание инвойса через ваш бэкенд
    const response = await fetch('/api/create-invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoice)
    });

    if (!response.ok) {
      throw new Error('Ошибка создания счета');
    }

    const data = await response.json();
    
    // Открываем окно оплаты
    tg.openInvoice(data.invoice_url, (status) => {
      if (status === 'paid') {
        handleSuccessfulPayment(checklistId);
      } else {
        console.log('Оплата не завершена:', status);
      }
    });

  } catch (error) {
    console.error('Ошибка оплаты:', error);
    alert('Произошла ошибка при оплате. Попробуйте позже.');
  }
}

// Обработка успешной оплаты
function handleSuccessfulPayment(checklistId) {
  setPaid(checklistId);
  
  // Обновляем список чек-листов если нужно
  if (state.screen === 'list') {
    renderList();
  }
  
  // Открываем чек-лист
  setTimeout(() => {
    openChecklist(checklistId);
  }, 500);
}

// ===== КАТЕГОРИИ =====
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

      <div class="dashboard-bar">
        <div class="dashboard-fill" style="width:${percent}%"></div>
      </div>

      <div style="margin-top:6px;">${percent}% завершено</div>
    </div>

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
      </div>
    `).join('')}
  `;
}

// ===== КАТЕГОРИЯ =====
window.openCategory = async (id) => {
  state.category = id;
  state.checklists = await loadChecklists(id);
  state.screen = 'list';
  render();
};

function getStatus(id) {
  const progress = getProgress();
  const opened = getOpened();

  if(progress[id]) return {text:'Выполнен', class:'done'};
  if(opened[id]) return {text:'Не завершен', class:'progress'};
  return {text:'Новый', class:'new'};
}

function renderList() {
  const currentCategory = state.categories.find(c => c.id === state.category);
  
  app.innerHTML = `
    <button class="btn btn-ghost" onclick="goBack()">← Назад</button>

    ${state.checklists.map(c => {
      const s = getStatus(c.id);
      const isPaidChecklist = isChecklistPaid(c, currentCategory);

      return `
        <div class="card ${isPaidChecklist ? 'paid-card' : ''}" 
             onclick="${isPaidChecklist ? `handlePaidChecklistClick('${c.id}', '${c.title.replace(/'/g, "\\'")}')` : `openChecklist('${c.id}')`}">
          <div class="card-row">
            <div>
              <div style="font-weight:700;font-size:16px;">
                ${c.title}
                ${isPaidChecklist ? ' 🔒' : ' 📖'}
              </div>

              ${c.subtitle ? `
                <div class="checklist-subtitle">
                  ${c.subtitle}
                </div>
              ` : ''}
              
              ${isPaidChecklist ? `
                <div style="margin-top:8px;font-size:13px;color:#ff9500;">
                  ⭐ ${CHECKLIST_PRICE} звезд
                </div>
              ` : `
                <div style="margin-top:8px;font-size:13px;color:#34c759;">
                  ✓ Бесплатно
                </div>
              `}
            </div>

            <div class="status ${s.class}">
              ${s.text}
            </div>
          </div>
          
          ${isPaidChecklist ? `
            <div style="margin-top:8px;">
              <button class="btn btn-primary" style="width:100%;" 
                      onclick="event.stopPropagation(); handlePaidChecklistClick('${c.id}', '${c.title.replace(/'/g, "\\'")}')">
                ⭐ Купить за ${CHECKLIST_PRICE} звезд
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('')}
  `;
}

// Обработка клика по платному чек-листу
window.handlePaidChecklistClick = (checklistId, checklistTitle) => {
  showPaymentModal(checklistId, checklistTitle);
};

// Показать модальное окно оплаты
function showPaymentModal(checklistId, checklistTitle) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  
  modal.innerHTML = `
    <div class="modal-content">
      <h3>⭐ Доступ к чек-листу</h3>
      <p>${checklistTitle}</p>
      <p style="font-size:16px;font-weight:bold;color:#ff9500;">
        Стоимость: ${CHECKLIST_PRICE} звезд
      </p>
      <p style="font-size:14px;color:#666;">
        После оплаты чек-лист будет доступен навсегда
      </p>
      
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button class="btn btn-ghost" onclick="closePaymentModal()">
          Отмена
        </button>
        <button class="btn btn-primary" onclick="processPayment('${checklistId}', '${checklistTitle.replace(/'/g, "\\'")}')">
          ⭐ Оплатить ${CHECKLIST_PRICE} звезд
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// Закрыть модальное окно оплаты
window.closePaymentModal = () => {
  const modal = document.querySelector('.modal');
  if (modal) modal.remove();
};

// Обработка оплаты
window.processPayment = async (checklistId, checklistTitle) => {
  closePaymentModal();
  await payForChecklist(checklistId, checklistTitle);
};

// ===== ЧЕКЛИСТ =====
window.openChecklist = (id) => {
  setOpened(id);
  state.current = state.checklists.find(x => x.id === id);
  if (!state.current) {
    alert('Чек-лист не найден');
    return;
  }
  state.screen = 'check';
  render();
};

function renderCheck() {
  const c = state.current;
  if (!c) return;

  app.innerHTML = `
    <button class="btn btn-ghost" onclick="goBack()">← Назад</button>

    <h2>${c.title}</h2>

    ${c.description ? `
      <div class="checklist-description">
        ${c.description}
      </div>
    ` : ''}

    ${(c.items || []).map((item, i) => `
      <div class="item">
        <div class="item-header" onclick="toggle(${i})">
          ${item.emoji} ${item.title}
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
  const item = document.querySelectorAll('.item')[i];
  const body = document.getElementById('i' + i);
  if (!item || !body) return;
  
  const isOpen = body.style.display === 'block';
  body.style.display = isOpen ? 'none' : 'block';
  item.classList.toggle('open');
};

// ===== КВИЗ =====
function renderQuiz(c) {
  if(!c.quiz || c.quiz.length === 0) return '';

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
  
  let score = 0;

  c.quiz.forEach((q, i) => {
    const v = document.querySelector(`input[name="q${i}"]:checked`);
    if(v && Number(v.value) === q.correct) score++;
  });

  const modal = document.createElement('div');
  modal.className = 'modal';

  const success = score === c.quiz.length;

  // Вибрация
  if(navigator.vibrate) {
    navigator.vibrate(success ? [100, 50, 100] : [200]);
  }

  // Звук
  const audio = new Audio(
    success
      ? 'https://assets.mixkit.co/sfx/preview/mixkit-achievement-bell-600.mp3'
      : 'https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3'
  );
  audio.volume = 0.4;
  audio.play().catch(() => {});

  if(success) {
    setDone(c.id);

    modal.innerHTML = `
      <div class="modal-content">
        <h3>🎉 Отлично!</h3>
        <p>${score}/${c.quiz.length}</p>
        <p>Ты полностью прошёл чек-лист 🚀</p>
        <button class="btn btn-primary" onclick="closeModal(true)">Завершить</button>
      </div>
    `;
  } else {
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Результат</h3>
        <p>${score}/${c.quiz.length}</p>
        <p>Попробуй ещё раз — ты почти у цели 🎯</p>
        <button class="btn btn-primary" onclick="closeModal(false)">Вернуться</button>
      </div>
    `;
  }

  document.body.appendChild(modal);
};

window.closeModal = (done) => {
  const modal = document.querySelector('.modal');
  if (modal) modal.remove();
  if(done) goBack();
};

// НАЗАД
window.goBack = () => {
  if(state.screen === 'check') state.screen = 'list';
  else state.screen = 'categories';
  render();
};

init();
