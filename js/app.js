const WORKER_URL = "https://checklistings.dan-svistunov.workers.dev"

async function payStars(){

  console.log("CLICK")

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: 123456789 // важно: Telegram user id (пока тест)
      })
    })

    const data = await res.json()

    console.log(data)

    if(!data.ok){
      alert(data.error)
      return
    }

    alert("Invoice sent! Check Telegram")

  } catch (e) {
    console.error(e)
    alert("Error")
  }
}

window.payStars = payStars
