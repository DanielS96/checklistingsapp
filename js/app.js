import { loadCategories, loadChecklists } from './api.js'

const app = document.getElementById('app')

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

// ================= LEVEL =================
function getLevel(percent){
  if(percent < 20) return 'Новичок'
  if(percent < 50) return 'Любитель'
  if(percent < 80) return 'Продвинутый'
  return 'Мастер'
}

// ================= INIT =================
async function init(){
  try {
    state.categories = await loadCategories()
  } catch (e) {
    console.error(e)
    state.categories = []
  }
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

  let categoriesWithProgress = []

  try {
    categoriesWithProgress = await Promise.all(
      (state.categories || []).map(async (c)=>{
        const lists = await loadChecklists(c.id) || []
        const total = lists.length
        const done = lists.filter(l => progress[l.id]).length
        const percent = total ? Math.round(done / total * 100) : 0
        return { ...c, percent }
      })
    )
  } catch (e) {
    console.error(e)
  }

  const percent = categoriesWithProgress.length
    ? Math.round(categoriesWithProgress.reduce((a,c)=>a+c.percent,0)/categoriesWithProgress.length)
    : 0

  const level = getLevel(percent)

  categoriesWithProgress.sort((a,b)=> (b.percent||0) - (a.percent||0))

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

    ${(categoriesWithProgress || []).map(c=>`
      <div class="card category" onclick="openCategory('${c.id}')">
        <div class="category-header">
          <div>
            <div class="category-title">${c.icon || ''} ${c.title || 'Без названия'}</div>
            <div style="font-size:13px;color:#666;margin-top:4px;">
              ${c.description || ''}
            </div>
          </div>
          <div class="category-percent">${c.percent || 0}%</div>
        </div>

        <div class="progress-bar">
          <div class="progress-fill" style="width:${c.percent || 0}%"></div>
        </div>
      </div>
    `).join('')}
  `
}

// ================= CATEGORY =================
window.openCategory = async (id)=>{
  try {
    state.category = id
    state.checklists = await loadChecklists(id) || []
    state.screen = 'list'
  } catch (e) {
    console.error(e)
    state.checklists = []
  }
  render()
}

// ================= STATUS =================
function getStatus(id){
  const progress = getProgress()
  const opened = getOpened()

  if(progress[id]) return {text:'Выполнен', class:'done'}
  if(opened[id]) return {text:'Не завершен', class:'progress'}
  return {text:'Новый', class:'new'}
}

// ================= LIST =================
function renderList(){

  const list = Array.isArray(state.checklists) ? state.checklists : []

  app.innerHTML = `
    <button class="btn btn-ghost" onclick="goBack()">← Назад</button>

    ${list.map(c=>{
      const s = getStatus(c.id)

      return `
        <div class="card" onclick="openChecklist('${c.id}')">

          <div class="card-row">
            <div>
              <div style="font-weight:700;font-size:16px;">
                ${c.title || 'Без названия'}
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
            <button class="btn btn-primary"
              onclick="event.stopPropagation(); pay('${c.id}')">
              Оплатить ${c.price} ⭐
            </button>
          ` : ''}
        </div>
      `
    }).join('')}
  `
}

// ================= PAYMENT (STARS) =================
async function pay(checklistId){

  try {
    const userId = "web_" + Math.random().toString(36).slice(2)

    const res = await fetch("https://checklistings.dan-svistunov.workers.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, checklistId })
    })

    const data = await res.json()

    if(data?.ok && data.url){
      window.location.href = data.url
    } else {
      alert(data?.error || "Ошибка оплаты")
    }

  } catch (e) {
    console.error(e)
    alert("Ошибка соединения с оплатой")
  }
}

window.pay = pay

// ================= CHECKLIST =================
window.openChecklist = (id)=>{
  setOpened(id)
  state.current = (state.checklists || []).find(x=>x.id===id)
  state.screen = 'check'
  render()
}

function renderCheck(){

  const c = state.current || { items: [] }

  app.innerHTML = `
    <button class="btn btn-ghost" onclick="goBack()">← Назад</button>

    <h2>${c.title || ''}</h2>

    ${(c.items || []).map((item,i)=>`
      <div class="item">
        <div class="item-header" onclick="toggle(${i})">
          ${item.emoji || ''} ${item.title || ''}
        </div>

        <div class="item-body" id="i${i}">
          <p>${item.text || ''}</p>
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

// ================= BACK =================
window.goBack = ()=>{
  state.screen = state.screen === 'check' ? 'list' : 'categories'
  render()
}

init()
