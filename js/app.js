import { loadCategories, loadChecklists, CHECKLIST_PRICE } from './api.js';

const app = document.getElementById('app');

// URL вашего Cloudflare Worker
const WORKER_URL = 'https://checklistings.dan-svistunov.workers.dev/'; // ЗАМЕНИТЕ НА ВАШ URL

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

const getPaidChecklists = () => {
  try {
    return JSON.parse(localStorage.getItem('paidChecklists') || '{}');
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

const setPaid = (id) => {
  const paid = getPaidChecklists();
  paid[id] = true;
  localStorage.setItem('paidChecklists', JSON.stringify(paid));
  // Синхронизируем с другими вкладками
  window.dispatchEvent(new CustomEvent('paymentUpdated', { detail: { checklistId: id } }));
};

const isPaid = (id) => {
  return getPaidChecklists()[id] === true;
};

// Функция для восстановления покупок с сервера
async function restorePurchases() {
  if (!tg) {
    console.log('Не в Telegram, пропускаем восстановление покупок');
    return;
  }
  
  const userId = tg.initDataUnsafe?.user?.id;
  if (!userId) {
    console.log('Не удалось получить ID пользователя');
    return;
  }
  
  try {
    const response = await fetch(`${WORKER_URL}/api/get-purchases?user_id=${userId}`);
    
    if (!response.ok) {
      throw new Error('Ошибка получения покупок');
    }
    
    const data = await response.json();
    
    if (data.purchases && data.purchases.length > 0) {
      const paidChecklists = getPaidChecklists();
      let hasNewPurchases = false;
      
      data.purchases.forEach(purchase => {
        if (!paidChecklists[purchase.checklist_id]) {
          paidChecklists[purchase.checklist_id] = true;
          hasNewPurchases = true;
        }
      });
      
      if (hasNewPurchases) {
        localStorage.setItem('paidChecklists', JSON.stringify(paidChecklists));
        console.log('Восстановлены покупки:', data.purchases.length);
      }
    }
  } catch (error) {
    console.error('Ошибка восстановления покупок:', error);
  }
}

// Функция для проверки, является ли чек-лист платным
function isChecklistPaid(checklist, category) {
  // Если чек-лист помечен как бесплатный в данных
  if (checklist.isFree) return false;
  
  // Если это бесплатный чек-лист категории
  if (category && category.free_checklist === checklist.id) return false;
  
  // Если уже оплачен
  if (isPaid(checklist.id)) return false;
  
  return true;
}

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
  
  // Показываем загрузку
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

// Создание инвойса и оплата
async function payForChecklist(checklistId, checklistTitle) {
  if (!tg) {
    // Для тестирования в браузере
    console.log('Тестовый режим: симуляция оплаты');
    handleSuccessfulPayment(checklistId);
    return;
  }

  try {
    // Получаем ID пользователя
    const userId = tg.initDataUnsafe?.user?.id;
    if (!userId) {
      throw new Error('Не удалось получить ID пользователя');
    }

    // Показываем индикатор загрузки
    showLoadingModal('Создание счета...');

    // Генерируем уникальный payload
    const payload = JSON.stringify({
      checklist_id: checklistId,
      user_id: userId,
      timestamp: Date.now()
    });

    // Создаем инвойс через наш Worker
    const response = await fetch(`${WORKER_URL}/api/create-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        title: checklistTitle.substring(0, 32),
        description: `Доступ к чек-листу "${checklistTitle}"`.substring(0, 255),
        payload: payload,
        prices: [{
          label: 'Доступ к чек-листу',
          amount: CHECKLIST_PRICE
        }]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.details || 'Ошибка создания счета');
    }

    const data = await response.json();
    
    // Закрываем индикатор загрузки
    closeLoadingModal();
    
    if (!data.success || !data.invoice_url) {
      throw new Error('Неверный ответ сервера');
    }

    // Открываем окно оплаты Telegram
    tg.openInvoice(data.invoice_url, async (status) => {
      console.log('Статус оплаты:', status);
      
      if (status === 'paid') {
        // Проверяем статус платежа на сервере
        try {
          const verifyResponse = await fetch(`${WORKER_URL}/api/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: userId,
              checklist_id: checklistId
            })
          });
          
          const verifyData = await verifyResponse.json();
          
          if (verifyData.paid) {
            handleSuccessfulPayment(checklistId);
          } else {
            // Даже если сервер не подтвердил, пробуем открыть
            // (Telegram уже подтвердил оплату)
            console.log('Платеж выполнен, но не подтвержден сервером. Открываем чек-лист.');
            handleSuccessfulPayment(checklistId);
          }
        } catch (error) {
          console.error('Ошибка верификации:', error);
          // Все равно открываем, так как Telegram подтвердил оплату
          handleSuccessfulPayment(checklistId);
        }
      } else if (status === 'failed') {
        showErrorModal('Оплата не прошла. Попробуйте еще раз.');
      } else if (status === 'cancelled') {
        console.log('Оплата отменена пользователем');
      }
    });

  } catch (error) {
    console.error('Ошибка оплаты:', error);
    closeLoadingModal();
    showErrorModal(`Ошибка: ${error.message}`);
  }
}

