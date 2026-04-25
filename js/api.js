const BASE_DATA_URL = "/checklistingsapp/data"
const WORKER_URL = "https://checklistings.dan-svistunov.workers.dev"

/* =========================
   📦 DATA
   ========================= */

export async function loadCategories(){
  const res = await fetch(`${BASE_DATA_URL}/categories.json`)
  if(!res.ok) return []
  return await res.json()
}

export async function loadChecklists(categoryId){
  const res = await fetch(`${BASE_DATA_URL}/${categoryId}/index.json`)
  if(!res.ok) return []

  const files = await res.json()
  if(!Array.isArray(files)) return []

  const data = await Promise.all(
    files.map(async (f)=>{
      try {
        const r = await fetch(`${BASE_DATA_URL}/${categoryId}/${f}`)
        if(!r.ok) return null
        return await r.json()
      } catch {
        return null
      }
    })
  )

  return data.filter(Boolean)
}

/* =========================
   💳 STARS PAYMENT
   ========================= */

export async function createInvoice(checklistId){
  const res = await fetch(`${WORKER_URL}/api/create-invoice`, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      checklistId,
      amount: 100
    })
  })

  const text = await res.text()

  try {
    return JSON.parse(text)
  } catch {
    console.error("Worker not JSON:", text)
    throw new Error("Invalid response")
  }
}

export async function getPaymentStatus(id){
  try {
    const res = await fetch(`${WORKER_URL}/api/payment-status?id=${id}`)
    return await res.json()
  } catch {
    return { paid:false }
  }
}
