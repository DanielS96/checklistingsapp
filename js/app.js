async function payChecklist(userId, checklistId){

  const res = await fetch("https://checklistings.dan-svistunov.workers.dev", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      userId,
      checklistId
    })
  })

  const data = await res.json()

  if(data.ok){
    window.location.href = data.url
  } else {
    alert(data.error || "Payment error")
  }
}
