export async function loadCategories(){
  const res = await fetch('./checklistingsapp/data/categories.json')
  if(!res.ok) return []
  return await res.json()
}

export async function loadChecklists(categoryId){
  const res = await fetch(`./checklistingsapp/data/${categoryId}/index.json`)
  if(!res.ok) return []

  const files = await res.json()

  return Promise.all(
    files.map(async f=>{
      const r = await fetch(`./checklistingsapp/data/${categoryId}/${f}`)
      if(!r.ok) return null
      return await r.json()
    })
  )
}
