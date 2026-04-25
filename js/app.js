console.log("SCRIPT LOADED ✅")

const btn = document.getElementById("payBtn")

console.log("BUTTON:", btn)

if(!btn){
  console.error("BUTTON NOT FOUND ❌")
}

btn.onclick = async () => {

  console.log("CLICK WORKS 🔥")

  try {
    const res = await fetch("https://checklistings.dan-svistunov.workers.dev", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: "test",
        checklistId: "test"
      })
    })

    console.log("REQUEST SENT 🚀")

    const data = await res.json()

    console.log("RESPONSE:", data)

    if(data.ok){
      window.location.href = data.url
    } else {
      alert(data.error)
    }

  } catch (e) {
    console.error("ERROR:", e)
  }
}
