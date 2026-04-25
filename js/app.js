// ================= INIT =================

console.log("🚀 APP START")

const app = document.getElementById("app")

// Telegram safe init
let tg = null
let user = null

if (window.Telegram && window.Telegram.WebApp) {
  try {
    tg = window.Telegram.WebApp
    tg.ready()
    tg.expand()

    user = tg.initDataUnsafe?.user || null

    console.log("✅ Telegram mode", user)
  } catch (e) {
    console.error("Telegram init error", e)
  }
} else {
  console.log("🌐 Browser mode")
}

// ================= RENDER =================

function render() {

  app.innerHTML = `
    <div class="card">
      <h2>Checklistings 🚀</h2>
      <p>Status: ${tg ? "Telegram" : "Browser"}</p>
    </div>

    <div class="card">
      <button id="payBtn">
        Pay 100 Stars ⭐
      </button>
    </div>
  `

  const btn = document.getElementById("payBtn")

  if (!btn) {
    console.error("❌ Button not found")
    return
  }

  btn.addEventListener("click", pay)
}

// ================= PAYMENT =================

const WORKER_URL = "https://checklistings.dan-svistunov.workers.dev"

let isLoading = false

async function pay() {

  if (isLoading) {
    console.log("⏳ already loading")
    return
  }

  if (!user) {
    alert("Open inside Telegram")
    return
  }

  isLoading = true

  console.log("💰 PAY CLICK", user.id)

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

    console.log("🌐 RESPONSE STATUS:", res.status)

    if (!res.ok) {
      throw new Error("HTTP error " + res.status)
    }

    const data = await res.json()

    console.log("📦 RESPONSE DATA:", data)

    if (!data.ok) {
      alert(data.error || "Payment error")
      return
    }

    alert("Invoice sent in Telegram 💬")

  } catch (e) {
    console.error("❌ FETCH ERROR:", e)
    alert("Network error")
  }

  isLoading = false
}

// ================= START =================

render()
