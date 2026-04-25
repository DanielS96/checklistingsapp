export async function loadCategories(lang){
  try {
    const res = await fetch(`data/${lang}/categories.json`)
    return await res.json()
  } catch (e) {
    console.error('Ошибка загрузки categories.json', e)
    return []
  }
}

export async function loadChecklists(categoryId, lang){
  try {
    const res = await fetch(`data/${lang}/${categoryId}/index.json`)
    const files = await res.json()

    const results = await Promise.all(
      files.map(async (f)=>{
        const r = await fetch(`data/${lang}/${categoryId}/${f}`)
        return await r.json()
      })
    )

    return results
  } catch (e) {
    console.error('Ошибка загрузки чек-листов', e)
    return []
  }
}

    // убираем битые файлы
    return results.filter(Boolean)

  } catch (e) {
    console.error(`Ошибка загрузки index.json для ${categoryId}`, e)
    return []
  }
}
