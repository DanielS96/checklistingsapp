import { loadCategories, loadChecklists } from './api.js'

const app = document.getElementById('app')

let state = {
  categories: [],
  progress: JSON.parse(localStorage.getItem('progress') || '{}')
}

/* ---------------- PROGRESS ---------------- */

function getDone(id){
  return !!state.progress[id]
}

function setDone(id){
  state.progress[id] = true
  localStorage.setItem('progress', JSON.stringify(state.progress))
}

/* ---------------- LEVEL ---------------- */

function getLevel(percent){
  if(percent < 20) return 'Новичок'
  if(percent < 50) return 'Любитель'
  if(percent < 80) return 'Продвинутый'
  return 'Мастер'
}

/* ---------------- INIT ---------------- */

async function init(){
  state.categories = await loadCategories()

  render()
}

/* ---------------- RENDER ---------------- */

async function render(){

  const categoriesWithProgress = await Promise.all(
    state.categories.map(async c=>{
      const lists = await loadChecklists(c.id)

      const total = lists.length
      const done = lists.filter(l => getDone(l.id)).length

      const percent = total ? Math.round(done / total * 100) : 0

      return { ...c, percent }
    })
  )

  const totalPercent = categoriesWithProgress.length
    ? Math.round(categoriesWithProgress.reduce((a,b)=>a+b.percent,0) / categoriesWithProgress.length)
    : 0

  const level = getLevel(totalPercent)

  app.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <h1>Checklistings</h1>
    </div>

    <div class="card">
      <div>Уровень: <b>${level}</b></div>
      <div>Прогресс: ${totalPercent}%</div>
    </div>

    ${categoriesWithProgress.map(c=>`
      <div class="card" onclick="openCategory('${c.id}')">
        <b>${c.icon} ${c.title}</b>
        <div>${c.description}</div>
        <div style="margin-top:6px;font-size:12px;">
          ${c.percent}% выполнено
        </div>
      </div>
    `).join('')}
  `
}

/* ---------------- CATEGORY CLICK ---------------- */

window.openCategory = async (id)=>{
  const lists = await loadChecklists(id)

  app.innerHTML = `
    <button onclick="init()">← Назад</button>

    <h2>Чек-листы</h2>

    ${lists.map(l=>`
      <div class="card" onclick="toggleDone('${l.id}')">
        <b>${l.title}</b>
        <div>${getDone(l.id) ? '✔ выполнено' : '○ не выполнено'}</div>
      </div>
    `).join('')}
  `
}

/* ---------------- TOGGLE ---------------- */

window.toggleDone = (id)=>{
  setDone(id)
  render()
}

/* ---------------- START ---------------- */

init()
