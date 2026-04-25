export async function loadCategories(){
  try {
    const res = await fetch('data/categories.json')
    return await res.json()
  } catch {
    return []
  }
}

export async function loadChecklists(categoryId){
  try {
    const res = await fetch(`data/${categoryId}/index.json`)
    return await res.json()
  } catch {
    return []
  }
}
