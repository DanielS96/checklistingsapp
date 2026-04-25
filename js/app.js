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

/* ---------------- TRANSLATION ENGINE ---------------- */

const cache = JSON.parse(localStorage.getItem('i18n_cache') || '{}')

async function tr(text, lang = state.lang){
  if(!text) return text
  if(lang === 'ru') return text

  const key = `${text}_${lang}`
  if(cache[key]) return cache[key]

  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ru|${lang}`
    )

    const data = await res.json()
    const translated = data.responseData.translatedText

    cache[key] = translated
    localStorage.setItem('i18n_cache', JSON.stringify(cache))

    return translated
  } catch {
    return text
  }
}

/* ---------------- LANG BUTTON ---------------- */

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

/* ---------------- PROGRESS ---------------- */

function getDone(id){
  return !!state.progress[id]
}

/* ---------------- RENDER ---------------- */

async function render(){

  const categoriesWithProgress = await Promise.all(
    state.categories.map(async c => {

      const lists = await loadChecklists(c.id)

      const total = lists.length
      const done = lists.filter(l => getDone(l.id)).length

      const percent = total ? Math.round(done / total * 100) : 0

      // 🔥 FULL AUTO TRANSLATION
      const title = await tr(c.title)
      const description = await tr(c.description)

      const translatedLists = await Promise.all(
        lists.map(async l => ({
          ...l,
          title: await tr(l.title),
          description: l.description ? await tr(l.description) : ''
        }))
      )

      return {
        ...c,
        title,
        description,
        percent,
        lists: translatedLists
      }
    })
  )

  app.innerHTML = `
    <div class="card">
      <b>Checklist App</b>
    </div>

    ${categoriesWithProgress.map(c=>`
      <div class="card" onclick="openCategory('${c.id}')">
        <b>${c.title}</b>
        <div>${c.description || ''}</div>
        <div style="margin-top:6px;font-size:12px;">
          ${c.percent}%
        </div>
      </div>
    `).join('')}
  `
}

/* ---------------- CATEGORY ---------------- */

window.openCategory = async (id)=>{

  const lists = await loadChecklists(id)

  const translated = await Promise.all(
    lists.map(async l => ({
      ...l,
      title: await tr(l.title),
      description: l.description ? await tr(l.description) : ''
    }))
  )

  app.innerHTML = `
    <button onclick="init()">← Back</button>

    ${translated.map(l=>`
      <div class="card" onclick="toggleDone('${l.id}')">
        <b>${l.title}</b>
        <div>${getDone(l.id) ? '✔' : '○'}</div>
      </div>
    `).join('')}
  `
}

/* ---------------- TOGGLE ---------------- */

window.toggleDone = (id)=>{
  state.progress[id] = !state.progress[id]
  localStorage.setItem('progress', JSON.stringify(state.progress))
  render()
}

/* ---------------- START ---------------- */

init()
