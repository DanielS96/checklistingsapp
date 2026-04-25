const WORKER_URL = "https://checklistings.dan-svistunov.workers.dev"

// ================= PAYMENT =================
async function payTest(){

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: "test_user",
        checklistId: "test_100"
      })
    })

    const data = await res.json()

    console.log("Worker response:", data)

    if(data.ok && data.url){
      window.location.href = data.url
    } else {
      alert(data.error || "No invoice link")
    }

  } catch (e) {
    console.error(e)
    alert("Network error")
  }
}

// ================= BIND BUTTON =================
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("payBtn")

  if(btn){
    btn.addEventListener("click", payTest)
  }
})
