const tg = window.Telegram?.WebApp
tg.ready()
tg.expand()

const user = tg.initDataUnsafe?.user

async function pay(){

  if(!user){
    alert("Open inside Telegram")
    return
  }

  try {

    const res = await fetch("https://checklistings.dan-svistunov.workers.dev", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: user.id
      })
    })

    const data = await res.json()

    console.log(data)

    if(!data.ok){
      alert(data.error)
      return
    }

    tg.openInvoice(data.url, (status)=>{

      console.log("STATUS:", status)

      if(status === "paid"){
        alert("SUCCESS 🎉")
      }

    })

  } catch (e) {
    console.error(e)
    alert("Network error")
  }
}

document.getElementById("payBtn")
  .addEventListener("click", pay)
