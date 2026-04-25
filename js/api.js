export async function loadCategories(lang){
  const res = await fetch(`data/${lang}/categories.json`)
  return await res.json()
}

export async function loadChecklists(categoryId, lang){
  const res = await fetch(`data/${lang}/${categoryId}/index.json`)
  const files = await res.json()

  return Promise.all(
    files.map(async f=>{
      const r = await fetch(`data/${lang}/${categoryId}/${f}`)
      return await r.json()
    })
  )
}
