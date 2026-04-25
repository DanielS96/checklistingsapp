import { loadCategories, loadChecklists } from './api.js'

const app = document.getElementById('app')

/* ---------------- STATE ---------------- */

let state = {
  lang: 'ru',
  categories: [],
  progress: JSON.parse(localStorage.getItem('progress') || '{}')
}

/* ---------------- AUTO DETECT LANG ---------------- */

function detectLang(){
  const tg = window.Telegram?.WebApp
  const code = tg?.initDataUnsafe?.user?.language_code

  const lang = code || navigator.language || 'ru'

  if(lang.startsWith('ru')) return 'ru'
  if(lang.startsWith('es')) return 'es'
  if(lang.startsWith('en')) return 'en'

  return 'en'
}

/* ---------------- TRANSLATION CACHE ---------------- */

const cache = JSON.parse(localStorage.getItem('i18n_cache') || '{}')

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
    localStorage.setItem('i18n_cache', JSON.stringify(cache))

    return translated
  } catch {
    return text
  }
}

/* ---------------- UI DICTIONARY ---------------- */

let t = {
  back: 'Назад',
  progress: 'Прогресс',
  completed: 'Выполнено',
  new: 'Новый',
  inProgress: 'В процессе',
  level: 'Уровень'
}

/* ---------------- LOAD TRANSLATIONS ---------------- */

async function loadDict(lang){
  if(lang === 'ru') return

  for(const key in t){
    t[key] = await translate(t[key], lang)
  }
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

  state.lang = detectLang()

  await loadDict(state.lang)

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
      <div>${t.level}: <b>${level}</b></div>
      <div>${t.progress}: ${totalPercent}%</div>
    </div>

    ${categoriesWithProgress.map(c=>`
      <div class="card" onclick="openCategory('${c.id}')">
        <b>${c.icon} ${c.title}</b>
        <div>${c.description}</div>
        <div style="margin-top:6px;font-size:12px;">
          ${c.percent}% ${t.completed}
        </div>
      </div>
    `).join('')}
  `
}

/* ---------------- CATEGORY ---------------- */

window.openCategory = async (id)=>{

  const lists = await loadChecklists(id)

  app.innerHTML = `
    <button onclick="init()">${t.back}</button>

    <h2>Checklists</h2>

    ${lists.map(l=>`
      <div class="card" onclick="toggleDone('${l.id}')">
        <b>${l.title}</b>
        <div>${getDone(l.id) ? '✔' : '○'}</div>
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
