
console.log("APP STARTED")

const app = document.getElementById("app")

// ================= SAFE TELEGRAM INIT =================
const tg = window.Telegram?.WebApp || null

let isTelegram = false

if(tg){
  try {
    tg.ready()
    tg.expand()
    isTelegram = true
    console.log("Telegram detected")
  } catch(e){
    console.log("Telegram init error", e)
  }
}

// ================= RENDER ALWAYS =================
function render(){

  app.innerHTML = `
    <div class="card">
      <h2>Checklistings 🚀</h2>
      <p>Status: ${isTelegram ? "Telegram mode" : "Browser mode"}</p>

      ${!isTelegram ? `
        <p class="warn">
          Open this app inside Telegram for full features
        </p>
      ` : ""}
    </div>

    <div class="card">
      <h3>Test payment</h3>

      <button id="payBtn">
        Pay 100 Stars ⭐
      </button>
    </div>
  `

  document.getElementById("payBtn").onclick = () => {
    alert("BUTTON WORKS 🔥")
    console.log("CLICK OK")
  }
}

render()
