
const tg = window.Telegram?.WebApp

if(!tg){
  document.body.innerHTML = "<h2>Open inside Telegram</h2>"
  throw new Error("Not Telegram")
}

tg.ready()
tg.expand()

const user = tg.initDataUnsafe?.user

// ================= PAY FUNCTION =================
async function pay100Stars(){

  if(!user){
    alert("No Telegram user")
    return
  }

  console.log("USER:", user)

  try {

    // 👉 ВАЖНО: sendInvoice через Bot API нельзя из фронта напрямую
    // поэтому используем Telegram WebApp API openInvoice

    const invoicePayload = {
      title: "Unlock Premium",
      description: "Access for 100 Stars",
      payload: `pay_${user.id}_${Date.now()}`,
      provider_token: "",
      currency: "XTR",
      prices: [
        {
          label: "Access",
          amount: 100
        }
      ]
    }

    // 👉 вызываем Bot API через backend НЕ НУЖЕН для TEST MODE:
    // Telegram сам умеет открывать invoice через openInvoice если передать URL

    const res = await fetch("https://api.telegram.org/8639535861:AAHYZugJ-y3Kdf6T86iG-PkU88BexxW70QU/createInvoiceLink", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(invoicePayload)
    })

    const data = await res.json()

    console.log("INVOICE:", data)

    if(!data.ok){
      alert(data.description || "Invoice error")
      return
    }

    // 👉 ОТКРЫВАЕМ ОПЛАТУ В TELEGRAM
    tg.openInvoice(data.result, (status) => {

      console.log("PAY STATUS:", status)

      if(status === "paid"){
        alert("PAYMENT SUCCESS 🎉")
        // тут unlock контента
      }

      if(status === "cancelled"){
        alert("Payment cancelled")
      }

    })

  } catch (e) {
    console.error(e)
    alert("Payment error")
  }
}

// ================= BUTTON =================
document.getElementById("payBtn")
  .addEventListener("click", pay100Stars)
