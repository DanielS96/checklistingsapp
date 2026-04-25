const BASE_DATA_URL = "/checklistingsapp/data"
const WORKER_URL = "https://checklistings.dan-svistunov.workers.dev"

/* =========================
   📦 DATA LOADING (GitHub Pages)
   ========================= */

export async function loadCategories(){
  const res = await fetch(`${BASE_DATA_URL}/categories.json`)

  if(!res.ok){
    console.error("Failed to load categories.json", res.status)
    return []
  }

  return await res.json()
}

export async function loadChecklists(categoryId){
  const res = await fetch(`${BASE_DATA_URL}/${categoryId}/index.json`)

  if(!res.ok){
    console.error(`Failed to load index.json for ${categoryId}`, res.status)
    return []
  }

  const files = await res.json()

  if(!Array.isArray(files)){
    console.error("index.json is not array:", files)
    return []
  }

  const results = await Promise.all(
    files.map(async (file)=>{
      try {
        const r = await fetch(`${BASE_DATA_URL}/${categoryId}/${file}`)

        if(!r.ok){
          console.warn("Missing file:", file)
          return null
        }

        return await r.json()

      } catch (e) {
        console.error("Error loading checklist:", file, e)
        return null
      }
    })
  )

  return results.filter(Boolean)
}

/* =========================
   💳 TELEGRAM STARS (WORKER)
   ========================= */

export async function createInvoice(checklistId){
  try {
    const res = await fetch(`${WORKER_URL}/api/create-invoice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        checklistId,
        amount: 100
      })
    })

    const text = await res.text()

    try {
      return JSON.parse(text)
    } catch (e) {
      console.error("❌ Worker returned NON-JSON:", text)
      throw new Error("Invalid invoice response")
    }

  } catch (err) {
    console.error("createInvoice error:", err)
    throw err
  }
}

export async function getPaymentStatus(id){
  try {
    const res = await fetch(`${WORKER_URL}/api/payment-status?id=${id}`)

    if(!res.ok){
      return { paid: false }
    }

    return await res.json()

  } catch (e) {
    console.error("payment status error:", e)
    return { paid: false }
  }
}
