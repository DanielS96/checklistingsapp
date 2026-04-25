import { loadCategories, loadChecklists } from './api.js'

const app = document.getElementById('app')

let state = {
  screen: 'categories',
  categories: [],
  category: null,
  checklists: [],
  current: null,
  lang: localStorage.getItem('lang') || 'auto'
}

// ===== TRANSLATION ENGINE =====
const cache = {}

async function detectLang(){
  if(state.lang !== 'auto') return state.lang
  return navigator.language.slice(0,2) || 'en'
}

async function translate(text, targetLang){
  if(!text) return text
  if(targetLang === 'ru') return text

  const key = text + targetLang
  if(cache[key]) return cache[key]

  try {
    const res = await fetch("https://libretranslate.de/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "auto",
        target: targetLang,
        format: "text"
      })
    })

    const data = await res.json()
    cache[key] = data.translatedText || text
    return cache[key]

  } catch {
    return text
  }
}

async function t(text){
  const lang = await detectLang()
  if(lang === 'ru') return text
  return await translate(text, lang)
}

// ===== INIT =====
async function init(){
  state.categories = await loadCategories()

  document.getElementById('langSwitcher').value = state.lang

  document.getElementById('langSwitcher').onchange = (e)=>{
    state.lang = e.target.value
    localStorage.setItem('lang', state.lang)
    render()
  }

  render()
}

// ===== RENDER =====
function render(){
  if(state.screen === 'categories') renderCategories()
  if(state.screen === 'list') renderList()
  if(state.screen === 'check') renderCheck()
}

// ===== CATEGORIES =====
async function renderCategories(){
  const progress = getProgress()

  const categoriesWithProgress = await Promise.all(
    state.categories.map(async (c)=>{
      const lists = await loadChecklists(c.id)
      const total = lists.length
      const done = lists.filter(l => progress[l.id]).length
      const percent = total ? Math.round(done / total * 100) : 0

      return {
        ...c,
        title: await t(c.title),
        description: await t(c.description),
        percent
      }
    })
  )

  const percent = Math.round(
    categoriesWithProgress.reduce((a,c)=>a+c.percent,0) / categoriesWithProgress.length
  )

  const level = getLevel(percent)

  app.innerHTML = `
    <h1>${await t('Checklistings')}</h1>

    <div class="dashboard">
      <div class="dashboard-title">${await t('Ваш прогресс')}</div>
      <div class="dashboard-level">${await t(level)}</div>

      <div class="dashboard-bar">
        <div class="dashboard-fill" style="width:${percent}%"></div>
      </div>

      <div style="margin-top:6px;">${percent}%</div>
    </div>

    ${categoriesWithProgress.map(c=>`
      <div class="card category" onclick="openCategory('${c.id}')">
        <div class="category-title">${c.icon} ${c.title}</div>
        <div style="font-size:13px;color:#666;margin-top:4px;">
          ${c.description}
        </div>

        <div class="progress-bar">
          <div class="progress-fill" style="width:${c.percent}%"></div>
        </div>
      </div>
    `).join('')}
  `
}

// ===== LIST =====
window.openCategory = async (id)=>{
  state.category = id
  state.checklists = await loadChecklists(id)
  state.screen = 'list'
  render()
}

function renderList(){
  app.innerHTML = `
    <button class="btn btn-ghost" onclick="goBack()">←</button>

    ${state.checklists.map(async c=>{
      const s = getStatus(c.id)

      return `
        <div class="card" onclick="openChecklist('${c.id}')">
          <div style="font-weight:700;">
            ${await t(c.title)}
          </div>
          <div class="checklist-subtitle">
            ${await t(c.subtitle)}
          </div>

          <div class="status ${s.class}">
            ${await t(s.text)}
          </div>
        </div>
      `
    }).join('')}
  `
}

// ===== CHECK =====
window.openChecklist = async (id)=>{
  setOpened(id)
  state.current = state.checklists.find(x=>x.id===id)
  state.screen = 'check'
  render()
}

async function renderCheck(){
  const c = state.current

  app.innerHTML = `
    <button class="btn btn-ghost" onclick="goBack()">←</button>

    <h2>${await t(c.title)}</h2>

    ${c.description ? `
      <div class="checklist-description">
        ${await t(c.description)}
      </div>
    ` : ''}

    ${(c.items || []).map(async (item,i)=>`
      <div class="item">
        <div class="item-header" onclick="toggle(${i})">
          ${item.emoji} ${await t(item.title)}
        </div>

        <div class="item-body" id="i${i}">
          <p>${await t(item.text)}</p>

          ${item.tip ? `
            <div class="tip">
              💡 ${await t(item.tip)}
            </div>
          ` : ''}
        </div>
      </div>
    `).join('')}
  `
}

// ===== HELPERS =====
function getProgress(){
  return JSON.parse(localStorage.getItem('progress') || '{}')
}

function getOpened(){
  return JSON.parse(localStorage.getItem('opened') || '{}')
}

function setDone(id){
  const p = getProgress()
  p[id] = true
  localStorage.setItem('progress', JSON.stringify(p))
}

function setOpened(id){
  const o = getOpened()
  o[id] = true
  localStorage.setItem('opened', JSON.stringify(o))
}

function getLevel(percent){
  if(percent < 20) return 'Новичок'
  if(percent < 50) return 'Любитель'
  if(percent < 80) return 'Продвинутый'
  return 'Мастер'
}

window.goBack = ()=>{
  state.screen = state.screen === 'check' ? 'list' : 'categories'
  render()
}

init()
