import { loadCategories, loadChecklists } from './api.js'


async function payTest(){

  try {
    const res = await fetch("https://checklistings.dan-svistunov.workers.dev", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    })

    const data = await res.json()

    console.log(data)

    if(data.ok){
      window.location.href = data.url
    } else {
      alert(data.error || "Payment error")
    }

  } catch (e) {
    alert("Network error")
    console.error(e)
  }
}

window.payTest = payTest

const app = document.getElementById('app')

let state = {
  screen: 'categories',
  categories: [],
  checklists: [],
  current: null,
  paid: JSON.parse(localStorage.getItem('paid') || '{}')
}

// ================= INIT =================
async function init(){
  state.categories = await loadCategories() || []
  render()
}

function render(){
  if(state.screen === 'categories') renderCategories()
  if(state.screen === 'list') renderList()
  if(state.screen === 'check') renderCheck()
}

// ================= CATEGORIES =================
function renderCategories(){

  app.innerHTML = `
    <h1>Checklistings</h1>

    ${state.categories.map(c=>`
      <div class="card" onclick="openCategory('${c.id}')">
        <div style="font-weight:700">${c.icon || ''} ${c.title}</div>
        <div style="color:#666;font-size:13px">${c.description || ''}</div>
      </div>
    `).join('')}
  `
}

// ================= OPEN CATEGORY =================
window.openCategory = async (id)=>{
  state.checklists = await loadChecklists(id) || []
  state.screen = 'list'
  render()
}

// ================= LIST =================
function renderList(){

  app.innerHTML = `
    <button class="btn btn-ghost" onclick="back()">← Назад</button>

    ${state.checklists.map(c=>{

      const locked = c.price && !state.paid[c.id]

      return `
        <div class="card" onclick="openChecklist('${c.id}')">

          <div style="font-weight:700">${c.title}</div>
          <div style="color:#666">${c.subtitle || ''}</div>

          ${locked ? `
            <button class="btn btn-primary"
              onclick="event.stopPropagation(); pay('${c.id}', ${c.price})">
              🔒 Купить за ${c.price} ⭐
            </button>
          ` : ''}
        </div>
      `
    }).join('')}
  `
}

// ================= PAYMENT =================
window.pay = async (id, price)=>{

  const res = await fetch("https://checklistings.dan-svistunov.workers.dev", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      userId: "web_" + Date.now(),
      checklistId: id,
      price
    })
  })

  const data = await res.json()

  if(data.ok){
    window.location.href = data.url
  } else {
    alert(data.error)
  }
}

// ================= OPEN CHECKLIST =================
window.openChecklist = (id)=>{

  const item = state.checklists.find(x=>x.id===id)

  if(!item){
    alert("not found")
    return
  }

  if(item.price && !state.paid[id]){
    alert("Сначала оплати")
    return
  }

  state.current = item
  state.screen = 'check'
  render()
}

// ================= CHECK =================
function renderCheck(){

  const c = state.current

  app.innerHTML = `
    <button onclick="back()">← Назад</button>

    <h2>${c.title}</h2>

    <p>${c.description || ''}</p>

    ${(c.items || []).map((i,k)=>`
      <div class="item">
        <div onclick="toggle(${k})">${i.title}</div>

        <div id="i${k}" style="display:none">
          <p>${i.text}</p>
          ${i.source ? `<small>${i.source}</small>` : ''}
          ${i.tip ? `<div>💡 ${i.tip}</div>` : ''}
        </div>
      </div>
    `).join('')}

    ${c.quiz ? `
      <div>
        <h3>Quiz</h3>
        ${c.quiz.map(q=>`
          <div>${q.q}</div>
        `).join('')}
      </div>
    ` : ''}
  `
}

// ================= TOGGLE =================
window.toggle = (i)=>{
  const el = document.getElementById('i'+i)
  el.style.display = el.style.display === 'block' ? 'none' : 'block'
}

// ================= BACK =================
window.back = ()=>{
  state.screen = state.screen === 'check' ? 'list' : 'categories'
  render()
}

init()
