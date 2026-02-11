// ============================================
// NEXUS CHAT - Game Overlay Logic
// In-game overlay with compact chat interface
// ============================================

// ============ DATA ============

const overlayUsers = {
  'u-self': { name: 'NexusUser', initials: 'N', color: '#0ea5e9' },
  'u-alex': { name: 'Alex Rivera', initials: 'AR', color: '#f87171' },
  'u-maya': { name: 'Maya Chen', initials: 'MC', color: '#a78bfa' },
  'u-jordan': { name: 'Jordan Lee', initials: 'JL', color: '#38bdf8' },
  'u-sam': { name: 'Sam Torres', initials: 'ST', color: '#06d6a0' },
  'u-riley': { name: 'Riley Kim', initials: 'RK', color: '#f59e0b' },
  'u-drew': { name: 'Drew Park', initials: 'DP', color: '#8b5cf6' },
  'u-bot': { name: 'Nexus Bot', initials: '🤖', color: '#06d6a0' },
  'u-avery': { name: 'Avery Quinn', initials: 'AQ', color: '#14b8a6' },
  'u-taylor': { name: 'Taylor S.', initials: 'TS', color: '#e879f9' },
  'u-casey': { name: 'Casey Morgan', initials: 'CM', color: '#ec4899' }
};

const friends = [
  { id: 'u-alex', status: 'online', game: 'Playing Valorant' },
  { id: 'u-maya', status: 'online', game: null },
  { id: 'u-jordan', status: 'idle', game: 'Playing Minecraft' },
  { id: 'u-drew', status: 'online', game: 'In VS Code' },
  { id: 'u-riley', status: 'online', game: null },
  { id: 'u-sam', status: 'dnd', game: 'Playing Elden Ring' },
  { id: 'u-avery', status: 'idle', game: null },
  { id: 'u-taylor', status: 'online', game: null },
  { id: 'u-casey', status: 'offline', game: null }
];

// Seed messages for the overlay
let overlayMessages = [
  { id: 1, userId: 'u-alex', content: 'Anyone up for ranked later tonight?', timestamp: Date.now() - 3600000 },
  { id: 2, userId: 'u-jordan', content: 'I\'m down! What time?', timestamp: Date.now() - 3500000 },
  { id: 3, userId: 'u-alex', content: 'Thinking around 9 PM EST', timestamp: Date.now() - 3400000 },
  { id: 4, userId: 'u-maya', content: 'Count me in 🎮', timestamp: Date.now() - 3000000 },
  { id: 5, userId: 'u-drew', content: 'Just pushed a big update to the project. Check it out when you get a chance!', timestamp: Date.now() - 2400000 },
  { id: 6, userId: 'u-riley', content: 'Nice work Drew! The new UI looks clean 🔥', timestamp: Date.now() - 2200000 },
  { id: 7, userId: 'u-bot', content: '🎮 **Game Night** starts in 2 hours! Join the voice channel to participate.', timestamp: Date.now() - 1800000 },
  { id: 8, userId: 'u-sam', content: 'BRB grabbing food, save me a spot', timestamp: Date.now() - 900000 },
  { id: 9, userId: 'u-taylor', content: 'This new map is insane, has anyone tried it yet?', timestamp: Date.now() - 600000 },
  { id: 10, userId: 'u-jordan', content: 'Yeah it\'s so good! The verticality is next level', timestamp: Date.now() - 300000 }
];

let msgIdCounter = 100;
let currentTab = 'chat';
let isOverlayVisible = false;
let isPinned = false;
let isCompact = false;
let isMuted = false;
let isDeafened = false;

// ============ INITIALIZATION ============

document.addEventListener('DOMContentLoaded', () => {
  renderMessages();
  renderFriends();
  setupEventListeners();
  setupIPCListeners();
  showHotkeyHint();
});

// ============ IPC COMMUNICATION ============

