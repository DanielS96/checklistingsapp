import { loadCategories, loadChecklists } from './api.js'

const app = document.getElementById('app')

let state = {
  lang: 'ru',
  categories: [],
  checklists: []
}

/* ---------------- DETECT LANGUAGE ---------------- */

function detectLang(){
  const tg = window.Telegram?.WebApp
  const code = tg?.initDataUnsafe?.user?.language_code

  if(code && code.startsWith('ru')) return 'ru'
  return navigator.language.startsWith('ru') ? 'ru' : 'en'
}

/* ---------------- SIMPLE TRANSLATOR ---------------- */

const cache = JSON.parse(localStorage.getItem('cache') || '{}')

async function translate(text, lang){
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
    localStorage.setItem('cache', JSON.stringify(cache))

    return translated
  } catch {
    return text
  }
}

/* ---------------- UI TEXT CACHE ---------------- */

let t = {
  back: 'Назад',
  progress: 'Ваш прогресс',
  completed: 'Выполнен',
  new: 'Новый',
  inProgress: 'Не завершен',
  check: 'Проверить',
  excellent: 'Отлично!',
  tryAgain: 'Попробуй ещё раз'
}

async function loadDict(lang){
  if(lang === 'ru') return

  for(let key in t){
    t[key] = await translate(t[key], lang)
  }
}

/* ---------------- INIT ---------------- */

async function init(){
  const saved = localStorage.getItem('lang')

  state.lang = saved || detectLang()

  await loadDict(state.lang)

  state.categories = await loadCategories()

  render()
}

/* ---------------- RENDER ---------------- */

function render(){
  app.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <h1>Checklistings</h1>

      <button onclick="toggleLang()">
        🌐 ${state.lang.toUpperCase()}
      </button>
    </div>

    <div style="margin:10px 0;">
      ${t.progress}
    </div>

    ${state.categories.map(c=>`
      <div class="card">
        <b>${c.icon} ${c.title}</b>
        <div style="font-size:12px;color:#666">
          ${c.description}
        </div>
      </div>
    `).join('')}
  `
}

/* ---------------- SWITCH LANGUAGE ---------------- */

window.toggleLang = async ()=>{
  state.lang = state.lang === 'ru' ? 'en' : 'ru'

  localStorage.setItem('lang', state.lang)

  await loadDict(state.lang)

  render()
}

init()
