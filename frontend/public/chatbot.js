(function() {
  const config = window.GROWLOCAL_CONFIG || {};
  if (!config.businessId || !config.baseUrl) {
    console.error("GrowLocal Chatbot: Missing configuration");
    return;
  }

  // Styles
  const style = document.createElement('style');
  style.textContent = `
    #growlocal-chatbot-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    #growlocal-chatbot-button {
      width: 60px;
      height: 60px;
      border-radius: 30px;
      background: #a855f7;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
    }
    #growlocal-chatbot-button:hover {
      transform: scale(1.05);
    }
    #growlocal-chatbot-button svg {
      width: 30px;
      height: 30px;
      fill: white;
    }
    #growlocal-chatbot-window {
      position: absolute;
      bottom: 80px;
      right: 0;
      width: 350px;
      height: 500px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      display: none;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    #growlocal-chatbot-header {
      background: #a855f7;
      color: white;
      padding: 16px;
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    #growlocal-chatbot-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .gl-message {
      max-width: 80%;
      padding: 8px 12px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.4;
    }
    .gl-user {
      align-self: flex-end;
      background: #f1f5f9;
      color: #1e293b;
    }
    .gl-bot {
      align-self: flex-start;
      background: #a855f710;
      color: #1e293b;
      border: 1px solid #a855f720;
    }
    #growlocal-chatbot-input-container {
      padding: 12px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      gap: 8px;
    }
    #growlocal-chatbot-input {
      flex: 1;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px;
      outline: none;
    }
    #growlocal-chatbot-send {
      background: #a855f7;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 8px 12px;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);

  // Container
  const container = document.createElement('div');
  container.id = 'growlocal-chatbot-container';
  
  // Button
  const button = document.createElement('div');
  button.id = 'growlocal-chatbot-button';
  button.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
  
  // Window
  const chatWindow = document.createElement('div');
  chatWindow.id = 'growlocal-chatbot-window';
  chatWindow.innerHTML = `
    <div id="growlocal-chatbot-header">
      <span>AI Assistant</span>
      <span id="growlocal-chatbot-close" style="cursor:pointer">&times;</span>
    </div>
    <div id="growlocal-chatbot-messages">
      <div class="gl-message gl-bot">Hello! How can I help you today?</div>
    </div>
    <div id="growlocal-chatbot-input-container">
      <input type="text" id="growlocal-chatbot-input" placeholder="Type a message...">
      <button id="growlocal-chatbot-send">Send</button>
    </div>
  `;

  container.appendChild(chatWindow);
  container.appendChild(button);
  document.body.appendChild(container);

  // Logic
  let isOpen = false;
  let conversationId = localStorage.getItem('growlocal_conv_id') || Math.random().toString(36).substring(7);
  localStorage.setItem('growlocal_conv_id', conversationId);

  button.addEventListener('click', () => {
    isOpen = !isOpen;
    chatWindow.style.display = isOpen ? 'flex' : 'none';
  });

  document.getElementById('growlocal-chatbot-close').addEventListener('click', () => {
    isOpen = false;
    chatWindow.style.display = 'none';
  });

  const messagesContainer = document.getElementById('growlocal-chatbot-messages');
  const input = document.getElementById('growlocal-chatbot-input');
  const sendBtn = document.getElementById('growlocal-chatbot-send');

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    addMessage(text, 'user');

    const typing = addMessage('...', 'bot');

    try {
      const res = await fetch(`${config.baseUrl}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: config.businessId,
          conversationId: conversationId,
          message: text
        })
      });
      const data = await res.json();
      typing.remove();
      addMessage(data.response, 'bot');
    } catch (err) {
      typing.remove();
      addMessage("Sorry, I'm having trouble connecting.", 'bot');
    }
  }

  function addMessage(text, role) {
    const msg = document.createElement('div');
    msg.className = `gl-message gl-${role}`;
    msg.textContent = text;
    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return msg;
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

})();
