
console.log("🔥 APP STARTED")

// Telegram init (может быть null если не в Telegram)
const tg = window.Telegram?.WebApp

if(tg){
  tg.ready()
  tg.expand()
  console.log("Telegram WebApp ready")
} else {
  console.warn("NOT IN TELEGRAM")
}

const app = document.getElementById("app")

// ================= UI TEST =================
function render(){

  app.innerHTML = `
    <div class="card">
      <h2>System OK ✅</h2>
      <p>Если ты видишь это — JS работает</p>
    </div>

    <button id="payBtn">
      Pay 100 Stars (TEST)
    </button>
  `

  document.getElementById("payBtn")
    .addEventListener("click", () => {
      alert("CLICK WORKS 🔥")
      console.log("BUTTON CLICKED")
    })
}

render()
