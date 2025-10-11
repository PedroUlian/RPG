document.addEventListener("DOMContentLoaded", async () => {
  // verificar usuário logado
  const username = localStorage.getItem("username");
  if (!username) {
    window.location.href = "login.html";
    return;
  }

  // elementos
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

  // conectar socket.io
  const socket = io();

  socket.on("connect", () => {
    console.log("✅ Conectado ao servidor Socket.IO!");
  });

  socket.on("connect_error", (err) => {
    console.error("Erro de conexão Socket.IO:", err);
  });

  // carregar histórico do servidor
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

  // adicionar mensagem na tela
  function addMessage(user, text) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("msg");
    // estilinho simples: destaque do próprio usuário
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

  // escapa HTML simples pra evitar injeção
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // enviar mensagem
  sendBtn.addEventListener("click", () => {
    const text = chatInput.value.trim();
    if (text === "") return;

    // emitir evento para o servidor (o servidor fará salvar e emitir para todos)
    socket.emit("message", { user: username, text });

    // opcional: mostrar imediatamente (servidor também vai mandar)
    // addMessage(username, text);

    chatInput.value = "";
  });

  // permitir Enter
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendBtn.click();
  });

  // receber mensagens em tempo real
  socket.on("message", (data) => {
    if (!data || !data.user) return;
    addMessage(data.user, data.text);
  });

  // limpar histórico (evento do servidor)
  socket.on("history_cleared", () => {
    chatBox.innerHTML = "<p style='color:#888;'>Histórico limpo.</p>";
  });

  // botão limpar -> chama endpoint do servidor
  clearBtn.addEventListener("click", async () => {
    if (!confirm("Tem certeza que deseja limpar o histórico?")) return;
    try {
      const res = await fetch("/clear_history", { method: "POST" });
      if (!res.ok) throw new Error("Falha ao limpar");
      // o servidor emitirá 'history_cleared' para todos
    } catch (err) {
      console.error("Erro ao limpar histórico:", err);
      alert("Erro ao limpar histórico.");
    }
  });

  // logout
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("username");
    window.location.href = "login.html";
  });

  // carregar histórico inicial
  await loadHistory();
});
