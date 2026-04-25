import { loadCategories, loadChecklists } from './api.js'

const app = document.getElementById('app')

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
const getPaid = () => JSON.parse(localStorage.getItem('paid') || '{}')

const setPaid = (id)=>{
  const p = getPaid()
  p[id] = true
  localStorage.setItem('paid', JSON.stringify(p))
}

// ================= INIT =================
async function init(){
  state.categories = await loadCategories()
  render()
}

function render(){
  if(state.screen === 'categories') renderCategories()
  if(state.screen === 'list') renderList()
  if(state.screen === 'check') renderCheck()
}

// ================= CATEGORIES =================
async function renderCategories(){

  const progress = getProgress()

  const categories = await Promise.all(
    state.categories.map(async (c)=>{
      const lists = await loadChecklists(c.id)
      const done = lists.filter(l => progress[l.id]).length
      const percent = lists.length ? Math.round(done / lists.length * 100) : 0
      return { ...c, percent }
    })
  )

  const total = categories.length
    ? Math.round(categories.reduce((a,b)=>a+b.percent,0)/categories.length)
    : 0

  app.innerHTML = `
    <h1>Checklistings</h1>

    <div class="dashboard">
      <div class="dashboard-title">Ваш прогресс</div>
      <div class="dashboard-level">Пользователь</div>

      <div class="dashboard-bar">
        <div class="dashboard-fill" style="width:${total}%"></div>
      </div>

      <div style="margin-top:6px;">${total}% завершено</div>
    </div>

    ${categories.map(c=>`
      <div class="card category" onclick="openCategory('${c.id}')">
        <div class="category-header">
          <div>
            <div class="category-title">${c.icon || ''} ${c.title}</div>
            <div style="font-size:13px;color:#666;margin-top:4px;">
              ${c.description || ''}
            </div>
          </div>
          <div class="category-percent">${c.percent}%</div>
        </div>

        <div class="progress-bar">
          <div class="progress-fill" style="width:${c.percent}%"></div>
        </div>
      </div>
    `).join('')}
  `
}

// ================= CATEGORY =================
window.openCategory = async (id)=>{
  state.category = id
  state.checklists = await loadChecklists(id)
  state.screen = 'list'
  render()
}

// ================= STATUS =================
function getStatus(id){
  const progress = getProgress()
  const opened = getOpened()
  const paid = getPaid()

  if(progress[id]) return {text:'Выполнен', class:'done'}
  if(opened[id]) return {text:'Не завершен', class:'progress'}
  if(!paid[id] && state.checklists.find(x=>x.id===id)?.price) {
    return {text:'🔒 Заблокирован', class:'new'}
  }
  return {text:'Новый', class:'new'}
}

// ================= LIST =================
function renderList(){

  const list = state.checklists || []
  const paid = getPaid()

  app.innerHTML = `
    <button class="btn btn-ghost" onclick="goBack()">← Назад</button>

    ${list.map(c=>{
      const locked = c.price && !paid[c.id]
      const s = getStatus(c.id)

      return `
        <div class="card" onclick="openChecklist('${c.id}')">

          <div class="card-row">
            <div>
              <div style="font-weight:700;font-size:16px;">
                ${c.title}
              </div>

              ${c.subtitle ? `
                <div class="checklist-subtitle">${c.subtitle}</div>
              ` : ''}
            </div>

            <div class="status ${s.class}">
              ${s.text}
            </div>
          </div>

          ${locked ? `
            <button class="btn btn-primary"
              onclick="event.stopPropagation(); pay('${c.id}')">
              🔒 Купить за ${c.price} ⭐
            </button>
          ` : ''}
        </div>
      `
    }).join('')}
  `
}

// ================= PAYMENT =================
async function pay(checklistId){

  const userId = "web_" + Math.random().toString(36).slice(2)

  try {
    const res = await fetch("https://checklistings.dan-svistunov.workers.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, checklistId })
    })

    const data = await res.json()

    if(data?.ok){
      // временно считаем как оплачено (MVP)
      setPaid(checklistId)
      window.location.href = data.url
    } else {
      alert(data.error || "Ошибка оплаты")
    }

  } catch (e) {
    alert("Ошибка соединения")
  }
}

window.pay = pay

// ================= CHECKLIST =================
window.openChecklist = (id)=>{
  const paid = getPaid()

  const item = state.checklists.find(x=>x.id===id)

  // блок если не куплено
  if(item?.price && !paid[id]){
    alert("Сначала оплати доступ")
    return
  }

  state.current = item
  state.screen = 'check'
  render()
}

// ================= CHECK VIEW =================
function renderCheck(){

  const c = state.current

  app.innerHTML = `
    <button class="btn btn-ghost" onclick="goBack()">← Назад</button>

    <h2>${c.title}</h2>

    ${c.description ? `
      <div class="checklist-description">${c.description}</div>
    ` : ''}

    ${(c.items || []).map((item,i)=>`
      <div class="item">
        <div class="item-header" onclick="toggle(${i})">
          ${item.emoji || ''} ${item.title}
        </div>

        <div class="item-body" id="i${i}">
          <p>${item.text || ''}</p>

          ${item.source ? `<div style="font-size:12px;color:#888;margin-top:8px;">📚 ${item.source}</div>` : ''}

          ${item.tip ? `<div style="margin-top:8px;padding:10px;background:#f2f2f7;border-radius:10px;font-size:13px;">💡 ${item.tip}</div>` : ''}
        </div>
      </div>
    `).join('')}

    ${renderQuiz(c)}
  `
}

// ================= QUIZ =================
function renderQuiz(c){
  if(!c.quiz) return ''

  return `
    <div class="quiz-section">
      <div class="quiz-title">🧠 Мини-тест</div>

      ${c.quiz.map((q,i)=>`
        <div class="quiz-question">
          <p>${q.q}</p>

          ${q.a.map((a,j)=>`
            <label class="quiz-option">
              <input type="radio" name="q${i}" value="${j}">
              ${a}
            </label>
          `).join('')}
        </div>
      `).join('')}
    </div>
  `
}

window.toggle = (i)=>{
  const item = document.querySelectorAll('.item')[i]
  const body = document.getElementById('i'+i)

  const open = body.style.display === 'block'
  body.style.display = open ? 'none' : 'block'
  item.classList.toggle('open')
}

// ================= BACK =================
window.goBack = ()=>{
  state.screen = state.screen === 'check' ? 'list' : 'categories'
  render()
}

init()
