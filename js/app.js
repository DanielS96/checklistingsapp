
const tg = window.Telegram.WebApp
tg.ready()
tg.expand()

const WORKER_URL = "https://checklistings.dan-svistunov.workers.dev"

const user = tg.initDataUnsafe?.user

// 🔥 ОПЛАТА
async function pay(){

  if(!user){
    alert("Open inside Telegram")
    return
  }

  console.log("USER:", user)

  try {

    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: user.id
      })
    })

    const data = await res.json()

    console.log("WORKER RESPONSE:", data)

    if(!data.ok){
      alert(data.error)
      return
    }

    // 💥 ВАЖНО: Telegram сам откроет оплату
    tg.openInvoice(data.result, (status)=>{

      console.log("PAY STATUS:", status)

      if(status === "paid"){
        alert("Payment successful 🎉")
        // тут unlock контент
      }

      if(status === "cancelled"){
        alert("Payment cancelled")
      }

    })

  } catch (e) {
    console.error(e)
    alert("Network error")
  }
}

document.getElementById("payBtn")
  .addEventListener("click", pay)
