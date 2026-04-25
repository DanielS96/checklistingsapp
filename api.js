const WORKER_URL = "https://checklistings.dan-svistunov.workers.dev"

export async function loadCategories(){
  const res = await fetch('categories.json')
  return await res.json()
}

export async function loadChecklists(categoryId){
  const res = await fetch(`data/${categoryId}/index.json`)
  return await res.json()
}

/* =========================
   💳 PAYMENT (FIXED)
   ========================= */

export async function createInvoice(checklistId){
  const res = await fetch(`${WORKER_URL}/api/create-invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      checklistId,
      amount: 100
    })
  })

  const text = await res.text()

  try {
    return JSON.parse(text)
  } catch (e) {
    console.error("Worker returned NON-JSON:", text)
    throw new Error("Invalid Worker response")
  }
}

export async function getPaymentStatus(id){
  const res = await fetch(`${WORKER_URL}/api/payment-status?id=${id}`)
  return await res.json()
}
