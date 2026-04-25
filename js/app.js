import { loadCategories, loadChecklists } from './api.js'

const tg = window.Telegram?.WebApp
const app = document.getElementById('app')

const BACKEND_URL = "https://checklistings.dan-svistunov.workers.dev"

// ================= STATE =================

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

const setDone = (id) => {
  const p = getProgress()
  p[id] = true
  localStorage.setItem('progress', JSON.stringify(p))
}

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

// ================= CATEGORIES =================

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

  const percent = Math.round(
    categoriesWithProgress.reduce((acc, c) => acc + c.percent, 0) /
    categoriesWithProgress.length
  )

  categoriesWithProgress.sort((a, b) => b.percent - a.percent)

  app.innerHTML = `
    <h1>Checklistings</h1>

    <div class="dashboard">
      <div>Прогресс: ${percent}%</div>
    </div>

    ${categoriesWithProgress.map(c => `
      <div class="card category" onclick="openCategory('${c.id}')">
        <div>
          <b>${c.icon} ${c.title}</b>
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

window.openChecklist = async (id) => {

  const checklist = state.checklists.find(x => x.id === id)

  if (!isPaid(id)) {
    return showPayModal(checklist)
  }

  setOpened(id)
  state.current = checklist
  state.screen = 'check'
  render()
}

// ================= PAYMENT =================

async function showPayModal(checklist) {

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

  console.log("INVOICE RESPONSE:", data)

  // ❗ ВАЖНО:
  // Telegram сам открывает оплату
  // ничего не вызываем вручную

  tg.showPopup({
    title: "Оплата ⭐",
    message: "Открой чат с ботом и заверши оплату",
    buttons: [{ type: "ok" }]
  })
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

          ${item.source ? `<small>📚 ${item.source}</small>` : ''}

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
