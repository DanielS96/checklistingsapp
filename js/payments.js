console.log('💰 Payments module loading...');

const WORKER_URL = 'https://checklistings.dan-svistunov.workers.dev';
const CHECKLIST_PRICE = 0,1;

let tg = null;
let userId = null;

async function waitForTelegram() {
  for (let i = 0; i < 50; i++) {
    if (window.Telegram && window.Telegram.WebApp) {
      tg = window.Telegram.WebApp;
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

async function createInvoice(title, checklistId) {
  const payload = JSON.stringify({
    checklist_id: checklistId,
    user_id: userId,
    timestamp: Date.now(),
    random: Math.random().toString(36).substring(7)
  });

  console.log('📡 Creating invoice...');
  
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
  
  return data.invoice_url;
}

function openInvoice(url) {
  return new Promise((resolve) => {
    let resolved = false;

    const handleClose = (event) => {
      if (resolved) return;
      resolved = true;
      tg.offEvent('invoiceClosed', handleClose);
      console.log('✅ Invoice closed, payment successful');
      resolve({ success: true });
    };

    tg.onEvent('invoiceClosed', handleClose);

    try {
      tg.openInvoice(url, (status) => {
        console.log('Invoice callback status:', status);

        if (status === 'paid') {
          if (!resolved) {
            resolved = true;
            tg.offEvent('invoiceClosed', handleClose);
            resolve({ success: true });
          }
        } else if (status === 'failed') {
          if (!resolved) {
            resolved = true;
            tg.offEvent('invoiceClosed', handleClose);
            resolve({ success: false, error: 'failed' });
          }
        } else if (status === 'cancelled') {
          if (!resolved) {
            resolved = true;
            tg.offEvent('invoiceClosed', handleClose);
            resolve({ success: false, error: 'cancelled' });
          }
        }
      });
    } catch (e) {
      console.error('Error opening invoice:', e);
      if (!resolved) {
        resolved = true;
        tg.offEvent('invoiceClosed', handleClose);
        resolve({ success: false, error: 'exception', message: e.message });
      }
    }

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        tg.offEvent('invoiceClosed', handleClose);
        console.log('Payment timeout');
        resolve({ success: false, error: 'timeout' });
      }
    }, 120000);
  });
}

export async function payForChecklist(checklistId, title) {
  const ready = await readyPromise;

  if (!ready || !tg) {
    alert('Оплата доступна только в Telegram\nОткройте приложение через бота');
    return false;
  }

  if (!userId) {
    alert('Не удалось идентифицировать пользователя');
    return false;
  }

  const loadingModal = document.createElement('div');
  loadingModal.className = 'modal';
  loadingModal.innerHTML = `<div class="modal-content"><div style="font-size:18px;">⏳</div><p>Создание платежа...</p></div>`;
  document.body.appendChild(loadingModal);

  try {
    const invoiceUrl = await createInvoice(title, checklistId);
    loadingModal.remove();
    await new Promise(r => setTimeout(r, 300));

    console.log('Opening invoice...');
    const result = await openInvoice(invoiceUrl);
    console.log('Result:', result);

    if (result.success) {
      setPaid(checklistId);
      console.log('✅ Payment successful');
      return true;
    } else if (result.error === 'failed') {
      const retryModal = document.createElement('div');
      retryModal.className = 'modal';
      retryModal.innerHTML = `<div class="modal-content"><div style="font-size:18px;">⏳</div><p>Повторная попытка...</p></div>`;
      document.body.appendChild(retryModal);

      const newUrl = await createInvoice(title, checklistId);
      retryModal.remove();
      await new Promise(r => setTimeout(r, 500));

      const retryResult = await openInvoice(newUrl);
      if (retryResult.success) {
        setPaid(checklistId);
        return true;
      } else {
        alert('Оплата не прошла.\n\nПопробуйте еще раз.');
        return false;
      }
    } else if (result.error === 'cancelled') {
      console.log('Payment cancelled');
      return false;
    } else {
      console.log('Unknown result:', result);
      return false;
    }
  } catch (e) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(m => m.remove());
    console.error('Payment error:', e);
    alert('Ошибка: ' + e.message);
    return false;
  }
}

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
    modal.remove();
    const ok = await payForChecklist(checklistId, title);
    if (ok) {
      if (onSuccess) onSuccess();
    } else {
      showPaymentModal(checklistId, title, onSuccess);
    }
  };
}

export function getPrice() {
  return CHECKLIST_PRICE;
}