function setupIPCListeners() {
  if (window.nexusOverlay) {
    window.nexusOverlay.onOverlayToggle((state) => {
      if (state) {
        showOverlay();
      } else {
        hideOverlay();
      }
    });

    window.nexusOverlay.onNewMessage((msg) => {
      overlayMessages.push(msg);
      if (currentTab === 'chat') {
        renderMessages();
      }
      if (!isOverlayVisible) {
        showToast(msg);
      }
    });

    window.nexusOverlay.onMessagesUpdate((msgs) => {
      overlayMessages = msgs;
      if (currentTab === 'chat') {
        renderMessages();
      }
    });
  }
}

// ============ EVENT LISTENERS ============

function setupEventListeners() {
  // Send message
  const input = document.getElementById('overlayInput');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.getElementById('overlaySendBtn').addEventListener('click', sendMessage);

  // Close button
  document.getElementById('closeBtn').addEventListener('click', () => {
    hideOverlay();
    if (window.nexusOverlay) {
      window.nexusOverlay.closeOverlay();
    }
  });

  // Compact toggle
  document.getElementById('compactToggle').addEventListener('click', () => {
    isCompact = !isCompact;
    document.getElementById('overlayContainer').classList.toggle('compact', isCompact);
  });

  // Pin toggle
  document.getElementById('pinBtn').addEventListener('click', () => {
    isPinned = !isPinned;
    document.getElementById('pinBtn').textContent = isPinned ? '📍' : '📌';
    document.getElementById('pinBtn').style.color = isPinned ? '#0ea5e9' : '';
  });

  // Tab switching
  document.querySelectorAll('.overlay-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });

  // Voice controls
  document.getElementById('voiceMuteBtn').addEventListener('click', () => {
    isMuted = !isMuted;
    document.getElementById('voiceMuteBtn').textContent = isMuted ? '🔇' : '🎤';
    document.getElementById('voiceMuteBtn').style.color = isMuted ? '#ef4444' : '';
  });

  document.getElementById('voiceDeafenBtn').addEventListener('click', () => {
    isDeafened = !isDeafened;
    document.getElementById('voiceDeafenBtn').textContent = isDeafened ? '🔇' : '🎧';
    document.getElementById('voiceDeafenBtn').style.color = isDeafened ? '#ef4444' : '';
  });

  document.getElementById('voiceDisconnectBtn').addEventListener('click', () => {
    document.getElementById('voiceBar').classList.remove('visible');
  });

  // Keyboard shortcut to toggle overlay (backup for when global shortcut fails)
  document.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.key === '`') {
      e.preventDefault();
      toggleOverlay();
    }
    if (e.key === 'Escape' && isOverlayVisible && !isPinned) {
      hideOverlay();
      if (window.nexusOverlay) {
        window.nexusOverlay.closeOverlay();
      }
    }
  });

  // Click outside to close (if not pinned)
  document.getElementById('overlayContainer').addEventListener('click', (e) => {
    if (e.target === document.getElementById('overlayContainer') && !isPinned) {
      hideOverlay();
      if (window.nexusOverlay) {
        window.nexusOverlay.closeOverlay();
      }
    }
  });
}

// ============ OVERLAY VISIBILITY ============

function toggleOverlay() {
  if (isOverlayVisible) {
    hideOverlay();
  } else {
    showOverlay();
  }
}

function showOverlay() {
  isOverlayVisible = true;
  document.getElementById('overlayContainer').classList.add('visible');
  if (window.nexusOverlay) {
    window.nexusOverlay.setOverlayInteractive(true);
  }
  // Focus input
  setTimeout(() => {
    document.getElementById('overlayInput').focus();
  }, 300);
}

function hideOverlay() {
  isOverlayVisible = false;
  document.getElementById('overlayContainer').classList.remove('visible');
  if (window.nexusOverlay) {
    window.nexusOverlay.setOverlayInteractive(false);
  }
}

function showHotkeyHint() {
  const hint = document.getElementById('hotkeyHint');
  hint.classList.add('visible');
  setTimeout(() => {
    hint.classList.remove('visible');
  }, 3000);
}

// ============ TAB SWITCHING ============

