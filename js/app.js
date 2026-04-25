import { loadCategories, loadChecklists } from './api.js'

const app = document.getElementById('app')

let state = {
  lang: 'en',
  screen: 'categories',
  categories: [],
  checklists: [],
  current: null
}

/* ---------------- I18N ---------------- */

const t = {
  ru: {
    back: 'Назад',
    progress: 'Ваш прогресс',
    completed: 'Выполнен',
    new: 'Новый',
    notCompleted: 'В работе',
    check: 'Проверить',
    excellent: 'Отлично!',
    tryAgain: 'Попробуй ещё раз'
  },
  en: {
    back: 'Back',
    progress: 'Your progress',
    completed: 'Completed',
    new: 'New',
    notCompleted: 'In progress',
    check: 'Check',
    excellent: 'Great!',
    tryAgain: 'Try again'
  },
  es: {
    back: 'Atrás',
    progress: 'Tu progreso',
    completed: 'Completado',
    new: 'Nuevo',
    notCompleted: 'En progreso',
    check: 'Comprobar',
    excellent: '¡Excelente!',
    tryAgain: 'Inténtalo otra vez'
  }
}

const tr = () => t[state.lang] || t.en

/* ---------------- LANGUAGE DETECT ---------------- */

function detectLang(){
  const tg = window.Telegram?.WebApp

  const code = tg?.initDataUnsafe?.user?.language_code

  if(code){
    if(code.startsWith('ru')) return 'ru'
    if(code.startsWith('es')) return 'es'
  }

  if(navigator.language.startsWith('ru')) return 'ru'
  if(navigator.language.startsWith('es')) return 'es'

  return 'en'
}

/* ---------------- INIT ---------------- */

async function init(){
  let saved = localStorage.getItem('lang')

  if(!saved){
    saved = detectLang()
    localStorage.setItem('lang', saved)
  }

  state.lang = saved

  state.categories = await loadCategories(state.lang)

  render()
}

/* ---------------- RENDER ---------------- */

function render(){
  if(state.screen === 'categories') renderCategories()
}

/* ---------------- CATEGORIES ---------------- */

async function renderCategories(){

  const progress = {}

  app.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <h1>Checklistings</h1>

      <button class="btn btn-ghost" onclick="toggleLang()">
        🌐 ${state.lang.toUpperCase()}
      </button>
    </div>

    <div class="dashboard">
      <div class="dashboard-title">${tr().progress}</div>
    </div>

    ${state.categories.map(c=>`
      <div class="card">
        <div class="card-row">
          <div>
            <b>${c.icon} ${c.title}</b>
            <div style="font-size:12px;color:#666">${c.description}</div>
          </div>
        </div>
      </div>
    `).join('')}
  `
}

/* ---------------- TOGGLE LANG ---------------- */

window.toggleLang = async ()=>{
  const order = ['ru','en','es']
  let i = order.indexOf(state.lang)
  i = (i + 1) % order.length

  state.lang = order[i]
  localStorage.setItem('lang', state.lang)

  state.categories = await loadCategories(state.lang)

  render()
}

init()
