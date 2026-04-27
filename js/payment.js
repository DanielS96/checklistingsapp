// Модуль для работы с платежами Telegram Stars

const WORKER_URL = 'https://your-worker.workers.dev'; // ЗАМЕНИТЕ НА ВАШ URL
const CHECKLIST_PRICE = 100; // Цена в звездах

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

// ===== ХРАНИЛИЩЕ =====
export const getPaidChecklists = () => {
  try {
    return JSON.parse(localStorage.getItem('paidChecklists') || '{}');
  } catch {
    return {};
  }
};

export const setPaid = (id) => {
  const paid = getPaidChecklists();
  paid[id] = true;
  localStorage.setItem('paidChecklists', JSON.stringify(paid));
  // Уведомляем другие вкладки
  window.dispatchEvent(new CustomEvent('paymentUpdated', { detail: { checklistId: id } }));
  // Сохраняем в историю платежей
  addPaymentHistory(id);
};

export const isPaid = (id) => {
  return getPaidChecklists()[id] === true;
};

// История платежей для аналитики
const addPaymentHistory = (checklistId) => {
  try {
    const history = JSON.parse(localStorage.getItem('paymentHistory') || '[]');
    history.push({
      checklistId,
      timestamp: Date.now(),
      date: new Date().toISOString()
    });
    // Храним последние 100 платежей
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    localStorage.setItem('paymentHistory', JSON.stringify(history));
  } catch (e) {
    console.error('Error saving payment history:', e);
  }
};

// ===== УВЕДОМЛЕНИЯ =====
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

