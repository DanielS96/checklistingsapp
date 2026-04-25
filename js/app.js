import { loadCategories, loadChecklists, createInvoice, getPaymentStatus } from './api.js'

const app = document.getElementById('app')
const tg = window.Telegram?.WebApp

let state = {
  screen:'categories',
  categories:[],
  category:null,
  checklists:[],
  current:null
}

/* ===== PAYMENT STATE ===== */

let paidMap = JSON.parse(localStorage.getItem('paidMap') || '{}')

const isPaid = id => !!paidMap[id]

const setPaid = id => {
  paidMap[id] = true
  localStorage.setItem('paidMap', JSON.stringify(paidMap))
}

/* ===== INIT ===== */

async function init(){
  state.categories = await loadCategories()
  render()
}

/* ===== PAYMENT FLOW ===== */

async function payChecklist(id){
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
}

/* ===== RENDER ===== */

function render(){
  if(state.screen==='categories') renderCategories()
  if(state.screen==='list') renderList()
  if(state.screen==='check') renderCheck()
}

/* ===== CATEGORIES ===== */

async function renderCategories(){
  const progress = {}

  const enriched = await Promise.all(
    state.categories.map(async c=>{
      const list = await loadChecklists(c.id)
      return {...c, count:list.length}
    })
  )

  app.innerHTML = `
    <h1>Checklistings</h1>

    ${enriched.map(c=>`
      <div class="card" onclick="openCategory('${c.id}')">
        <div class="category-title">${c.icon} ${c.title}</div>
        <div style="font-size:13px;color:#666">${c.description}</div>
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

/* ===== LIST ===== */

function renderList(){
  app.innerHTML = `
    <button class="btn btn-ghost" onclick="back()">← Назад</button>

    ${state.checklists.map(c=>{
      const locked = !isPaid(c.id)

      return `
        <div class="card ${locked?'locked':''}" onclick="openChecklist('${c.id}')">

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

window.openChecklist = (id)=>{
  if(!isPaid(id)){
    payChecklist(id)
    return
  }

  state.current = state.checklists.find(x=>x.id===id)
  state.screen = 'check'
  render()
}

/* ===== CHECK ===== */

function renderCheck(){
  const c = state.current

  app.innerHTML = `
    <button class="btn btn-ghost" onclick="back()">← Назад</button>

    <h2>${c.title}</h2>

    ${(c.items||[]).map((i,n)=>`
      <div class="item">
        <div class="item-header" onclick="toggle(${n})">
          ${i.emoji} ${i.title}
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

/* ===== BACK ===== */

window.back = ()=>{
  if(state.screen==='check') state.screen='list'
  else state.screen='categories'
  render()
}

init()
