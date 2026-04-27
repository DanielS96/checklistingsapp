console.log('💰 Payments module loading...');

const WORKER_URL = 'https://checklistings.dan-svistunov.workers.dev';
const CHECKLIST_PRICE = 1;

let tg = null;
let userId = null;

// Ждем Telegram API
async function waitForTelegram() {
  console.log('⏳ Waiting for Telegram...');
  
  for (let i = 0; i < 50; i++) {
    if (window.Telegram && window.Telegram.WebApp) {
      tg = window.Telegram.WebApp;
      console.log('✅ Telegram found at attempt', i);
      break;
    }
    await new Promise(r => setTimeout(r, 100));
  }

  if (!tg) {
    console.log('❌ Telegram not found');
    return false;
  }

  try {
    tg.ready();
    tg.expand();
    userId = tg.initDataUnsafe?.user?.id;
    console.log('✅ Telegram ready, userId:', userId);
    return true;
  } catch (e) {
    console.error('Error:', e);
    return false;
  }
}

const readyPromise = waitForTelegram();

// Хранилище оплат
function getPaid() {
  try { return JSON.parse(localStorage.getItem('paidChecklists') || '{}'); }
  catch { return {}; }
}

function setPaid(id) {
  const paid = getPaid();
  paid[id] = true;
  localStorage.setItem('paidChecklists', JSON.stringify(paid));
}

export function isPaid(id) {
  return getPaid()[id] === true;
}

export function needsPayment(checklist, category) {
  if (!checklist) return false;
  if (isPaid(checklist.id)) return false;
  if (category && category.free_checklist === checklist.id) return false;
  return true;
}

// Создание инвойса
async function createInvoice(title, checklistId) {
  const payload = JSON.stringify({
    checklist_id: checklistId,
    user_id: userId,
    timestamp: Date.now(),
    random: Math.random().toString(36).substring(7)
  });

  console.log('📡 Создание инвойса...');
  
  const response = await fetch(`${WORKER_URL}/api/create-invoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      title: title.substring(0, 32),
      description: `Доступ к чек-листу "${title}"`.substring(0, 255),
      payload: payload,
      prices: [{ label: 'Чек-лист', amount: CHECKLIST_PRICE }]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || 'Ошибка сервера');
  }

  const data = await response.json();
  if (!data.invoice_url) throw new Error('Нет ссылки на оплату');
  
  console.log('✅ Инвойс создан');
  return data.invoice_url;
}

// Открытие оплаты
function openInvoice(url) {
  return new Promise((resolve) => {
    console.log('📱 Открытие оплаты...');
    
    tg.openInvoice(url, (status) => {
      console.log('💳 Статус:', status);
      
      if (status === 'paid') {
        resolve({ success: true });
      } else if (status === 'failed') {
        resolve({ success: false, error: 'load_failed' });
      } else {
        resolve({ success: false, status });
      }
    });
  });
}

// Главная функция оплаты
export async function payForChecklist(checklistId, title) {
  console.log('=== payForChecklist ===');
  
  const ready = await readyPromise;
  
  if (!ready || !tg) {
    alert('Оплата доступна только в Telegram\nОткройте приложение через бота');
    return false;
  }

  if (!userId) {
    alert('Не удалось идентифицировать пользователя');
    return false;
  }

  try {
    // Создаем инвойс
    const invoiceUrl = await createInvoice(title, checklistId);
    
    // Даем Telegram время подготовиться
    await new Promise(r => setTimeout(r, 300));
    
    // Открываем оплату
    let result = await openInvoice(invoiceUrl);
    
    // Если Load failed - создаем новый инвойс и пробуем еще раз
    if (result.error === 'load_failed') {
      console.log('🔄 Load failed, создаем новый инвойс...');
      
      const newInvoiceUrl = await createInvoice(title, checklistId);
      await new Promise(r => setTimeout(r, 500));
      result = await openInvoice(newInvoiceUrl);
      
      // Если опять fail - последняя попытка
      if (result.error === 'load_failed') {
        console.log('🔄 Вторая попытка...');
        const lastInvoiceUrl = await createInvoice(title, checklistId);
        await new Promise(r => setTimeout(r, 500));
        result = await openInvoice(lastInvoiceUrl);
      }
    }

    if (result.success) {
      setPaid(checklistId);
      return true;
    } else if (result.error === 'load_failed') {
      alert('Не удалось открыть оплату.\n\nПопробуйте:\n1. Проверить интернет\n2. Перезапустить Telegram\n3. Нажать кнопку еще раз');
      return false;
    }
    
    return false;
  } catch (e) {
    console.error('Payment error:', e);
    alert('Ошибка: ' + e.message);
    return false;
  }
}

// Модальное окно оплаты
export function showPaymentModal(checklistId, title, onSuccess) {
  const existing = document.querySelector('.modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>⭐ Доступ к чек-листу</h3>
      <p style="margin:8px 0;">${title}</p>
      <p style="font-size:16px;font-weight:bold;color:#ff9500;margin:12px 0;">${CHECKLIST_PRICE} ⭐</p>
      <p style="font-size:13px;color:#666;margin-bottom:16px;">Доступ навсегда</p>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost" id="modal-cancel" style="flex:1;">Отмена</button>
        <button class="btn btn-primary" id="modal-pay" style="flex:1;">Оплатить</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById('modal-cancel').onclick = () => modal.remove();
  document.getElementById('modal-pay').onclick = async function() {
    this.disabled = true;
    this.textContent = '⏳';
    const ok = await payForChecklist(checklistId, title);
    if (ok) {
      modal.remove();
      if (onSuccess) onSuccess();
    } else {
      this.disabled = false;
      this.textContent = 'Оплатить';
    }
  };
}

export function getPrice() {
  return CHECKLIST_PRICE;
}

console.log('💰 Payments module loaded');
