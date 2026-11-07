let troubleshootingData = [];

async function loadTroubleshooting() {
  try {
    const res = await fetch('assets/data/troubleshooting.json');
    troubleshootingData = await res.json();
  } catch (_) { troubleshootingData = []; }
}

function findResponse(input) {
  const lower = input.toLowerCase().trim();
  if (!lower) return null;
  for (const item of troubleshootingData) {
    if (item.keywords.some(kw => lower.includes(kw.toLowerCase()))) return item;
  }
  return null;
}

function addMessage(text, type) {
  const messages = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `chat-msg ${type}`;
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function showTyping() {
  const messages = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-msg bot typing-indicator';
  div.id = 'typing-indicator';
  div.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

function addBotResponse(item) {
  const messages = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-msg bot';

  // Built from DOM nodes rather than an innerHTML template. The data is
  // ours today, but the moment troubleshooting entries become
  // community-sourced an innerHTML template is a stored-XSS hole, and
  // this is the version that stays correct either way.
  const title = document.createElement('strong');
  title.textContent = item.title;
  div.append(title, document.createElement('br'));

  const body = document.createElement('span');
  body.textContent = item.response;
  div.append(body, document.createElement('br'));

  const ul = document.createElement('ul');
  ul.style.cssText = 'margin:8px 0 0 12px;font-size:0.75rem;';
  (item.steps || []).forEach(step => {
    const li = document.createElement('li');
    li.textContent = step;
    ul.appendChild(li);
  });
  div.appendChild(ul);

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function suggestTopics() {
  // Offer the available topics as clickable chips when nothing matched.
  return troubleshootingData.slice(0, 6).map(t => t.title).join(', ');
}

function send(text) {
  if (!text) return;
  addMessage(text, 'user');
  showTyping();
  // Hide quick-reply chips after the first interaction.
  const chips = document.getElementById('chatChips');
  if (chips) chips.style.display = 'none';
  setTimeout(() => {
    removeTyping();
    const match = findResponse(text);
    if (match) {
      addBotResponse(match);
    } else {
      addMessage(`I don't have an exact fix for that yet. I can help with: ${suggestTopics()}. Try describing it with one of those keywords.`, 'bot');
    }
  }, 700 + Math.random() * 400);
}

function handleSend() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  send(text);
}

function toggleChat() {
  const win = document.getElementById('chatWindow');
  win.classList.toggle('active');
  if (win.classList.contains('active') && troubleshootingData.length === 0) loadTroubleshooting();
}

// Expose globals for inline handlers
window.handleSend   = handleSend;
window.toggleChat   = toggleChat;

// Enter key + quick-reply chip support
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('chatInput');
  if (input) input.addEventListener('keypress', e => { if (e.key === 'Enter') handleSend(); });

  const chips = document.getElementById('chatChips');
  if (chips) {
    chips.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      if (navigator.vibrate) { try { navigator.vibrate(8); } catch (_) {} }
      if (troubleshootingData.length === 0) loadTroubleshooting().then(() => send(chip.dataset.q));
      else send(chip.dataset.q);
    });
  }
});

loadTroubleshooting();
