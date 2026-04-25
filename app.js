import {
  loadCategories,
  loadChecklists,
  createInvoice
} from './api.js'

const app = document.getElementById('app')
const tg = window.Telegram?.WebApp

let state = {
  screen:'categories',
  categories:[],
  category:null,
  checklists:[],
  current:null
}

/* =========================
   💾 STORAGE
   ========================= */

const getProgress = () =>
  JSON.parse(localStorage.getItem('progress') || '{}')

const getOpened = () =>
  JSON.parse(localStorage.getItem('opened') || '{}')

let paidMap = JSON.parse(localStorage.getItem('paidMap') || '{}')

const isPaid = (id)=> !!paidMap[id]

const setPaid = (id)=>{
  paidMap[id] = true
  localStorage.setItem('paidMap', JSON.stringify(paidMap))
}

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

/* =========================
   INIT
   ========================= */

async function init(){
  state.categories = await loadCategories()
  render()
}

/* =========================
   PAYMENT
   ========================= */

async function payChecklist(id){

  try {
    const { invoiceUrl } = await createInvoice(id)

    if(tg){
      tg.openInvoice(invoiceUrl, (status)=>{
        if(status === 'paid'){
          setPaid(id)
          render()
        }
      })
    } else {
      window.location.href = invoiceUrl
    }

  } catch (e) {
    console.error("payment error", e)
    alert("Ошибка оплаты")
  }
}

/* =========================
   RENDER
   ========================= */

function render(){
  if(state.screen==='categories') renderCategories()
  if(state.screen==='list') renderList()
  if(state.screen==='check') renderCheck()
}

/* =========================
   DASHBOARD (FIXED)
   ========================= */

function getLevel(percent){
  if(percent < 20) return 'Новичок'
  if(percent < 50) return 'Любитель'
  if(percent < 80) return 'Продвинутый'
  return 'Мастер'
}

/* =========================
   CATEGORIES (RESTORED)
   ========================= */

async function renderCategories(){

  const progress = getProgress()

  const enriched = await Promise.all(
    state.categories.map(async c=>{
      const lists = await loadChecklists(c.id)

      const total = lists.length
      const done = lists.filter(x => progress[x.id]).length
      const percent = total ? Math.round(done / total * 100) : 0

      return {...c, percent}
    })
  )

  const totalPercent = Math.round(
    enriched.reduce((a,b)=>a+b.percent,0) / enriched.length
  )

  const level = getLevel(totalPercent)

  app.innerHTML = `
    <h1>Checklistings</h1>

    <div class="dashboard">
      <div class="dashboard-title">Ваш прогресс</div>
      <div class="dashboard-level">${level}</div>

      <div class="dashboard-bar">
        <div class="dashboard-fill" style="width:${totalPercent}%"></div>
      </div>

      <div style="margin-top:6px;">
        ${totalPercent}% завершено
      </div>
    </div>

    ${enriched.map(c=>`
      <div class="card" onclick="openCategory('${c.id}')">
        <div>
          <b>${c.icon} ${c.title}</b>
          <div style="font-size:13px;color:#666">${c.description}</div>
        </div>
      </div>
    `).join('')}
  `
}

window.openCategory = async (id)=>{
  state.category = id
  state.checklists = await loadChecklists(id)
  state.screen = 'list'
  render()
}

/* =========================
   LIST (FIXED LOCK LOGIC)
   ========================= */

function renderList(){
  app.innerHTML = `
    <button onclick="back()">← Назад</button>

    ${state.checklists.map(c=>{
      const locked = !isPaid(c.id)

      return `
        <div class="card ${locked?'locked':''}"
             onclick="openChecklist('${c.id}')">

          <div style="display:flex;justify-content:space-between;">
            <div>
              <b>${c.title}</b>
              <span class="price-badge">⭐ 100</span>
              <div style="font-size:13px;color:#666">${c.subtitle||''}</div>
            </div>

            <div>${locked?'🔒':'✔️'}</div>
          </div>

        </div>
      `
    }).join('')}
  `
}

/* =========================
   OPEN CHECKLIST (FIXED)
   ========================= */

window.openChecklist = async (id)=>{

  if(!isPaid(id)){
    await payChecklist(id)
    return
  }

  setOpened(id)

  state.current = state.checklists.find(x=>x.id===id)
  state.screen = 'check'
  render()
}

/* =========================
   CHECKLIST VIEW
   ========================= */

function renderCheck(){

  const c = state.current

  app.innerHTML = `
    <button onclick="back()">← Назад</button>

    <h2>${c.title}</h2>

    ${(c.items||[]).map((i,n)=>`
      <div class="item">
        <div class="item-header" onclick="toggle(${n})">
          ${i.emoji||''} ${i.title}
        </div>

        <div class="item-body" id="i${n}">
          ${i.text}
        </div>
      </div>
    `).join('')}
  `
}

window.toggle = (i)=>{
  const el = document.getElementById('i'+i)
  el.style.display = el.style.display==='block'?'none':'block'
}

/* =========================
   BACK
   ========================= */

window.back = ()=>{
  if(state.screen==='check') state.screen='list'
  else state.screen='categories'
  render()
}

init()
