<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Checklist App</title>
</head>
<body>

  <h1>Premium Checklist</h1>

  <p>Нажми кнопку ниже, чтобы открыть Telegram 👇</p>

  <button onclick="openBot()">
    🚀 Открыть бота
  </button>

  <script>
    // 👉 замени на username твоего бота
    const BOT_USERNAME = "YOUR_BOT_USERNAME";

    function openBot() {
      window.open(`https://t.me/${BOT_USERNAME}?start=buy`, "_blank");
    }
  </script>

</body>
</html>
