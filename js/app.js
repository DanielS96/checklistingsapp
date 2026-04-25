import { loadCategories, loadChecklists } from './api.js'

const tg = window.Telegram?.WebApp
const app = document.getElementById('app')

const BACKEND_URL = "https://checklistings.dan-svistunov.workers.dev"

let state = {
  screen: 'categories',
  categories: [],
  category: null,
  checklists: [],
  current: null
}

// ================= STORAGE =================

const getProgress = () => JSON.parse(localStorage.getItem('progress') || '{}')
const getOpened = () => JSON.parse(localStorage.getItem('opened') || '{}')

const setOpened = (id) => {
  const o = getOpened()
  o[id] = true
  localStorage.setItem('opened', JSON.stringify(o))
}

const isPaid = (id) => {
  return localStorage.getItem("paid_" + id) === "true"
}

// ================= INIT =================

async function init() {
  state.categories = await loadCategories()
  render()
}

function render() {
  if (state.screen === 'categories') renderCategories()
  if (state.screen === 'list') renderList()
  if (state.screen === 'check') renderCheck()
}

// ================= CATEGORIES (КАК БЫЛО) =================

async function renderCategories() {

  const progress = getProgress()

  const categoriesWithProgress = await Promise.all(
    state.categories.map(async (c) => {
      const lists = await loadChecklists(c.id)
      const total = lists.length
      const done = lists.filter(l => progress[l.id]).length
      const percent = total ? Math.round(done / total * 100) : 0
      return { ...c, percent }
    })
  )

  app.innerHTML = `
    <h1>Checklistings</h1>

    ${categoriesWithProgress.map(c => `
      <div class="card category" onclick="openCategory('${c.id}')">
        <div>
          <div class="category-title">${c.icon} ${c.title}</div>
          <div>${c.description}</div>
        </div>
        <div>${c.percent}%</div>
      </div>
    `).join('')}
  `
}

// ================= CATEGORY =================

window.openCategory = async (id) => {
  state.category = id
  state.checklists = await loadChecklists(id)
  state.screen = 'list'
  render()
}

// ================= LIST =================

function renderList() {
  app.innerHTML = `
    <button onclick="goBack()">← Назад</button>

    ${state.checklists.map(c => `
      <div class="card" onclick="openChecklist('${c.id}')">
        <b>${c.title}</b>
        <div>${isPaid(c.id) ? "Куплено ⭐" : "100 ⭐"}</div>
      </div>
    `).join('')}
  `
}

// ================= PAYWALL =================

window.openChecklist = (id) => {

  const checklist = state.checklists.find(x => x.id === id)

  if (!isPaid(id)) {
    return showPayModal(checklist)
  }

  setOpened(id)
  state.current = checklist
  state.screen = 'check'
  render()
}

// ================= PAYMENT (FIXED) =================

async function showPayModal(checklist) {

  const modal = document.createElement('div')
  modal.className = 'modal'

  modal.innerHTML = `
    <div class="modal-content">
      <h3>🔒 Платный чек-лист</h3>
      <p>Стоимость: <b>100 ⭐ Stars</b></p>

      <button class="btn btn-primary" id="payBtn">Оплатить</button>
      <button class="btn btn-ghost" onclick="this.closest('.modal').remove()">Отмена</button>
    </div>
  `

  document.body.appendChild(modal)

  document.getElementById("payBtn").onclick = async () => {

    const userId = tg?.initDataUnsafe?.user?.id

    const res = await fetch(`${BACKEND_URL}/create-invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        checklistId: checklist.id,
        title: checklist.title
      })
    })

    const data = await res.json()

    console.log("INVOICE:", data)

    // ❗ ВАЖНО:
    // Telegram Stars opens invoice in BOT CHAT automatically
    // НЕ используем openInvoice вообще

    modal.remove()

    tg.showPopup({
      title: "Оплата ⭐",
      message: "Заверши оплату в чате с ботом",
      buttons: [{ type: "ok" }]
    })
  }
}

// ================= CHECKLIST =================

function renderCheck() {
  const c = state.current

  app.innerHTML = `
    <button onclick="goBack()">← Назад</button>

    <h2>${c.title}</h2>

    ${c.description ? `<p>${c.description}</p>` : ''}

    ${(c.items || []).map((item, i) => `
      <div class="item">
        <div onclick="toggle(${i})">
          ${item.emoji} ${item.title}
        </div>

        <div id="i${i}" style="display:none">
          <p>${item.text}</p>

          ${item.source ? `<div>📚 ${item.source}</div>` : ''}

          ${item.tip ? `<div>💡 ${item.tip}</div>` : ''}
        </div>
      </div>
    `).join('')}
  `
}

// ================= TOGGLE =================

window.toggle = (i) => {
  const el = document.getElementById('i' + i)
  el.style.display = el.style.display === 'block' ? 'none' : 'block'
}

// ================= BACK =================

window.goBack = () => {
  if (state.screen === 'check') state.screen = 'list'
  else state.screen = 'categories'
  render()
}

init()