// Обработка успешной оплаты
function handleSuccessfulPayment(checklistId) {
  console.log('Успешная оплата чек-листа:', checklistId);
  
  // Сохраняем статус оплаты
  setPaid(checklistId);
  
  // Показываем уведомление об успехе
  showSuccessNotification('✅ Доступ открыт!');
  
  // Обновляем текущий экран если нужно
  if (state.screen === 'list') {
    // Находим чек-лист и открываем его
    const checklist = state.checklists.find(c => c.id === checklistId);
    if (checklist) {
      setTimeout(() => {
        openChecklist(checklistId);
      }, 1000);
    } else {
      // Перезагружаем список
      renderList();
    }
  }
}

// Модальное окно загрузки
function showLoadingModal(message) {
  const existingModal = document.querySelector('.modal');
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'loading-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div style="font-size:18px;margin-bottom:12px;">⏳</div>
      <p>${message}</p>
    </div>
  `;
  document.body.appendChild(modal);
}

function closeLoadingModal() {
  const modal = document.getElementById('loading-modal');
  if (modal) modal.remove();
}

// Модальное окно ошибки
function showErrorModal(message) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'error-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div style="font-size:24px;margin-bottom:12px;">❌</div>
      <p>${message}</p>
      <button class="btn btn-primary" onclick="document.getElementById('error-modal').remove()">
        OK
      </button>
    </div>
  `;
  document.body.appendChild(modal);
}

// Уведомление об успехе
function showSuccessNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #34c759;
    color: white;
    padding: 12px 24px;
    border-radius: 12px;
    font-weight: 600;
    z-index: 2000;
    animation: slideDown 0.3s ease, fadeOut 0.3s ease 2s forwards;
    box-shadow: 0 4px 12px rgba(52, 199, 89, 0.3);
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 2500);
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

      <div style="margin-bottom:16px;">
        <button class="btn btn-ghost" onclick="restorePurchasesUI()">
          🔄 Восстановить покупки
        </button>
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

// Восстановление покупок через UI
window.restorePurchasesUI = async () => {
  showLoadingModal('Восстановление покупок...');
  await restorePurchases();
  closeLoadingModal();
  
  if (state.screen === 'categories') {
    render();
  }
  
  showSuccessNotification('✅ Покупки восстановлены');
};

