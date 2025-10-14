document.addEventListener("DOMContentLoaded", async () => {
  const username = localStorage.getItem("username");
  const isadmin = localStorage.getItem("isadmin");

  if (!username) {
    window.location.href = "login.html";
    return;
  }

  const chatBox = document.getElementById("chat-box");
  const chatInput = document.getElementById("chat-input");
  const sendBtn = document.getElementById("send-btn");
  const clearBtn = document.getElementById("clear-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userInfo = document.getElementById("user-info");

  if (!chatBox || !chatInput || !sendBtn || !clearBtn || !logoutBtn || !userInfo) {
    console.error("Elementos do chat não encontrados. Verifique mensagens.html.");
    return;
  }

  userInfo.textContent = `Usuário: ${username}`;

  // 🔒 se não for admin, desabilita o botão de limpar
  if (isadmin !== "true") {
    clearBtn.disabled = true;
    clearBtn.style.opacity = "0.5";
    clearBtn.title = "Somente administradores podem limpar o histórico";
  }

  const socket = io();

  socket.on("connect", () => console.log("✅ Conectado ao servidor Socket.IO!"));
  socket.on("connect_error", (err) => console.error("Erro de conexão Socket.IO:", err));

  async function loadHistory() {
    try {
      const res = await fetch("/history");
      if (!res.ok) throw new Error("Resposta não OK");
      const data = await res.json();
      chatBox.innerHTML = "";
      if (data.length === 0) {
        chatBox.innerHTML = "<p style='color:#888;'>Nenhuma mensagem.</p>";
      } else {
        data.forEach(msg => addMessage(msg.user, msg.text));
      }
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
      chatBox.innerHTML = "<p style='color:red;'>Erro ao carregar histórico.</p>";
    }
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
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  sendBtn.addEventListener("click", () => {
    const text = chatInput.value.trim();
    if (text === "") return;
    socket.emit("message", { user: username, text });
    chatInput.value = "";
  });

  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendBtn.click();
  });

  socket.on("message", (data) => {
    if (!data || !data.user) return;
    addMessage(data.user, data.text);
  });

  socket.on("history_cleared", () => {
    chatBox.innerHTML = "<p style='color:#888;'>Histórico limpo.</p>";
  });

  // 🔒 botão limpar só funciona se for admin
  clearBtn.addEventListener("click", async () => {
    if (isadmin !== "true") {
      alert("Apenas administradores podem limpar o histórico.");
      return;
    }

    if (!confirm("Tem certeza que deseja limpar o histórico?")) return;

    try {
      const res = await fetch("/clear_history", { method: "POST" });
      if (!res.ok) throw new Error("Falha ao limpar");
    } catch (err) {
      console.error("Erro ao limpar histórico:", err);
      alert("Erro ao limpar histórico.");
    }
  });

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("username");
    window.location.href = "login.html";
  });

  await loadHistory();
});