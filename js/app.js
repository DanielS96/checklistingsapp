
const WORKER_URL = "https://checklistings.dan-svistunov.workers.dev"

console.log("APP LOADED ✅")

async function payTest(){

  console.log("BUTTON CLICKED 🔥")

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: "debug_user",
        checklistId: "test_100"
      })
    })

    console.log("FETCH SENT 🚀")

    const data = await res.json()

    console.log("WORKER RESPONSE:", data)

    if(data.ok && data.url){
      console.log("REDIRECTING 👉")
      window.location.href = data.url
    } else {
      alert("ERROR: " + (data.error || "no url"))
    }

  } catch (e) {
    console.error("FETCH ERROR ❌", e)
    alert("Network error")
  }
}

// 👉 ВАЖНО: attach AFTER DOM ready
document.addEventListener("DOMContentLoaded", () => {

  const btn = document.getElementById("payBtn")

  console.log("BUTTON FOUND:", btn)

  if(!btn){
    console.error("BUTTON NOT FOUND ❌")
    return
  }

  btn.addEventListener("click", payTest)

  console.log("EVENT ATTACHED ✅")
})