// ===== КАТЕГОРИЯ =====
window.openCategory = async (id) => {
  try {
    showLoadingModal('Загрузка чек-листов...');
    
    state.category = state.categories.find(c => c.id === id);
    state.checklists = await loadChecklists(id);
    state.screen = 'list';
    
    closeLoadingModal();
    render();
  } catch (error) {
    console.error('Ошибка загрузки категории:', error);
    closeLoadingModal();
    showErrorModal('Ошибка загрузки чек-листов');
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

  const freeCount = state.checklists.filter(c => 
    !isChecklistPaid(c, currentCategory)
  ).length;
  
  const paidCount = state.checklists.filter(c => 
    isChecklistPaid(c, currentCategory) && isPaid(c.id)
  ).length;

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
      const isPaidChecklist = isChecklistPaid(c, currentCategory);

      return `
        <div class="card ${isPaidChecklist ? 'paid-card' : ''}" 
             onclick="${isPaidChecklist ? `handlePaidChecklistClick('${c.id}', '${c.title.replace(/'/g, "\\'")}')` : `openChecklist('${c.id}')`}">
          <div class="card-row">
            <div style="flex:1;">
              <div style="font-weight:700;font-size:16px;display:flex;align-items:center;gap:8px;">
                ${c.title}
                ${isPaidChecklist ? '<span style="font-size:14px;">🔒</span>' : '<span style="font-size:14px;">📖</span>'}
              </div>

              ${c.subtitle ? `
                <div class="checklist-subtitle">
                  ${c.subtitle}
                </div>
              ` : ''}
              
              <div style="margin-top:8px;font-size:13px;display:flex;align-items:center;gap:4px;">
                ${isPaidChecklist ? `
                  <span style="color:#ff9500;">⭐ ${CHECKLIST_PRICE} звезд</span>
                ` : `
                  <span style="color:#34c759;">✓ Бесплатно</span>
                `}
              </div>
            </div>

            <div class="status ${s.class}">
              ${s.text}
            </div>
          </div>
          
          ${isPaidChecklist ? `
            <div style="margin-top:12px;">
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
  modal.id = 'payment-modal';
  
  modal.innerHTML = `
    <div class="modal-content">
      <h3>⭐ Доступ к чек-листу</h3>
      <p style="margin:8px 0;">${checklistTitle}</p>
      
      <div style="background:#f2f2f7;border-radius:12px;padding:12px;margin:16px 0;">
        <p style="font-size:16px;font-weight:bold;color:#ff9500;margin:0;">
          Стоимость: ${CHECKLIST_PRICE} ⭐
        </p>
      </div>
      
      <div style="font-size:14px;color:#666;margin-bottom:16px;">
        <p style="margin:4px 0;">✅ Доступ навсегда</p>
        <p style="margin:4px 0;">🔄 Можно восстановить</p>
        <p style="margin:4px 0;">📱 Работает на всех устройствах</p>
      </div>
      
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost" onclick="closePaymentModal()" style="flex:1;">
          Отмена
        </button>
        <button class="btn btn-primary" onclick="processPayment('${checklistId}', '${checklistTitle.replace(/'/g, "\\'")}')" style="flex:1;">
          ⭐ Оплатить ${CHECKLIST_PRICE}
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// Закрыть модальное окно оплаты
window.closePaymentModal = () => {
  const modal = document.getElementById('payment-modal');
  if (modal) modal.remove();
};

// Обработка оплаты
window.processPayment = async (checklistId, checklistTitle) => {
  closePaymentModal();
  await payForChecklist(checklistId, checklistTitle);
};

// ===== ЧЕКЛИСТ =====
window.openChecklist = (id) => {
  const checklist = state.checklists.find(x => x.id === id);
  
  if (!checklist) {
    showErrorModal('Чек-лист не найден');
    return;
  }
  
  // Проверяем, оплачен ли чек-лист
  if (isChecklistPaid(checklist, state.category)) {
    showPaymentModal(checklist.id, checklist.title);
    return;
  }
  
  setOpened(id);
  state.current = checklist;
  state.screen = 'check';
  render();
  
  // Прокрутка вверх
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
      <div style="font-size:14px;color:#666;margin-bottom:8px;">
        ${c.subtitle}
      </div>
    ` : ''}

    ${c.description ? `
      <div class="checklist-description">
        ${c.description}
      </div>
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
  
  // Проверяем, все ли вопросы отвечены
  let allAnswered = true;
  c.quiz.forEach((q, i) => {
    const v = document.querySelector(`input[name="q${i}"]:checked`);
    if (!v) allAnswered = false;
  });
  
  if (!allAnswered) {
    showErrorModal('Пожалуйста, ответьте на все вопросы');
    return;
  }
  
  let score = 0;

  c.quiz.forEach((q, i) => {
    const v = document.querySelector(`input[name="q${i}"]:checked`);
    if (v && Number(v.value) === q.correct) score++;
  });

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'quiz-result-modal';

  const success = score === c.quiz.length;

  // Вибрация
  if (navigator.vibrate) {
    navigator.vibrate(success ? [100, 50, 100] : [200]);
  }

  // Звук
  try {
    const audio = new Audio(
      success
        ? 'https://assets.mixkit.co/sfx/preview/mixkit-achievement-bell-600.mp3'
        : 'https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3'
    );
    audio.volume = 0.4;
    audio.play().catch(() => {});
  } catch (e) {
    // Игнорируем ошибки звука
  }

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
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn btn-ghost" onclick="closeQuizModal(false)">Вернуться</button>
          <button class="btn btn-primary" onclick="retryQuiz()">Пройти снова</button>
        </div>
      </div>
    `;
  }

  document.body.appendChild(modal);
};

window.closeQuizModal = (done) => {
  const modal = document.getElementById('quiz-result-modal');
  if (modal) modal.remove();
  if (done) goBack();
};

window.retryQuiz = () => {
  const modal = document.getElementById('quiz-result-modal');
  if (modal) modal.remove();
  
  // Сбрасываем все radio buttons
  document.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.checked = false;
  });
  
  // Прокручиваем к тесту
  const quizSection = document.querySelector('.quiz-section');
  if (quizSection) {
    quizSection.scrollIntoView({ behavior: 'smooth' });
  }
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

// Добавляем CSS анимации
const style = document.createElement('style');
style.textContent = `
  @keyframes slideDown {
    from {
      transform: translate(-50%, -100%);
      opacity: 0;
    }
    to {
      transform: translate(-50%, 0);
      opacity: 1;
    }
  }
  
  @keyframes fadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
  
  .paid-card {
    position: relative;
    background: linear-gradient(135deg, #fff, #f8f8f8);
    border: 1px solid #f0f0f0;
  }
`;
document.head.appendChild(style);

// Запуск приложения
init();

// Обработка события восстановления покупок из других вкладок
window.addEventListener('paymentUpdated', (event) => {
  console.log('Платеж обновлен в другой вкладке:', event.detail);
  if (state.screen === 'list') {
    render();
  }
});

// Экспорт для тестирования
if (typeof window !== 'undefined') {
  window.app = {
    init,
    render,
    getState: () => state,
    restorePurchases
  };
}