function switchTab(tab) {
  currentTab = tab;

  document.querySelectorAll('.overlay-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });

  const messagesEl = document.getElementById('overlayMessages');
  const friendsEl = document.getElementById('friendsList');
  const inputArea = document.getElementById('overlayInputArea');

  if (tab === 'chat' || tab === 'dms') {
    messagesEl.style.display = 'flex';
    friendsEl.classList.remove('visible');
    inputArea.style.display = 'block';
    renderMessages();
  } else if (tab === 'friends') {
    messagesEl.style.display = 'none';
    friendsEl.classList.add('visible');
    inputArea.style.display = 'none';
  }
}

// ============ MESSAGE RENDERING ============

function renderMessages() {
  const container = document.getElementById('overlayMessages');
  container.innerHTML = '';

  let lastUserId = null;
  let lastTime = 0;

  overlayMessages.forEach((msg) => {
    const user = overlayUsers[msg.userId] || { name: 'Unknown', initials: '?', color: '#666' };
    const timeDiff = msg.timestamp - lastTime;
    const isGrouped = msg.userId === lastUserId && timeDiff < 300000; // 5 min grouping

    const msgEl = document.createElement('div');
    msgEl.className = 'overlay-msg' + (isGrouped ? ' grouped' : '');

    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isGrouped) {
      msgEl.innerHTML = `
        <div class="overlay-msg-avatar placeholder"></div>
        <div class="overlay-msg-content">
          <div class="overlay-msg-body">${formatContent(msg.content)}</div>
        </div>
      `;
    } else {
      msgEl.innerHTML = `
        <div class="overlay-msg-avatar" style="background:${user.color}">${user.initials}</div>
        <div class="overlay-msg-content">
          <div class="overlay-msg-header">
            <span class="overlay-msg-author" style="color:${user.color}">${user.name}</span>
            <span class="overlay-msg-time">${timeStr}</span>
          </div>
          <div class="overlay-msg-body">${formatContent(msg.content)}</div>
        </div>
      `;
    }

    container.appendChild(msgEl);
    lastUserId = msg.userId;
    lastTime = msg.timestamp;
  });

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function formatContent(content) {
  // Bold
  content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Inline code
  content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Mentions
  content = content.replace(/@(\w[\w\s]*\w)/g, '<span class="mention">@$1</span>');
  return content;
}

// ============ SEND MESSAGE ============

function sendMessage() {
  const input = document.getElementById('overlayInput');
  const content = input.value.trim();
  if (!content) return;

  const msg = {
    id: ++msgIdCounter,
    userId: 'u-self',
    content: content,
    timestamp: Date.now()
  };

  overlayMessages.push(msg);
  input.value = '';
  renderMessages();

  // Send to main window via IPC
  if (window.nexusOverlay) {
    window.nexusOverlay.sendMessage(msg);
  }

  // Simulate a reply after a short delay
  simulateReply(content);
}

function simulateReply(content) {
  const lower = content.toLowerCase();
  const replyUsers = ['u-alex', 'u-maya', 'u-jordan', 'u-drew', 'u-riley'];
  const randomUser = replyUsers[Math.floor(Math.random() * replyUsers.length)];

  let reply = null;

  if (lower.includes('gg') || lower.includes('nice')) {
    const responses = ['GG! 🎮', 'Well played!', 'That was insane!', 'Let\'s go!! 🔥', 'Clutch play!'];
    reply = responses[Math.floor(Math.random() * responses.length)];
  } else if (lower.includes('help') || lower.includes('push')) {
    const responses = ['On my way!', 'Coming to help!', 'I got you 👍', 'Rotating now', 'Hold on, almost there!'];
    reply = responses[Math.floor(Math.random() * responses.length)];
  } else if (lower.includes('?')) {
    const responses = ['Good question!', 'I think so', 'Not sure, let me check', 'Yeah definitely', 'Hmm let me think about that'];
    reply = responses[Math.floor(Math.random() * responses.length)];
  } else if (Math.random() > 0.5) {
    const responses = [
      'Facts 💯', 'Lol 😂', 'True', 'Agreed!', 'Nice one!',
      'For real though', 'Haha yeah', '👍', 'Same here',
      'Let\'s gooo', 'Big W', 'No cap'
    ];
    reply = responses[Math.floor(Math.random() * responses.length)];
  }

  if (reply) {
    setTimeout(() => {
      const replyMsg = {
        id: ++msgIdCounter,
        userId: randomUser,
        content: reply,
        timestamp: Date.now()
      };
      overlayMessages.push(replyMsg);
      renderMessages();

      if (!isOverlayVisible) {
        showToast(replyMsg);
      }
    }, 1500 + Math.random() * 3000);
  }
}

// ============ FRIENDS LIST ============

function renderFriends() {
  const container = document.getElementById('friendsList');
  container.innerHTML = '';

  // Sort: online first, then idle, dnd, offline
  const statusOrder = { online: 0, idle: 1, dnd: 2, offline: 3 };
  const sorted = [...friends].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  sorted.forEach(friend => {
    const user = overlayUsers[friend.id];
    if (!user) return;

    const item = document.createElement('div');
    item.className = 'overlay-friend-item';
    item.innerHTML = `
      <div class="overlay-friend-avatar" style="background:${user.color}">
        ${user.initials}
        <div class="overlay-friend-status ${friend.status}"></div>
      </div>
      <div style="flex:1;min-width:0;">
        <div class="overlay-friend-name">${user.name}</div>
        ${friend.game ? `<div class="overlay-friend-game">${friend.game}</div>` : ''}
      </div>
    `;

    item.addEventListener('click', () => {
      // Switch to DM tab with this user
      switchTab('dms');
      document.getElementById('overlayInput').placeholder = `Message @${user.name}`;
      document.getElementById('overlayChannelName').textContent = `@ ${user.name}`;
    });

    container.appendChild(item);
  });
}

// ============ TOAST NOTIFICATIONS ============

function showToast(msg) {
  const user = overlayUsers[msg.userId] || { name: 'Unknown', initials: '?', color: '#666' };
  const container = document.getElementById('toastContainer');

  const toast = document.createElement('div');
  toast.className = 'overlay-toast';
  toast.innerHTML = `
    <div class="overlay-toast-avatar" style="background:${user.color}">${user.initials}</div>
    <div class="overlay-toast-content">
      <div class="overlay-toast-author" style="color:${user.color}">${user.name}</div>
      <div class="overlay-toast-body">${msg.content}</div>
    </div>
  `;

  toast.addEventListener('click', () => {
    showOverlay();
    toast.remove();
    if (window.nexusOverlay) {
      window.nexusOverlay.toggleOverlay();
    }
  });

  container.appendChild(toast);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 5000);

  // Limit to 3 toasts
  while (container.children.length > 3) {
    container.removeChild(container.firstChild);
  }
}

