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

    const res = await fetch(WORKER_URL, {
  method: "POST",
  mode: "cors", // 👈 важно
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

    alert("Invoice sent in Telegram 💬")

  } catch (e) {
    console.error(e)
    alert("Network error")
  }
}

document.getElementById("payBtn")
  .addEventListener("click", pay)
