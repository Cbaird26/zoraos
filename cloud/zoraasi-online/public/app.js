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
  let authorization = "";
  let csrfToken = "";
  let appleEnabled = false;

  function append(role, content) {
    const article = document.createElement("article");
    article.className = `message ${role}`;
    article.textContent = content;
    messages.appendChild(article);
    article.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (authorization) headers.set("Authorization", authorization);
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
    get("#link-apple").classList.toggle("hidden", !appleEnabled);
    messageInput.focus();
  }

  function showLogin(message = "Choose a sign-in method.") {
    chatPanel.classList.add("hidden");
    loginPanel.classList.remove("hidden");
    loginStatus.textContent = message;
  }

  async function restoreSession() {
    try {
      const status = await api("/api/status");
      showChat(status);
      return true;
    } catch {
      return false;
    }
  }

  function loadGoogleIdentity(clientId) {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (!window.google?.accounts?.id) {
        loginStatus.textContent = "Google sign-in did not load. The maintenance login is still available.";
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        use_fedcm_for_button: true,
        callback: async ({ credential }) => {
          loginStatus.textContent = "Verifying your business identity…";
          try {
            await api("/api/auth/google", {
              method: "POST",
              body: JSON.stringify({ credential, csrfToken }),
            });
            authorization = "";
            const status = await api("/api/status");
            showChat(status);
          } catch (error) {
            loginStatus.textContent = error.message;
          }
        },
      });
      window.google.accounts.id.renderButton(get("#google-button"), {
        type: "standard",
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: Math.min(360, Math.max(220, get("#google-login").clientWidth)),
      });
    };
    script.onerror = () => {
      loginStatus.textContent = "Google sign-in could not be reached. The maintenance login is still available.";
    };
    document.head.appendChild(script);
  }

  async function initializeLogin() {
    try {
      const config = await api("/api/auth/config");
      csrfToken = config.csrfToken;
      appleEnabled = Boolean(config.apple?.enabled);
      if (config.maintenancePassword) get("#maintenance-login").classList.remove("hidden");
      if (await restoreSession()) return;
      if (config.google?.enabled) {
        get("#google-login").classList.remove("hidden");
        loadGoogleIdentity(config.google.clientId);
      }
      if (config.apple?.enabled) get("#apple-login").classList.remove("hidden");
      const providers = [config.google?.enabled, config.apple?.enabled].filter(Boolean).length;
      const authError = new URLSearchParams(location.search).get("auth_error");
      loginStatus.textContent = authError
        ? "Apple sign-in was not completed. Sign in another way, then link Apple from inside Zora."
        : providers
        ? "Only approved business identities can enter."
        : "Identity login is being configured; use the maintenance password for now.";
    } catch (error) {
      showLogin(error.message);
      get("#maintenance-login").classList.remove("hidden");
    }
  }

  get("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    authorization = `Basic ${btoa(`${get("#username").value}:${get("#password").value}`)}`;
    loginStatus.textContent = "Checking…";
    try {
      const status = await api("/api/status");
      get("#password").value = "";
      showChat(status);
    } catch (error) {
      authorization = "";
      loginStatus.textContent = error.message;
    }
  });

  get("#logout").addEventListener("click", async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // The local Basic credential has no server session to revoke.
    }
    authorization = "";
    get("#password").value = "";
    showLogin("Signed out.");
    await initializeLogin();
  });

  async function beginAppleSignIn() {
    loginStatus.textContent = "Opening Apple…";
    serviceStatus.textContent = "Opening Apple…";
    try {
      const result = await api("/api/auth/apple/start", { method: "POST" });
      location.assign(result.authorizationUrl);
    } catch (error) {
      loginStatus.textContent = error.message;
      serviceStatus.textContent = error.message;
    }
  }

  get("#apple-button").addEventListener("click", beginAppleSignIn);
  get("#link-apple").addEventListener("click", beginAppleSignIn);

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
      if (error.message === "Authentication required.") showLogin("Your session ended. Sign in again.");
    } finally {
      sendButton.disabled = false;
      messageInput.focus();
    }
  });

  initializeLogin();
})();
