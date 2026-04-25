export async function loadCategories(){
  const res = await fetch('categories.json')
  return await res.json()
}

export async function loadChecklists(categoryId){
  const res = await fetch(`data/${categoryId}/index.json`)
  const files = await res.json()

  const data = await Promise.all(files.map(async f=>{
    const r = await fetch(`data/${categoryId}/${f}`)
    return await r.json()
  }))

  return data
}

/* =========================
   💳 TELEGRAM STARS PAYMENT
   ========================= */

export async function createInvoice(checklistId){
  const res = await fetch('/api/create-invoice', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      checklistId,
      amount: 100
    })
  })

  if(!res.ok) throw new Error('Invoice error')

  return await res.json() // { invoiceUrl }
}

export async function getPaymentStatus(id){
  const res = await fetch(`/api/payment-status?id=${id}`)
  return await res.json() // { paid: true }
}
