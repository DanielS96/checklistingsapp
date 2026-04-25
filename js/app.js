
const tg = window.Telegram.WebApp
tg.expand()

const WORKER_URL = "https://checklistings.dan-svistunov.workers.dev"

const user = tg.initDataUnsafe?.user

async function payStars(){

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

    console.log("WORKER:", data)

    if(!data.ok){
      alert(data.error)
      return
    }

    // Telegram сам откроет invoice
    tg.openInvoice(data.result, (status)=>{
      console.log("PAY STATUS:", status)

      if(status === "paid"){
        alert("Payment successful 🎉")
      }
    })

  } catch (e) {
    console.error(e)
    alert("Error")
  }
}

document.getElementById("payBtn")
  .addEventListener("click", payStars)
