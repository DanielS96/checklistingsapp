export async function loadCategories(){
  const res = await fetch('./data/categories.json')
  return await res.json()
}

export async function loadChecklists(categoryId){
  const res = await fetch(`./data/${categoryId}/index.json`)
  const files = await res.json()

  return Promise.all(
    files.map(async f=>{
      const r = await fetch(`./data/${categoryId}/${f}`)
      return await r.json()
    })
  )
}
