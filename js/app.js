import { loadCategories, loadChecklists } from './api.js'

const app = document.getElementById('app')

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

/* ---------------- LANG ---------------- */

function detectLang(){
  const saved = localStorage.getItem('lang')
  if(saved) return saved

  const code = navigator.language || 'ru'

  if(code.startsWith('ru')) return 'ru'
  if(code.startsWith('es')) return 'es'
  return 'en'
}

function setLang(lang){
  state.lang = lang
  localStorage.setItem('lang', lang)
}

/* ---------------- TRANSLATE ---------------- */

const cache = JSON.parse(localStorage.getItem('i18n_cache') || '{}')

async function tr(text){
  const lang = state.lang
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

/* ---------------- INIT ---------------- */

async function init(){
  state.lang = detectLang()
  state.categories = await loadCategories()
  render()
}

/* ---------------- 🔥 NORMALIZE DATA (ВАЖНО) ---------------- */

async function buildData(){

  const categories = await Promise.all(
    state.categories.map(async c => {

      const listsRaw = await loadChecklists(c.id)

      const lists = await Promise.all(
        listsRaw.map(async l => ({
          id: l.id,
          title: await tr(l.title),
          description: l.description ? await tr(l.description) : ''
        }))
      )

      const done = lists.filter(l => state.progress[l.id]).length
      const percent = lists.length ? Math.round(done / lists.length * 100) : 0

      return {
        id: c.id,
        title: await tr(c.title),
        description: await tr(c.description),
        lists,
        percent
      }
    })
  )

  return categories
}

/* ---------------- RENDER ---------------- */

async function render(){

  const categories = await buildData()

  app.innerHTML = `
    <div class="card">
      <b>${await tr('Checklist App')}</b>
    </div>

    ${categories.map(c=>`
      <div class="card" onclick="openCategory('${c.id}')">
        <b>${c.title}</b>
        <div>${c.description}</div>
        <div style="margin-top:6px;font-size:12px;">
          ${c.percent}%
        </div>
      </div>
    `).join('')}
  `
}

/* ---------------- CATEGORY ---------------- */

window.openCategory = async (id)=>{

  const categories = await buildData()
  const cat = categories.find(c => c.id === id)

  app.innerHTML = `
    <button onclick="init()">← Back</button>

    ${cat.lists.map(l=>`
      <div class="card" onclick="toggleDone('${l.id}')">
        <b>${l.title}</b>
        <div>${state.progress[l.id] ? '✔' : '○'}</div>
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