export function showSuccessNotification(message) {
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

// ===== ПРОВЕРКА ДОСТУПА =====
export async function verifyChecklistAccess(checklistId) {
  if (!tg) {
    // В браузере проверяем только localStorage
    return isPaid(checklistId);
  }
  
  const userId = tg.initDataUnsafe?.user?.id;
  if (!userId) return isPaid(checklistId);
  
  try {
    const response = await fetch(`${WORKER_URL}/api/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        checklist_id: checklistId
      })
    });
    
    if (!response.ok) return isPaid(checklistId);
    
    const data = await response.json();
    
    if (data.paid && !isPaid(checklistId)) {
      // Синхронизируем с localStorage
      setPaid(checklistId);
    }
    
    return data.paid;
  } catch (error) {
    console.error('Access verification error:', error);
    return isPaid(checklistId);
  }
}

// ===== ОПЛАТА =====
export async function payForChecklist(checklistId, checklistTitle) {
  if (!tg) {
    console.log('Тестовый режим: симуляция оплаты');
    alert('Оплата работает только в Telegram мини-приложении');
    return false;
  }

  try {
    const userId = tg.initDataUnsafe?.user?.id;
    if (!userId) {
      throw new Error('Не удалось получить ID пользователя');
    }

    showLoadingModal('Создание счета...');

    // Генерируем уникальный payload
    const payload = JSON.stringify({
      checklist_id: checklistId,
      user_id: userId,
      timestamp: Date.now(),
      random: Math.random().toString(36).substring(7)
    });

    // Создаем инвойс через Worker
    const response = await fetch(`${WORKER_URL}/api/create-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    closeLoadingModal();
    
    if (!data.success || !data.invoice_url) {
      throw new Error('Неверный ответ сервера');
    }

    // Открываем окно оплаты
    return new Promise((resolve) => {
      tg.openInvoice(data.invoice_url, async (status) => {
        console.log('Payment status from Telegram:', status);
        
        if (status === 'paid') {
          showLoadingModal('Проверка оплаты...');
          
          // Ждем обработки webhook
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Проверяем статус с повторными попытками
          let isVerified = false;
          let retryCount = 0;
          const maxRetries = 5;
          
          while (!isVerified && retryCount < maxRetries) {
            try {
              const verifyResponse = await fetch(`${WORKER_URL}/api/verify-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  user_id: userId,
                  checklist_id: checklistId
                })
              });
              
              if (verifyResponse.ok) {
                const verifyData = await verifyResponse.json();
                if (verifyData.paid) {
                  isVerified = true;
                  break;
                }
              }
              
              retryCount++;
              if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            } catch (error) {
              console.error('Verification error:', error);
              retryCount++;
              if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          }
          
          closeLoadingModal();
          
          if (isVerified) {
            console.log('Payment verified, saving to localStorage');
            setPaid(checklistId);
            resolve(true);
          } else {
            console.error('Payment verification failed');
            showErrorModal(
              'Не удалось подтвердить оплату. ' +
              'Пожалуйста, нажмите "Восстановить покупки" через несколько минут.'
            );
            // Сохраняем в localStorage с пометкой "ожидает верификации"
            setPaid(checklistId);
            resolve(false);
          }
          
        } else if (status === 'failed') {
          showErrorModal('Оплата не прошла. Попробуйте еще раз.');
          resolve(false);
        } else if (status === 'cancelled') {
          console.log('Payment cancelled by user');
          resolve(false);
        } else {
          resolve(false);
        }
      });
    });

  } catch (error) {
    console.error('Payment error:', error);
    closeLoadingModal();
    showErrorModal(`Ошибка: ${error.message}`);
    return false;
  }
}

// ===== ВОССТАНОВЛЕНИЕ ПОКУПОК =====
export async function restorePurchases() {
  if (!tg) {
    console.log('Не в Telegram, пропускаем восстановление');
    return { restored: false, count: 0 };
  }
  
  const userId = tg.initDataUnsafe?.user?.id;
  if (!userId) {
    console.log('Не удалось получить ID пользователя');
    return { restored: false, count: 0 };
  }
  
  try {
    console.log('Restoring purchases for user:', userId);
    
    const response = await fetch(`${WORKER_URL}/api/get-purchases?user_id=${userId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch purchases');
    }
    
    const data = await response.json();
    console.log('Purchases from server:', data);
    
    if (data.purchases && data.purchases.length > 0) {
      const paidChecklists = getPaidChecklists();
      let restoredCount = 0;
      
      data.purchases.forEach(purchase => {
        if (!paidChecklists[purchase.checklist_id]) {
          paidChecklists[purchase.checklist_id] = true;
          restoredCount++;
          console.log('Restored purchase:', purchase.checklist_id);
        }
      });
      
      if (restoredCount > 0) {
        localStorage.setItem('paidChecklists', JSON.stringify(paidChecklists));
        return { restored: true, count: restoredCount };
      }
    }
    
    return { restored: false, count: 0 };
    
  } catch (error) {
    console.error('Ошибка восстановления покупок:', error);
    return { restored: false, count: 0, error: error.message };
  }
}

// ===== UI ДЛЯ ВОССТАНОВЛЕНИЯ =====
export async function restorePurchasesUI() {
  showLoadingModal('Восстановление покупок...');
  const result = await restorePurchases();
  closeLoadingModal();
  
  if (result.restored) {
    showSuccessNotification(`✅ Восстановлено покупок: ${result.count}`);
    return true;
  } else if (result.error) {
    showErrorModal('Ошибка восстановления. Проверьте соединение.');
    return false;
  } else {
    showSuccessNotification('✅ Все покупки уже восстановлены');
    return true;
  }
}

// ===== ОПРЕДЕЛЕНИЕ ПЛАТНОСТИ =====
export function isChecklistPaid(checklist, category) {
  if (checklist.isFree) return false;
  if (category && category.free_checklist === checklist.id) return false;
  if (isPaid(checklist.id)) return false;
  return true;
}

// ===== МОДАЛЬНОЕ ОКНО ОПЛАТЫ =====
export function showPaymentModal(checklistId, checklistTitle, onSuccess) {
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
        <button class="btn btn-ghost" onclick="window.closePaymentModal()" style="flex:1;">
          Отмена
        </button>
        <button class="btn btn-primary" id="payment-btn" style="flex:1;">
          ⭐ Оплатить ${CHECKLIST_PRICE}
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Добавляем обработчик на кнопку оплаты
  document.getElementById('payment-btn').addEventListener('click', async () => {
    const btn = document.getElementById('payment-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Обработка...';
    
    const success = await payForChecklist(checklistId, checklistTitle);
    
    if (success) {
      closePaymentModal();
      if (onSuccess) onSuccess(checklistId);
    } else {
      btn.disabled = false;
      btn.textContent = `⭐ Оплатить ${CHECKLIST_PRICE}`;
    }
  });
}

export function closePaymentModal() {
  const modal = document.getElementById('payment-modal');
  if (modal) modal.remove();
}

// ===== ИНФОРМАЦИЯ =====
export function getChecklistPrice() {
  return CHECKLIST_PRICE;
}

export function isTelegramWebApp() {
  return !!tg;
}

// Добавляем глобальные функции для HTML onclick
window.showPaymentModal = showPaymentModal;
window.closePaymentModal = closePaymentModal;
