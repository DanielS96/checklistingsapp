import { loadCategories, loadChecklists } from './api.js'

const app = document.getElementById('app')

/* ---------------- LANG SYSTEM ---------------- */

const LANGS = {
  ru: { label: 'Русский', flag: '🇷🇺' },
  en: { label: 'English', flag: '🇬🇧' },
  es: { label: 'Español', flag: '🇪🇸' }
}

let state = {
  lang: 'ru',
  categories: [],
  progress: JSON.parse(localStorage.getItem('progress') || '{}')
}

/* ---------------- DETECT LANG ---------------- */

function detectLang(){
  const saved = localStorage.getItem('lang')
  if(saved) return saved

  const tg = window.Telegram?.WebApp
  const code = tg?.initDataUnsafe?.user?.language_code

  const lang = code || navigator.language || 'ru'

  if(lang.startsWith('ru')) return 'ru'
  if(lang.startsWith('es')) return 'es'
  return 'en'
}

function setLang(lang){
  state.lang = lang
  localStorage.setItem('lang', lang)
}

/* ---------------- LANG UI ---------------- */

function createLangButton(){
  const btn = document.createElement('div')
  btn.className = 'lang-btn'
  btn.id = 'langBtn'
  btn.onclick = toggleMenu
  document.body.appendChild(btn)

  updateLangButton()
}

function updateLangButton(){
  const btn = document.getElementById('langBtn')
  if(!btn) return

  const l = LANGS[state.lang]
  btn.innerHTML = `${l.flag} ${state.lang.toUpperCase()}`
}

/* ---------------- MENU ---------------- */

window.toggleMenu = ()=>{
  const exist = document.getElementById('langMenu')
  if(exist) return exist.remove()

  const menu = document.createElement('div')
  menu.id = 'langMenu'
  menu.className = 'lang-menu'

  menu.innerHTML = Object.keys(LANGS).map(l=>`
    <div class="lang-item" onclick="changeLang('${l}')">
      ${LANGS[l].flag} ${LANGS[l].label}
    </div>
  `).join('')

  document.body.appendChild(menu)
}

window.changeLang = async (lang)=>{
  setLang(lang)
  document.getElementById('langMenu')?.remove()

  updateLangButton()
  render()
}

/* ---------------- INIT ---------------- */

async function init(){
  state.lang = detectLang()
  state.categories = await loadCategories()

  createLangButton()
  render()
}

/* ---------------- RENDER ---------------- */

async function render(){

  const categoriesWithProgress = await Promise.all(
    state.categories.map(async c=>{
      const lists = await loadChecklists(c.id)

      const total = lists.length
      const done = lists.filter(l => state.progress[l.id]).length

      const percent = total ? Math.round(done / total * 100) : 0

      return { ...c, percent }
    })
  )

  app.innerHTML = `
    <div class="card">
      <b>Checklist App</b>
    </div>

    ${categoriesWithProgress.map(c=>`
      <div class="card">
        <b>${c.icon} ${c.title}</b>
        <div>${c.description}</div>
        <div>${c.percent}%</div>
      </div>
    `).join('')}
  `
}

/* ---------------- START ---------------- */

init()
