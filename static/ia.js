document.addEventListener("DOMContentLoaded", () => {
  const username = localStorage.getItem("username");
  if (!username) {
    window.location.href = "login.html";
    return;
  }

  const iaBox = document.getElementById("ia-box");
  const iaInput = document.getElementById("ia-input");
  const iaSendBtn = document.getElementById("ia-send-btn");
  const logoutBtn = document.getElementById("logout-btn");

  if (!iaBox || !iaInput || !iaSendBtn || !logoutBtn) {
    console.error("Elementos da IA não encontrados.");
    return;
  }

  function addMessage(user, text) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("msg");
    if (user === username) {
      msgDiv.style.textAlign = "right";
      msgDiv.innerHTML = `<small style="color:#aaa">${user}</small><br><span>${escapeHtml(text)}</span>`;
    } else {
      msgDiv.style.textAlign = "left";
      msgDiv.innerHTML = `<strong style="color:#ffd700">${user}</strong>: <span>${escapeHtml(text)}</span>`;
    }
    iaBox.appendChild(msgDiv);
    iaBox.scrollTop = iaBox.scrollHeight;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  iaSendBtn.addEventListener("click", async () => {
    const text = iaInput.value.trim();
    if (!text) return;

    addMessage(username, text);
    iaInput.value = "";

    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      if (data.reply) {
        addMessage("IA", data.reply);
      } else {
        addMessage("IA", "❌ Sem resposta.");
      }
    } catch (err) {
      console.error("Erro ao enviar para IA:", err);
      addMessage("IA", "❌ Erro de conexão com o servidor.");
    }
  });

  iaInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") iaSendBtn.click();
  });

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("username");
    window.location.href = "login.html";
  });
});
