import { loadCategories, loadChecklists } from './api.js'

const app = document.getElementById('app')

let state = {
  screen: 'categories',
  categories: [],
  category: null,
  checklists: [],
  current: null
}

// ===== STORAGE =====
const getProgress = () => JSON.parse(localStorage.getItem('progress') || '{}')
const getOpened = () => JSON.parse(localStorage.getItem('opened') || '{}')

const setDone = (id)=>{
  const p = getProgress()
  p[id] = true
  localStorage.setItem('progress', JSON.stringify(p))
}

const setOpened = (id)=>{
  const o = getOpened()
  o[id] = true
  localStorage.setItem('opened', JSON.stringify(o))
}

// ===== LEVEL =====
function getLevel(percent){
  if(percent < 20) return 'Новичок'
  if(percent < 50) return 'Любитель'
  if(percent < 80) return 'Продвинутый'
  return 'Мастер'
}

// ===== INIT =====
async function init(){
  state.categories = await loadCategories()
  render()
}

function render(){
  if(state.screen === 'categories') renderCategories()
  if(state.screen === 'list') renderList()
  if(state.screen === 'check') renderCheck()
}

// ===================== CATEGORIES =====================
async function renderCategories(){
  const progress = getProgress()

  const categoriesWithProgress = await Promise.all(
    state.categories.map(async (c)=>{
      const lists = await loadChecklists(c.id)
      const total = lists.length
      const done = lists.filter(l => progress[l.id]).length
      const percent = total ? Math.round(done / total * 100) : 0
      return { ...c, percent }
    })
  )

  const percent = Math.round(
    categoriesWithProgress.reduce((acc,c)=>acc+c.percent,0) / categoriesWithProgress.length
  )

  const level = getLevel(percent)

  categoriesWithProgress.sort((a,b)=> b.percent - a.percent)

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

    ${categoriesWithProgress.map(c=>`
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
  `
}

// ===================== CATEGORY =====================
window.openCategory = async (id)=>{
  state.category = id
  state.checklists = await loadChecklists(id)
  state.screen = 'list'
  render()
}

function getStatus(id){
  const progress = getProgress()
  const opened = getOpened()

  if(progress[id]) return {text:'Выполнен', class:'done'}
  if(opened[id]) return {text:'Не завершен', class:'progress'}
  return {text:'Новый', class:'new'}
}

// ===================== LIST =====================
function renderList(){
  app.innerHTML = `
    <button class="btn btn-ghost" onclick="goBack()">← Назад</button>

    ${state.checklists.map(c=>{
      const s = getStatus(c.id)

      return `
        <div class="card" onclick="openChecklist('${c.id}')">
          <div class="card-row">
            <div>
              <div style="font-weight:700;font-size:16px;">
                ${c.title}
              </div>

              ${c.subtitle ? `
                <div class="checklist-subtitle">
                  ${c.subtitle}
                </div>
              ` : ''}
            </div>

            <div class="status ${s.class}">
              ${s.text}
            </div>
          </div>

          ${c.price ? `
            <button class="btn btn-primary" onclick="event.stopPropagation(); pay('${c.id}')">
              Оплатить ${c.price} ⭐
            </button>
          ` : ''}
        </div>
      `
    }).join('')}
  `
}

// ===================== PAYMENT =====================
async function pay(checklistId){

  const userId = "guest_" + Math.random().toString(36).slice(2)

  const res = await fetch("https://checklistings.dan-svistunov.workers.dev", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      userId,
      checklistId
    })
  })

  const data = await res.json()

  if(data.ok){
    window.location.href = data.url
  } else {
    alert(data.error || "Ошибка оплаты")
  }
}

window.pay = pay

// ===================== CHECKLIST =====================
window.openChecklist = (id)=>{
  setOpened(id)
  state.current = state.checklists.find(x=>x.id===id)
  state.screen = 'check'
  render()
}

function renderCheck(){
  const c = state.current

  app.innerHTML = `
    <button class="btn btn-ghost" onclick="goBack()">← Назад</button>

    <h2>${c.title}</h2>

    ${(c.items || []).map((item,i)=>`
      <div class="item">
        <div class="item-header" onclick="toggle(${i})">
          ${item.emoji} ${item.title}
        </div>

        <div class="item-body" id="i${i}">
          <p>${item.text}</p>
        </div>
      </div>
    `).join('')}
  `
}

window.toggle = (i)=>{
  const item = document.querySelectorAll('.item')[i]
  const body = document.getElementById('i'+i)

  const isOpen = body.style.display === 'block'
  body.style.display = isOpen ? 'none' : 'block'
  item.classList.toggle('open')
}

// ===================== BACK =====================
window.goBack = ()=>{
  if(state.screen === 'check') state.screen = 'list'
  else state.screen = 'categories'
  render()
}

init()
