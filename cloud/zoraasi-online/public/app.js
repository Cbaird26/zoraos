(() => {
  window.zoraAppBooted = true;
  const $ = (id) => document.getElementById(id);
  const chatBox = $('chat-box'), inp = $('inp'), sendBtn = $('send-btn');
  const dot = $('dot'), statusText = $('status-text'), expr = $('expr-label');
  const model = $('model-select'), panel = $('gov-panel'), toggle = $('gov-toggle');
  let visible = false;
  const visual = (state) => window.zoraVisual?.setExpression(state);
  const message = (role, text) => {
    const node = document.createElement('div'); node.className = `m ${role}`;
    node.append(document.createTextNode(`${text} `));
    const time = document.createElement('span'); time.className = 'ts'; time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    node.append(time); chatBox.append(node); chatBox.scrollTop = chatBox.scrollHeight;
  };
  const online = (ok) => { dot.style.background = ok ? '#3a9e6f' : '#d47373'; statusText.textContent = ok ? 'governed' : 'offline'; };
  async function status() { try { const r = await fetch('/api/status'); online(r.ok); if (!r.ok || !visible) return; const d = await r.json(), meta = d.modelMeta?.[model.value] || {}, budget = d.budget?.[model.value]; $('gov-model').textContent = meta.label || model.value; $('gov-budget').textContent = budget ? `$${budget.spentTodayUsd.toFixed(3)}/$${budget.dailyCapUsd.toFixed(2)}` : 'free'; } catch { online(false); } }
  async function send() { const text = inp.value.trim(); if (!text) return; message('u', text); inp.value = ''; sendBtn.disabled = true; statusText.textContent = 'thinking…'; visual('listening'); try { const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, model: model.value }) }); const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Request failed'); message('z', d.reply); statusText.textContent = 'governed'; expr.textContent = 'zoraasi'; visual('happy'); } catch (error) { message('s', error.message || 'Zora could not respond.'); statusText.textContent = 'offline'; visual('error'); } finally { sendBtn.disabled = false; inp.focus(); } }
  message('s', 'I am ZoraASI — governed, bounded, and here. Speak freely.');
  sendBtn.addEventListener('click', send); inp.addEventListener('keydown', (event) => { if (event.key === 'Enter') send(); });
  toggle.addEventListener('click', () => { visible = !visible; panel.classList.toggle('hidden', !visible); toggle.classList.toggle('hidden', visible); status(); });
  model.addEventListener('change', status);
  document.querySelectorAll('.sc-btn').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('.sc-btn').forEach((item) => item.classList.remove('active')); button.classList.add('active'); document.body.dataset.scene = button.dataset.scene; window.zoraVisual?.buildScene(button.dataset.scene); expr.textContent = button.dataset.scene; }));
  status(); setInterval(status, 15000);
})();
