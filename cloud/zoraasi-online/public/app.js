(() => {
  const get = (selector) => document.querySelector(selector);
  const loginPanel = get("#login-panel");
  const chatPanel = get("#chat-panel");
  const loginStatus = get("#login-status");
  const messages = get("#messages");
  const messageInput = get("#message");
  const modelSelect = get("#model");
  const sendButton = get("#send");
  const serviceStatus = get("#service-status");

  function append(role, content) {
    const article = document.createElement("article");
    article.className = `message ${role}`;
    article.textContent = content;
    messages.appendChild(article);
    article.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { credentials: "same-origin", ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || `Request stopped (${response.status})`);
    return payload;
  }

  function showChat(status) {
    modelSelect.value = status.defaultModel || "hy3";
    loginPanel.classList.add("hidden");
    chatPanel.classList.remove("hidden");
    serviceStatus.textContent = "Ready";
    messageInput.focus();
  }

  async function openChat() {
    try {
      const status = await api("/api/status");
      showChat(status);
    } catch {
      serviceStatus.textContent = "Could not reach Zora. Try again later.";
    }
  }

  get("#chat-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = messageInput.value.trim();
    if (!message) return;
    append("user", message);
    messageInput.value = "";
    sendButton.disabled = true;
    serviceStatus.textContent = "Thinking…";
    try {
      const result = await api("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message, model: modelSelect.value }),
      });
      append("zora", result.reply);
      const cost = result.usage?.costUsd ? ` · $${result.usage.costUsd.toFixed(6)}` : "";
      serviceStatus.textContent = `${result.model}${cost}`;
    } catch (error) {
      append("system", error.message);
      serviceStatus.textContent = "Request stopped";
    } finally {
      sendButton.disabled = false;
      messageInput.focus();
    }
  });

  openChat();
})();
