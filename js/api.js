export async function loadCategories(){
  try {
    const res = await fetch('data/categories.json')
    return await res.json()
  } catch (e) {
    console.error('Ошибка загрузки categories.json', e)
    return []
  }
}

export async function loadChecklists(categoryId){
  try {
    const res = await fetch(`data/${categoryId}/index.json`)
    const files = await res.json()

    if(!Array.isArray(files)){
      return []
    }

    const results = await Promise.all(
      files.map(async (f)=>{
        try {
          const r = await fetch(`data/${categoryId}/${f}`)
          const data = await r.json()

          return {
            id: data.id || f,
            title: data.title || 'Без названия',
            subtitle: data.subtitle || '',
            description: data.description || '',
            items: Array.isArray(data.items) ? data.items : [],
            quiz: Array.isArray(data.quiz) ? data.quiz : []
          }

        } catch (e) {
          return null
        }
      })
    )

    return results.filter(Boolean)

  } catch (e) {
    return []
  }
}