// ============ SIMULATE INCOMING MESSAGES ============

// Periodically simulate incoming messages when overlay is not visible
setInterval(() => {
  if (Math.random() > 0.7) {
    const userIds = ['u-alex', 'u-maya', 'u-jordan', 'u-drew', 'u-riley', 'u-sam', 'u-taylor'];
    const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
    const messages = [
      'Anyone want to queue up?',
      'That last round was crazy',
      'BRB 5 min',
      'Check out this play I just made',
      'We need better comms next round',
      'GG everyone!',
      'Let\'s switch to a different map',
      'Who\'s calling strats?',
      'Nice clutch! 🔥',
      'I\'m lagging so bad right now',
      'One more game then I gotta go',
      'This team comp is actually cracked',
      'Enemy team is rotating, heads up',
      'I got top frag let\'s go 😎',
      'Alright I\'m warmed up now'
    ];
    const randomMsg = messages[Math.floor(Math.random() * messages.length)];

    const msg = {
      id: ++msgIdCounter,
      userId: randomUserId,
      content: randomMsg,
      timestamp: Date.now()
    };

    overlayMessages.push(msg);

    // Keep message history manageable
    if (overlayMessages.length > 50) {
      overlayMessages = overlayMessages.slice(-50);
    }

    if (currentTab === 'chat') {
      renderMessages();
    }

    if (!isOverlayVisible) {
      showToast(msg);
    }
  }
}, 20000);