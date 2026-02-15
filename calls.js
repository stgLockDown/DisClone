// ============================================
// NEXUS CHAT — Direct Calls & Server Discovery
// ============================================

// ============ CALL STATE ============
const callState = {
  active: false,
  minimized: false,
  type: null, // 'voice' or 'video'
  targetUser: null,
  startTime: null,
  timerInterval: null,
  muted: false,
  deafened: false,
  videoOn: false,
  screenShare: false,
  speaking: false,
  speakingInterval: null,
  quality: 'good' // good, medium, poor
};

// Call history per DM
const callHistory = {};

// ============ DISCOVERY DATA ============
const discoveryServers = [
  {
    id: 'disc-1',
    name: 'Valorant Community',
    desc: 'The largest Valorant community on Nexus! Find teammates, share clips, discuss strategies, and participate in weekly tournaments.',
    icon: '🎯',
    iconBg: 'linear-gradient(135deg, #ef4444, #dc2626)',
    banner: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&h=200&fit=crop',
    category: 'gaming',
    tags: ['FPS', 'Competitive', 'Esports', 'Valorant'],
    members: 142850,
    online: 28491,
    verified: true,
    featured: true,
    channels: ['# welcome', '# general', '# looking-for-group', '# clip-sharing', '# strategies', '🔊 Team Voice 1', '🔊 Team Voice 2']
  },
  {
    id: 'disc-2',
    name: 'Lofi Study Zone',
    desc: 'Chill beats and focused study sessions. Join our 24/7 lofi streams, find study buddies, and stay productive together.',
    icon: '📚',
    iconBg: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    banner: 'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=600&h=200&fit=crop',
    category: 'education',
    tags: ['Study', 'Lofi', 'Productivity', 'Chill'],
    members: 89420,
    online: 12340,
    verified: true,
    featured: true,
    channels: ['# rules', '# general', '# study-goals', '# music-requests', '🔊 Lofi Stream', '🔊 Silent Study', '🔊 Group Study']
  },
  {
    id: 'disc-3',
    name: 'Digital Artists Hub',
    desc: 'A creative community for digital artists of all skill levels. Share your work, get feedback, participate in art challenges, and learn new techniques.',
    icon: '🎨',
    iconBg: 'linear-gradient(135deg, #ec4899, #be185d)',
    banner: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&h=200&fit=crop',
    category: 'art',
    tags: ['Digital Art', 'Drawing', 'Design', 'Illustration'],
    members: 67200,
    online: 8930,
    verified: true,
    featured: false,
    channels: ['# welcome', '# art-showcase', '# feedback', '# tutorials', '# commissions', '🔊 Art Stream', '🔊 Chill & Draw']
  },
  {
    id: 'disc-4',
    name: 'Web Dev Central',
    desc: 'Full-stack web development community. Get help with React, Vue, Node.js, and more. Weekly code reviews and pair programming sessions.',
    icon: '💻',
    iconBg: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
    banner: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&h=200&fit=crop',
    category: 'tech',
    tags: ['JavaScript', 'React', 'Node.js', 'Web Dev'],
    members: 95600,
    online: 15200,
    verified: true,
    featured: true,
    channels: ['# welcome', '# general', '# help', '# react', '# backend', '# show-your-work', '🔊 Pair Programming', '🔊 Code Review']
  },
  {
    id: 'disc-5',
    name: 'Anime & Manga World',
    desc: 'Discuss your favorite anime and manga series! Seasonal watch parties, manga reading clubs, fan art sharing, and more.',
    icon: '⛩️',
    iconBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
    banner: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&h=200&fit=crop',
    category: 'entertainment',
    tags: ['Anime', 'Manga', 'Japanese Culture', 'Watch Parties'],
    members: 203400,
    online: 41200,
    verified: true,
    featured: false,
    channels: ['# rules', '# general', '# seasonal-anime', '# manga-discussion', '# fan-art', '# recommendations', '🔊 Watch Party', '🔊 Chill Talk']
  },
  {
    id: 'disc-6',
    name: 'Music Producers',
    desc: 'Connect with music producers worldwide. Share beats, get mixing feedback, collaborate on tracks, and learn production techniques.',
    icon: '🎹',
    iconBg: 'linear-gradient(135deg, #06d6a0, #059669)',
    banner: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&h=200&fit=crop',
    category: 'music',
    tags: ['Production', 'Beats', 'Mixing', 'Collaboration'],
    members: 54300,
    online: 7820,
    verified: false,
    featured: false,
    channels: ['# welcome', '# beat-sharing', '# feedback', '# collabs', '# sample-packs', '🔊 Listening Party', '🔊 Production Stream']
  },
  {
    id: 'disc-7',
    name: 'Minecraft Builders',
    desc: 'The ultimate Minecraft building community. Share builds, join building competitions, download schematics, and play on our server.',
    icon: '⛏️',
    iconBg: 'linear-gradient(135deg, #84cc16, #65a30d)',
    banner: 'https://images.unsplash.com/photo-1587573089734-09cb69c0f2b4?w=600&h=200&fit=crop',
    category: 'gaming',
    tags: ['Minecraft', 'Building', 'Creative', 'Survival'],
    members: 178900,
    online: 32100,
    verified: true,
    featured: false,
    channels: ['# rules', '# general', '# build-showcase', '# schematics', '# server-info', '# redstone', '🔊 Build Together', '🔊 Survival']
  },
  {
    id: 'disc-8',
    name: 'Fitness & Health',
    desc: 'Your fitness journey starts here! Workout plans, nutrition advice, progress tracking, and a supportive community to keep you motivated.',
    icon: '💪',
    iconBg: 'linear-gradient(135deg, #ef4444, #b91c1c)',
    banner: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=200&fit=crop',
    category: 'lifestyle',
    tags: ['Fitness', 'Health', 'Nutrition', 'Workout'],
    members: 43200,
    online: 5600,
    verified: false,
    featured: false,
    channels: ['# welcome', '# general', '# workout-plans', '# nutrition', '# progress-pics', '# motivation', '🔊 Workout Buddy']
  },
  {
    id: 'disc-9',
    name: 'Python Developers',
    desc: 'Everything Python! From beginners to experts. Get help, share projects, discuss libraries, and participate in coding challenges.',
    icon: '🐍',
    iconBg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    banner: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&h=200&fit=crop',
    category: 'tech',
    tags: ['Python', 'Programming', 'Data Science', 'AI/ML'],
    members: 112300,
    online: 18700,
    verified: true,
    featured: false,
    channels: ['# welcome', '# general', '# help', '# projects', '# data-science', '# ai-ml', '🔊 Code Together', '🔊 Office Hours']
  },
  {
    id: 'disc-10',
    name: 'Photography Club',
    desc: 'Share your photos, learn editing techniques, participate in weekly photo challenges, and connect with photographers worldwide.',
    icon: '📷',
    iconBg: 'linear-gradient(135deg, #a855f7, #7c3aed)',
    banner: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=600&h=200&fit=crop',
    category: 'art',
    tags: ['Photography', 'Editing', 'Lightroom', 'Landscape'],
    members: 38700,
    online: 4200,
    verified: false,
    featured: false,
    channels: ['# welcome', '# photo-share', '# editing-tips', '# gear-talk', '# weekly-challenge', '🔊 Photo Walk']
  },
  {
    id: 'disc-11',
    name: 'Crypto & Web3',
    desc: 'Stay updated on crypto markets, DeFi protocols, NFTs, and blockchain technology. Daily market analysis and trading discussions.',
    icon: '₿',
    iconBg: 'linear-gradient(135deg, #f59e0b, #b45309)',
    banner: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=600&h=200&fit=crop',
    category: 'tech',
    tags: ['Crypto', 'Blockchain', 'DeFi', 'Trading'],
    members: 87600,
    online: 14300,
    verified: false,
    featured: false,
    channels: ['# announcements', '# general', '# market-analysis', '# defi', '# nfts', '# trading', '🔊 Market Talk']
  },
  {
    id: 'disc-12',
    name: 'Movie Buffs',
    desc: 'For cinema lovers! Discuss new releases, classic films, share reviews, and join our weekly movie night watch parties.',
    icon: '🎬',
    iconBg: 'linear-gradient(135deg, #e11d48, #9f1239)',
    banner: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&h=200&fit=crop',
    category: 'entertainment',
    tags: ['Movies', 'Cinema', 'Reviews', 'Watch Parties'],
    members: 62400,
    online: 9100,
    verified: false,
    featured: true,
    channels: ['# welcome', '# general', '# new-releases', '# reviews', '# recommendations', '# classic-films', '🔊 Movie Night']
  },
  {
    id: 'disc-13',
    name: 'League of Legends',
    desc: 'The biggest LoL community on Nexus. Find duo partners, discuss meta, share highlights, and follow esports together.',
    icon: '⚔️',
    iconBg: 'linear-gradient(135deg, #0ea5e9, #0369a1)',
    banner: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&h=200&fit=crop',
    category: 'gaming',
    tags: ['League of Legends', 'MOBA', 'Esports', 'Ranked'],
    members: 256700,
    online: 52300,
    verified: true,
    featured: false,
    channels: ['# rules', '# general', '# looking-for-duo', '# highlights', '# esports', '# champion-discussion', '🔊 Ranked Flex', '🔊 ARAM']
  },
  {
    id: 'disc-14',
    name: 'Cooking & Recipes',
    desc: 'Share recipes, cooking tips, and food photography. From beginner cooks to professional chefs — everyone is welcome!',
    icon: '👨‍🍳',
    iconBg: 'linear-gradient(135deg, #f97316, #c2410c)',
    banner: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=200&fit=crop',
    category: 'lifestyle',
    tags: ['Cooking', 'Recipes', 'Food', 'Baking'],
    members: 29800,
    online: 3400,
    verified: false,
    featured: false,
    channels: ['# welcome', '# recipes', '# food-pics', '# baking', '# meal-prep', '# kitchen-tips', '🔊 Cook Along']
  },
  {
    id: 'disc-15',
    name: 'Startup Founders',
    desc: 'A community for startup founders and aspiring entrepreneurs. Share your journey, get feedback, find co-founders, and learn from others.',
    icon: '🚀',
    iconBg: 'linear-gradient(135deg, #6366f1, #4338ca)',
    banner: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=600&h=200&fit=crop',
    category: 'tech',
    tags: ['Startups', 'Entrepreneurship', 'Business', 'SaaS'],
    members: 41500,
    online: 6800,
    verified: false,
    featured: false,
    channels: ['# welcome', '# general', '# pitch-feedback', '# fundraising', '# hiring', '# marketing', '🔊 Office Hours', '🔊 Networking']
  },
  {
    id: 'disc-16',
    name: 'K-Pop Universe',
    desc: 'The ultimate K-Pop fan community! Discuss your favorite groups, share fan content, stream parties, and connect with fans worldwide.',
    icon: '🎤',
    iconBg: 'linear-gradient(135deg, #ec4899, #be185d)',
    banner: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=200&fit=crop',
    category: 'music',
    tags: ['K-Pop', 'Music', 'Fan Community', 'Streaming'],
    members: 184200,
    online: 38900,
    verified: true,
    featured: false,
    channels: ['# rules', '# general', '# boy-groups', '# girl-groups', '# fan-art', '# comebacks', '🔊 Listening Party', '🔊 Fan Chat']
  }
];

const discoveryCategories = [
  { id: 'all', name: 'All', icon: '🌐' },
  { id: 'gaming', name: 'Gaming', icon: '🎮' },
  { id: 'music', name: 'Music', icon: '🎵' },
  { id: 'education', name: 'Education', icon: '📖' },
  { id: 'tech', name: 'Science & Tech', icon: '💡' },
  { id: 'art', name: 'Art & Creative', icon: '🎨' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬' },
  { id: 'lifestyle', name: 'Lifestyle', icon: '🌿' }
];

let activeDiscoverCategory = 'all';
let discoverSearchQuery = '';

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  // Hook into discover button
  const discoverBtn = document.querySelector('.discover-btn');
  if (discoverBtn) {
    discoverBtn.onclick = () => openDiscovery();
  }

  // Enhance DM channel items with call buttons
  enhanceDMSystem();

  // Override switchChannel to add call buttons in header for DMs
  const origSwitchChannel = window.switchChannel;
  window.switchChannel = function(channelId) {
    origSwitchChannel(channelId);
    if (channelId.startsWith('dm-')) {
      addDMCallButtons(channelId);
      renderCallHistoryMessages(channelId);
    } else {
      removeDMCallButtons();
    }
  };

  // Incoming calls are handled via WebSocket signaling — no simulation
});

function enhanceDMSystem() {
  // Add more DM contacts
  const homeServer = servers['home'];
  if (homeServer) {
    const existingIds = homeServer.channels['dm'].map(c => c.id);
    const additionalDMs = [
      { id: 'dm-riley', name: 'Riley Kim', type: 'dm', icon: '💬' },
      { id: 'dm-drew', name: 'Drew Park', type: 'dm', icon: '💬' },
      { id: 'dm-sam', name: 'Sam Torres', type: 'dm', icon: '💬' },
      { id: 'dm-avery', name: 'Avery Quinn', type: 'dm', icon: '💬' },
      { id: 'dm-taylor', name: 'Taylor Swift... jk', type: 'dm', icon: '💬' }
    ];
    additionalDMs.forEach(dm => {
      if (!existingIds.includes(dm.id)) {
        homeServer.channels['dm'].push(dm);
      }
    });
  }

  // Initialize call history for DMs
  Object.keys(servers['home']?.channels?.['dm'] || {}).forEach(idx => {
    const ch = servers['home'].channels['dm'][idx];
    if (ch && !callHistory[ch.id]) {
      callHistory[ch.id] = [];
    }
  });

  // Add some sample call history
  callHistory['dm-alex'] = [
    { type: 'voice', direction: 'outgoing', status: 'completed', duration: '12:34', timestamp: 'Yesterday at 3:45 PM' },
    { type: 'video', direction: 'incoming', status: 'missed', duration: null, timestamp: 'Yesterday at 1:20 PM' }
  ];
  callHistory['dm-maya'] = [
    { type: 'voice', direction: 'incoming', status: 'completed', duration: '5:21', timestamp: 'Today at 10:15 AM' }
  ];
}

// ============ DM CALL BUTTONS IN HEADER ============
function addDMCallButtons(channelId) {
  const headerActions = document.querySelector('.header-actions');
  if (!headerActions) return;

  // Remove existing call buttons
  removeDMCallButtons();

  const userId = channelId.replace('dm-', 'u-');
  const user = users[userId];
  if (!user) return;

  // Update header to show DM user info
  const headerIcon = document.getElementById('chatHeaderIcon');
  const headerName = document.getElementById('chatHeaderName');
  const headerTopic = document.getElementById('chatHeaderTopic');

  if (headerIcon) {
    headerIcon.innerHTML = `<div class="dm-header-avatar" style="background:${user.color};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;position:relative;">${user.initials}<span style="position:absolute;bottom:-1px;right:-1px;width:10px;height:10px;border-radius:50%;background:${getStatusColor(user.status)};border:2px solid var(--bg-primary);"></span></div>`;
    headerIcon.style.fontSize = '0';
  }
  if (headerName) headerName.textContent = user.name;
  if (headerTopic) headerTopic.textContent = user.status === 'online' ? 'Online' : user.status === 'idle' ? 'Idle' : user.status === 'dnd' ? 'Do Not Disturb' : 'Offline';

  // Create call buttons container
  const callBtns = document.createElement('div');
  callBtns.className = 'dm-call-actions';
  callBtns.id = 'dmCallActions';
  callBtns.innerHTML = `
    <button class="dm-call-btn" onclick="startCall('${channelId}', 'voice')" title="Start Voice Call">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>
    </button>
    <button class="dm-call-btn" onclick="startCall('${channelId}', 'video')" title="Start Video Call">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
    </button>
  `;

  // Insert before the first button in header actions
  headerActions.insertBefore(callBtns, headerActions.firstChild);
}

function removeDMCallButtons() {
  const existing = document.getElementById('dmCallActions');
  if (existing) existing.remove();
}

function getStatusColor(status) {
  switch(status) {
    case 'online': return '#22c55e';
    case 'idle': return '#f59e0b';
    case 'dnd': return '#ef4444';
    default: return '#6b7280';
  }
}

// ============ START CALL ============
function startCall(channelId, type) {
  if (callState.active) {
    showToast('Already in a call!', 'error');
    return;
  }

  // Find the DM target user from the channel's user list or DM metadata
  let user = null;
  const dmChannels = (typeof servers !== 'undefined' && servers['home']) ? (servers['home'].channels['dm'] || []) : [];
  const dmCh = dmChannels.find(ch => ch.id === channelId);
  if (dmCh && dmCh._targetUserId) {
    user = users[dmCh._targetUserId];
  }
  if (!user) {
    // Fallback: try to find user from channel messages
    const msgs = (typeof channelMessages !== 'undefined' && channelMessages[channelId]) || [];
    const otherMsg = msgs.find(m => m.userId !== (currentUser.id || currentUser._authId));
    if (otherMsg) user = users[otherMsg.userId];
  }
  if (!user) {
    showToast('Could not find call target', 'error');
    return;
  }

  callState.targetUser = user;
  callState.type = type;

  // Show outgoing call UI
  showOutgoingCall(user, type);
}

function showOutgoingCall(user, type) {
  const overlay = document.createElement('div');
  overlay.className = 'call-overlay';
  overlay.id = 'callOverlay';
  overlay.innerHTML = `
    <div class="incoming-call-card">
      <div class="incoming-call-avatar" style="background:${user.color}">
        ${user.initials}
        <div class="ringing-waves">
          <div class="wave"></div>
          <div class="wave"></div>
          <div class="wave"></div>
        </div>
      </div>
      <div class="incoming-call-name">${user.name}</div>
      <div class="incoming-call-type">
        <span class="call-type-icon">${type === 'video' ? '📹' : '📞'}</span>
        Calling...
      </div>
      <div class="incoming-call-actions">
        <button class="call-action-btn decline" onclick="cancelCall()">
          <span>✕</span>
          <span class="btn-label">Cancel</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Call will be connected when the remote user answers via WebSocket signaling
  // For now, show a timeout if no answer after 30 seconds
  callState._ringTimeout = setTimeout(() => {
    const el = document.getElementById('callOverlay');
    if (el) {
      el.remove();
      showToast('No answer', 'error');
      callState.active = false;
    }
  }, 30000);
}

function simulateIncomingCall() {
  // Disabled — incoming calls are handled via WebSocket signaling
  return;
}

function showIncomingCall(user, type) {
  if (callState.active) return;

  const overlay = document.createElement('div');
  overlay.className = 'call-overlay';
  overlay.id = 'callOverlay';
  overlay.innerHTML = `
    <div class="incoming-call-card">
      <div class="incoming-call-avatar" style="background:${user.color}">
        ${user.initials}
        <div class="ringing-waves">
          <div class="wave"></div>
          <div class="wave"></div>
          <div class="wave"></div>
        </div>
      </div>
      <div class="incoming-call-name">${user.name}</div>
      <div class="incoming-call-type">
        <span class="call-type-icon">${type === 'video' ? '📹' : '📞'}</span>
        Incoming ${type === 'video' ? 'Video' : 'Voice'} Call
      </div>
      <div class="incoming-call-actions">
        <button class="call-action-btn decline" onclick="declineCall('${user.id}')">
          <span>✕</span>
          <span class="btn-label">Decline</span>
        </button>
        <button class="call-action-btn accept" onclick="acceptCall('${user.id}', '${type}')">
          <span>${type === 'video' ? '📹' : '📞'}</span>
          <span class="btn-label">Accept</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Auto-decline after 30 seconds
  setTimeout(() => {
    const el = document.getElementById('callOverlay');
    if (el && !callState.active) {
      el.remove();
      addCallHistoryEntry(typeof activeChannel !== 'undefined' ? activeChannel : 'dm-call', {
        type, direction: 'incoming', status: 'missed', duration: null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      showToast(`Missed ${type} call from ${user.name}`, 'warning');
    }
  }, 30000);
}

function acceptCall(userId, type) {
  const user = users[userId];
  if (!user) return;
  const overlay = document.getElementById('callOverlay');
  if (overlay) overlay.remove();
  connectCall(user, type, 'incoming');
}

function declineCall(userId) {
  const user = users[userId];
  const overlay = document.getElementById('callOverlay');
  if (overlay) overlay.remove();
  if (user) {
    addCallHistoryEntry(typeof activeChannel !== 'undefined' ? activeChannel : 'dm-call', {
      type: 'voice', direction: 'incoming', status: 'declined', duration: null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    showToast(`Declined call from ${user.name}`, 'info');
  }
}

function cancelCall() {
  const overlay = document.getElementById('callOverlay');
  if (overlay) overlay.remove();
  callState.active = false;
  callState.targetUser = null;
  showToast('Call cancelled', 'info');
}

// ============ ACTIVE CALL ============
function connectCall(user, type, direction) {
  callState.active = true;
  callState.type = type;
  callState.targetUser = user;
  callState.startTime = Date.now();
  callState.muted = false;
  callState.deafened = false;
  callState.videoOn = type === 'video';
  callState.screenShare = false;
  callState.minimized = false;

  showActiveCallUI();
  startCallTimer();
  startSpeakingSimulation();

  // Add to call history
  const dmId = typeof activeChannel !== 'undefined' ? activeChannel : 'dm-call';
  addCallHistoryEntry(dmId, {
    type, direction, status: 'completed', duration: '0:00',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    _live: true
  });
}

function showActiveCallUI() {
  const user = callState.targetUser;
  if (!user) return;

  // Remove any existing
  const existing = document.getElementById('activeCallOverlay');
  if (existing) existing.remove();
  const existingMini = document.getElementById('miniCallBar');
  if (existingMini) existingMini.remove();

  const overlay = document.createElement('div');
  overlay.className = 'active-call-overlay';
  overlay.id = 'activeCallOverlay';
  overlay.innerHTML = `
    <div class="active-call-bg-pattern"></div>
    <div class="active-call-content">
      <div class="active-call-participants">
        <div class="call-participant">
          <div class="call-participant-avatar ${callState.videoOn ? 'video-on' : ''}" style="background:${currentUser.color}" id="selfCallAvatar">
            ${callState.videoOn ? '<video autoplay muted playsinline></video>' : currentUser.initials}
          </div>
          <div class="call-participant-name">${currentUser.name} (You)</div>
          <div class="call-participant-status" id="selfCallStatus">Connected</div>
        </div>
        <div class="call-participant">
          <div class="call-participant-avatar" style="background:${user.color}" id="remoteCallAvatar">
            ${user.initials}
          </div>
          <div class="call-participant-name">${user.name}</div>
          <div class="call-participant-status" id="remoteCallStatus">Connected</div>
        </div>
      </div>
      <div class="active-call-status" id="callStatusText">${callState.type === 'video' ? 'Video' : 'Voice'} Call</div>
      <div class="active-call-timer" id="callTimer">00:00</div>
      <div class="active-call-quality">
        <span class="quality-dot"></span>
        <span id="callQualityText">Excellent connection</span>
      </div>
      <div class="active-call-controls">
        <button class="call-ctrl-btn ${callState.muted ? 'muted' : ''}" id="callMuteBtn" onclick="toggleCallMute()">
          ${callState.muted ? '🔇' : '🎤'}
          <span class="ctrl-tooltip">Mute</span>
        </button>
        <button class="call-ctrl-btn ${callState.deafened ? 'muted' : ''}" id="callDeafenBtn" onclick="toggleCallDeafen()">
          ${callState.deafened ? '🔇' : '🎧'}
          <span class="ctrl-tooltip">Deafen</span>
        </button>
        <button class="call-ctrl-btn ${callState.videoOn ? 'active' : ''}" id="callVideoBtn" onclick="toggleCallVideo()">
          ${callState.videoOn ? '📹' : '📷'}
          <span class="ctrl-tooltip">Video</span>
        </button>
        <button class="call-ctrl-btn ${callState.screenShare ? 'active' : ''}" id="callScreenBtn" onclick="toggleCallScreenShare()">
          🖥️
          <span class="ctrl-tooltip">Share Screen</span>
        </button>
        <button class="call-ctrl-btn" onclick="minimizeCall()">
          🔽
          <span class="ctrl-tooltip">Minimize</span>
        </button>
        <button class="call-ctrl-btn end-call" onclick="endCall()">
          📞
          <span class="ctrl-tooltip">End Call</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Try to get camera if video call
  if (callState.videoOn) {
    tryGetCamera();
  }
}

function tryGetCamera() {
  navigator.mediaDevices?.getUserMedia({ video: true })
    .then(stream => {
      const video = document.querySelector('#selfCallAvatar video');
      if (video) video.srcObject = stream;
      callState._stream = stream;
    })
    .catch(() => {
      // Camera not available, show initials instead
      const avatar = document.getElementById('selfCallAvatar');
      if (avatar) {
        avatar.classList.remove('video-on');
        avatar.innerHTML = currentUser.initials;
      }
      callState.videoOn = false;
    });
}

function startCallTimer() {
  if (callState.timerInterval) clearInterval(callState.timerInterval);
  callState.timerInterval = setInterval(() => {
    if (!callState.startTime) return;
    const elapsed = Math.floor((Date.now() - callState.startTime) / 1000);
    const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const secs = (elapsed % 60).toString().padStart(2, '0');
    const timeStr = `${mins}:${secs}`;

    const timerEl = document.getElementById('callTimer');
    if (timerEl) timerEl.textContent = timeStr;

    const miniTimer = document.querySelector('.mini-call-timer');
    if (miniTimer) miniTimer.textContent = timeStr;
  }, 1000);
}

function startSpeakingSimulation() {
  // Speaking indicators should be driven by actual audio level detection
  // via WebRTC audio tracks, not random simulation
  return;
}

// ============ CALL CONTROLS ============
function toggleCallMute() {
  callState.muted = !callState.muted;
  const btn = document.getElementById('callMuteBtn');
  if (btn) {
    btn.className = `call-ctrl-btn ${callState.muted ? 'muted' : ''}`;
    btn.innerHTML = `${callState.muted ? '🔇' : '🎤'}<span class="ctrl-tooltip">${callState.muted ? 'Unmute' : 'Mute'}</span>`;
  }
  const selfStatus = document.getElementById('selfCallStatus');
  if (selfStatus) selfStatus.textContent = callState.muted ? 'Muted' : 'Connected';
}

function toggleCallDeafen() {
  callState.deafened = !callState.deafened;
  const btn = document.getElementById('callDeafenBtn');
  if (btn) {
    btn.className = `call-ctrl-btn ${callState.deafened ? 'muted' : ''}`;
    btn.innerHTML = `${callState.deafened ? '🔇' : '🎧'}<span class="ctrl-tooltip">${callState.deafened ? 'Undeafen' : 'Deafen'}</span>`;
  }
}

function toggleCallVideo() {
  callState.videoOn = !callState.videoOn;
  const btn = document.getElementById('callVideoBtn');
  if (btn) {
    btn.className = `call-ctrl-btn ${callState.videoOn ? 'active' : ''}`;
    btn.innerHTML = `${callState.videoOn ? '📹' : '📷'}<span class="ctrl-tooltip">${callState.videoOn ? 'Turn Off Video' : 'Turn On Video'}</span>`;
  }

  const avatar = document.getElementById('selfCallAvatar');
  if (avatar) {
    if (callState.videoOn) {
      avatar.classList.add('video-on');
      avatar.innerHTML = '<video autoplay muted playsinline></video>';
      tryGetCamera();
    } else {
      avatar.classList.remove('video-on');
      avatar.innerHTML = currentUser.initials;
      if (callState._stream) {
        callState._stream.getTracks().forEach(t => t.stop());
        callState._stream = null;
      }
    }
  }
}

function toggleCallScreenShare() {
  callState.screenShare = !callState.screenShare;
  const btn = document.getElementById('callScreenBtn');
  if (btn) {
    btn.className = `call-ctrl-btn ${callState.screenShare ? 'active' : ''}`;
  }
  showToast(callState.screenShare ? 'Screen sharing started' : 'Screen sharing stopped', 'info');
}

function minimizeCall() {
  callState.minimized = true;
  const overlay = document.getElementById('activeCallOverlay');
  if (overlay) overlay.style.display = 'none';

  showMiniCallBar();
}

function showMiniCallBar() {
  const existing = document.getElementById('miniCallBar');
  if (existing) existing.remove();

  const user = callState.targetUser;
  if (!user) return;

  const elapsed = callState.startTime ? Math.floor((Date.now() - callState.startTime) / 1000) : 0;
  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const secs = (elapsed % 60).toString().padStart(2, '0');

  const bar = document.createElement('div');
  bar.className = 'mini-call-bar';
  bar.id = 'miniCallBar';
  bar.innerHTML = `
    <div class="mini-call-avatar" style="background:${user.color}">${user.initials}</div>
    <div class="mini-call-info">
      <span class="mini-call-name">${user.name}</span>
      <span class="mini-call-timer">${mins}:${secs}</span>
    </div>
    <div class="mini-call-controls">
      <button class="mini-ctrl ${callState.muted ? 'muted' : ''}" onclick="event.stopPropagation();toggleCallMute()">🎤</button>
      <button class="mini-ctrl end" onclick="event.stopPropagation();endCall()">✕</button>
    </div>
  `;
  bar.onclick = () => expandCall();
  document.body.appendChild(bar);
}

function expandCall() {
  callState.minimized = false;
  const miniBar = document.getElementById('miniCallBar');
  if (miniBar) miniBar.remove();

  const overlay = document.getElementById('activeCallOverlay');
  if (overlay) {
    overlay.style.display = 'flex';
  } else {
    showActiveCallUI();
  }
}

function endCall() {
  const duration = callState.startTime ? formatCallDuration(Date.now() - callState.startTime) : '0:00';
  const user = callState.targetUser;

  // Stop timers
  if (callState.timerInterval) clearInterval(callState.timerInterval);
  if (callState.speakingInterval) clearInterval(callState.speakingInterval);

  // Stop camera
  if (callState._stream) {
    callState._stream.getTracks().forEach(t => t.stop());
    callState._stream = null;
  }

  // Remove UI
  const overlay = document.getElementById('activeCallOverlay');
  if (overlay) overlay.remove();
  const miniBar = document.getElementById('miniCallBar');
  if (miniBar) miniBar.remove();
  const callOverlay = document.getElementById('callOverlay');
  if (callOverlay) callOverlay.remove();

  // Update call history with final duration
  if (user) {
    const dmId = typeof activeChannel !== 'undefined' ? activeChannel : 'dm-call';
    if (callHistory[dmId]) {
      const liveEntry = callHistory[dmId].find(e => e._live);
      if (liveEntry) {
        liveEntry.duration = duration;
        delete liveEntry._live;
      }
    }
    showToast(`Call with ${user.name} ended — ${duration}`, 'info');
  }

  // Reset state
  callState.active = false;
  callState.minimized = false;
  callState.type = null;
  callState.targetUser = null;
  callState.startTime = null;
  callState.timerInterval = null;
  callState.muted = false;
  callState.deafened = false;
  callState.videoOn = false;
  callState.screenShare = false;

  // Re-render messages if in DM
  if (activeChannel?.startsWith('dm-')) {
    renderMessages();
    setTimeout(() => renderCallHistoryMessages(activeChannel), 100);
  }
}

function formatCallDuration(ms) {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============ CALL HISTORY ============
function addCallHistoryEntry(dmId, entry) {
  if (!callHistory[dmId]) callHistory[dmId] = [];
  callHistory[dmId].unshift(entry);
}

function renderCallHistoryMessages(channelId) {
  const container = document.getElementById('messagesContainer');
  if (!container) return;

  const history = callHistory[channelId] || [];
  if (history.length === 0) return;

  // Add call history section at the top
  const section = document.createElement('div');
  section.style.cssText = 'padding: 8px 16px;';

  history.forEach(entry => {
    const div = document.createElement('div');
    div.className = `call-history-msg ${entry.status}`;

    const icon = entry.type === 'video' ? '📹' : '📞';
    const statusIcon = entry.status === 'missed' ? '❌' : entry.status === 'declined' ? '🚫' : '✅';
    const directionText = entry.direction === 'incoming' ? 'Incoming' : 'Outgoing';
    const typeText = entry.type === 'video' ? 'Video Call' : 'Voice Call';
    const durationText = entry.duration ? ` — ${entry.duration}` : '';
    const statusText = entry.status === 'missed' ? 'Missed' : entry.status === 'declined' ? 'Declined' : `${directionText}`;

    div.innerHTML = `
      <div class="call-icon">${icon}</div>
      <div class="call-details">
        <div class="call-title">${statusText} ${typeText}${durationText}</div>
        <div class="call-meta">${entry.timestamp}</div>
      </div>
      <button class="call-back-btn" onclick="startCall('${channelId}', '${entry.type}')" title="Call back">📞</button>
    `;
    section.appendChild(div);
  });

  // Insert after the welcome section
  const welcome = document.getElementById('channelWelcome');
  if (welcome && welcome.nextSibling) {
    container.insertBefore(section, welcome.nextSibling);
  } else {
    container.appendChild(section);
  }
}

// ============ SERVER DISCOVERY ============
function openDiscovery() {
  const existing = document.getElementById('discoverOverlay');
  if (existing) { existing.remove(); return; }

  activeDiscoverCategory = 'all';
  discoverSearchQuery = '';

  const overlay = document.createElement('div');
  overlay.className = 'discover-overlay';
  overlay.id = 'discoverOverlay';
  overlay.innerHTML = `
    <div class="discover-sidebar">
      <div class="discover-sidebar-header">
        <h2>Discover</h2>
        <p>Find your community on Nexus</p>
      </div>
      <div id="discoverNavItems"></div>
      <div class="discover-nav-separator"></div>
      <div class="invite-code-section" style="padding:16px 12px;">
        <h3 style="font-size:13px;margin-bottom:6px;">Have an invite?</h3>
        <div class="invite-input-row" style="flex-direction:column;gap:6px;">
          <input type="text" placeholder="Enter invite code" id="inviteCodeInput" style="padding:8px 12px;font-size:13px;">
          <button class="invite-join-btn" onclick="joinByInvite()" style="padding:8px;font-size:13px;width:100%;">Join Server</button>
        </div>
      </div>
    </div>
    <div class="discover-main" id="discoverMain">
      <div class="discover-hero">
        <button class="discover-close-btn" onclick="closeDiscovery()">✕</button>
        <h1>Find your community</h1>
        <p>From gaming to music, education to art — there's a place for you.</p>
        <div class="discover-search-bar">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="Search servers by name, category, or tag..." id="discoverSearchInput" oninput="handleDiscoverSearch(this.value)">
        </div>
      </div>
      <div class="discover-categories" id="discoverCategories"></div>
      <div id="discoverContent"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  renderDiscoverNav();
  renderDiscoverCategories();
  renderDiscoverContent();

  // Focus search
  setTimeout(() => {
    const input = document.getElementById('discoverSearchInput');
    if (input) input.focus();
  }, 300);
}

function closeDiscovery() {
  const overlay = document.getElementById('discoverOverlay');
  if (overlay) overlay.remove();
}

function renderDiscoverNav() {
  const container = document.getElementById('discoverNavItems');
  if (!container) return;

  container.innerHTML = discoveryCategories.map(cat => `
    <div class="discover-nav-item ${cat.id === activeDiscoverCategory ? 'active' : ''}" onclick="selectDiscoverCategory('${cat.id}')">
      <span class="nav-icon">${cat.icon}</span>
      <span>${cat.name}</span>
    </div>
  `).join('');
}

function renderDiscoverCategories() {
  const container = document.getElementById('discoverCategories');
  if (!container) return;

  container.innerHTML = discoveryCategories.map(cat => `
    <button class="discover-cat-tag ${cat.id === activeDiscoverCategory ? 'active' : ''}" onclick="selectDiscoverCategory('${cat.id}')">
      ${cat.icon} ${cat.name}
    </button>
  `).join('');
}

function selectDiscoverCategory(catId) {
  activeDiscoverCategory = catId;
  renderDiscoverNav();
  renderDiscoverCategories();
  renderDiscoverContent();
}

function handleDiscoverSearch(query) {
  discoverSearchQuery = query.toLowerCase().trim();
  renderDiscoverContent();
}

function renderDiscoverContent() {
  const container = document.getElementById('discoverContent');
  if (!container) return;

  let filtered = discoveryServers;

  // Filter by category
  if (activeDiscoverCategory !== 'all') {
    filtered = filtered.filter(s => s.category === activeDiscoverCategory);
  }

  // Filter by search
  if (discoverSearchQuery) {
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(discoverSearchQuery) ||
      s.desc.toLowerCase().includes(discoverSearchQuery) ||
      s.tags.some(t => t.toLowerCase().includes(discoverSearchQuery)) ||
      s.category.toLowerCase().includes(discoverSearchQuery)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="discover-no-results">
        <div class="no-results-icon">🔍</div>
        <h3>No servers found</h3>
        <p>Try a different search term or browse categories</p>
      </div>
    `;
    return;
  }

  let html = '';

  // Featured section (only on "all" with no search)
  if (activeDiscoverCategory === 'all' && !discoverSearchQuery) {
    const featured = filtered.filter(s => s.featured);
    if (featured.length > 0) {
      html += `
        <div class="discover-section">
          <div class="discover-section-title">⭐ Featured Servers</div>
          <div class="discover-featured">
            ${featured.map(s => renderFeaturedCard(s)).join('')}
          </div>
        </div>
      `;
    }
  }

  // All servers grid
  const sectionTitle = discoverSearchQuery
    ? `Search results for "${discoverSearchQuery}"`
    : activeDiscoverCategory === 'all'
      ? 'Popular Servers'
      : discoveryCategories.find(c => c.id === activeDiscoverCategory)?.name || 'Servers';

  html += `
    <div class="discover-section">
      <div class="discover-section-title">${sectionTitle} — ${filtered.length} servers</div>
      <div class="discover-grid">
        ${filtered.map(s => renderServerCard(s)).join('')}
      </div>
    </div>
  `;

  // Join by invite section
  if (!discoverSearchQuery) {
    html += `
      <div class="invite-code-section">
        <h3>🔗 Join with an Invite Link</h3>
        <p>Enter an invite code or link to join a specific server</p>
        <div class="invite-input-row">
          <input type="text" placeholder="https://nexus.chat/invite/abc123 or abc123" id="inviteCodeInput2">
          <button class="invite-join-btn" onclick="joinByInvite2()">Join Server</button>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

function renderFeaturedCard(server) {
  return `
    <div class="featured-card" onclick="previewServer('${server.id}')">
      <div class="featured-card-bg">
        <img src="${server.banner}" alt="${server.name}" onerror="this.style.display='none'">
        <div class="featured-gradient"></div>
      </div>
      <div class="featured-card-content">
        <div class="featured-card-icon" style="background:${server.iconBg}">${server.icon}</div>
        <h3>${server.name} ${server.verified ? '✅' : ''}</h3>
        <p>${server.desc}</p>
        <div class="featured-card-stats">
          <div class="discover-card-stat">
            <span class="stat-dot online"></span>
            ${formatNumber(server.online)} Online
          </div>
          <div class="discover-card-stat">
            <span class="stat-dot members"></span>
            ${formatNumber(server.members)} Members
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderServerCard(server) {
  return `
    <div class="discover-server-card" onclick="previewServer('${server.id}')">
      <div class="discover-card-banner" style="position:relative;">
        <img src="${server.banner}" alt="${server.name}" onerror="this.parentElement.style.background='${server.iconBg}'">
        <div class="banner-gradient"></div>
        <div class="discover-card-icon" style="background:${server.iconBg}">${server.icon}</div>
      </div>
      <div class="discover-card-body">
        <div class="discover-card-name">
          ${server.name}
          ${server.verified ? '<span class="verified-badge">✅</span>' : ''}
        </div>
        <div class="discover-card-desc">${server.desc}</div>
        <div class="discover-card-tags">
          ${server.tags.map(t => `<span class="discover-card-tag">${t}</span>`).join('')}
        </div>
        <div class="discover-card-footer">
          <div class="discover-card-stat">
            <span class="stat-dot online"></span>
            ${formatNumber(server.online)} Online
          </div>
          <div class="discover-card-stat">
            <span class="stat-dot members"></span>
            ${formatNumber(server.members)} Members
          </div>
        </div>
      </div>
    </div>
  `;
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// ============ SERVER PREVIEW ============
function previewServer(serverId) {
  const server = discoveryServers.find(s => s.id === serverId);
  if (!server) return;

  // Remove existing preview
  const existing = document.getElementById('serverPreviewOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'server-preview-overlay';
  overlay.id = 'serverPreviewOverlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  overlay.innerHTML = `
    <div class="server-preview-card">
      <div class="server-preview-banner" style="position:relative;">
        <img src="${server.banner}" alt="${server.name}" onerror="this.parentElement.style.background='${server.iconBg}'">
        <div class="preview-gradient"></div>
        <div class="server-preview-icon" style="background:${server.iconBg}">${server.icon}</div>
      </div>
      <div class="server-preview-body">
        <div class="server-preview-name">
          ${server.name}
          ${server.verified ? '✅' : ''}
        </div>
        <div class="server-preview-desc">${server.desc}</div>
        <div class="server-preview-stats">
          <div class="server-preview-stat">
            <span class="stat-dot online" style="width:8px;height:8px;border-radius:50%;background:#22c55e;"></span>
            ${formatNumber(server.online)} Online
          </div>
          <div class="server-preview-stat">
            <span class="stat-dot members" style="width:8px;height:8px;border-radius:50%;background:#94a3b8;"></span>
            ${formatNumber(server.members)} Members
          </div>
        </div>
        <div class="server-preview-tags">
          ${server.tags.map(t => `<span class="server-preview-tag">${t}</span>`).join('')}
        </div>
        <div class="server-preview-channels">
          <h4>Channels Preview</h4>
          ${server.channels.map(ch => `
            <div class="preview-channel-item">
              <span class="ch-icon">${ch.startsWith('🔊') ? '🔊' : '#'}</span>
              <span>${ch.replace(/^[#🔊]\s*/, '')}</span>
            </div>
          `).join('')}
        </div>
        <div class="server-preview-actions">
          <button class="preview-join-btn" onclick="joinDiscoveredServer('${server.id}')">Join Server</button>
          <button class="preview-cancel-btn" onclick="document.getElementById('serverPreviewOverlay').remove()">Back</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

// ============ JOIN SERVER ============
function joinDiscoveredServer(serverId) {
  const server = discoveryServers.find(s => s.id === serverId);
  if (!server) return;

  // Check if already joined
  if (servers[serverId]) {
    showToast(`You're already in ${server.name}!`, 'warning');
    closeServerPreview();
    closeDiscovery();
    switchServer(serverId);
    return;
  }

  // Create the server in our data
  const channelData = {};
  const textChannels = server.channels.filter(c => !c.startsWith('🔊'));
  const voiceChannels = server.channels.filter(c => c.startsWith('🔊'));

  channelData['General'] = textChannels.map((ch, i) => ({
    id: `${serverId}-ch-${i}`,
    name: ch.replace(/^#\s*/, ''),
    type: 'text',
    icon: '#',
    topic: `Welcome to ${ch.replace(/^#\s*/, '')}!`
  }));

  if (voiceChannels.length > 0) {
    channelData['Voice Channels'] = voiceChannels.map((ch, i) => ({
      id: `${serverId}-vc-${i}`,
      name: ch.replace(/^🔊\s*/, ''),
      type: 'voice',
      icon: '🔊',
      voiceUsers: []
    }));
  }

  servers[serverId] = {
    name: server.name,
    channels: channelData
  };

  // Welcome messages come from backend when joining a server

  // Add server icon to nav
  const nav = document.getElementById('serverNav');
  if (nav) {
    const separator = nav.querySelector('.discover-btn')?.previousElementSibling;
    const icon = document.createElement('div');
    icon.className = 'server-icon server-item';
    icon.dataset.server = serverId;
    icon.dataset.tooltip = server.name;
    icon.style.background = server.iconBg;
    icon.textContent = server.icon;
    icon.onclick = () => switchServer(serverId);
    if (separator) {
      nav.insertBefore(icon, separator);
    } else {
      nav.appendChild(icon);
    }
  }

  // Close overlays and switch
  closeServerPreview();
  closeDiscovery();
  switchServer(serverId);

  showToast(`🎉 Joined ${server.name}!`, 'success');
}

function closeServerPreview() {
  const el = document.getElementById('serverPreviewOverlay');
  if (el) el.remove();
}

function joinByInvite() {
  const input = document.getElementById('inviteCodeInput');
  if (!input) return;
  processInviteCode(input.value);
}

function joinByInvite2() {
  const input = document.getElementById('inviteCodeInput2');
  if (!input) return;
  processInviteCode(input.value);
}

function processInviteCode(code) {
  code = code.trim();
  if (!code) {
    showToast('Please enter an invite code', 'error');
    return;
  }

  // Extract code from URL if needed
  code = code.replace(/^https?:\/\/nexus\.chat\/invite\//, '').replace(/\s/g, '');

  // Simulate finding a server by invite code
  const randomServer = discoveryServers[Math.floor(Math.random() * discoveryServers.length)];
  if (randomServer) {
    showToast(`Invite code accepted! Joining ${randomServer.name}...`, 'success');
    setTimeout(() => joinDiscoveredServer(randomServer.id), 500);
  }
}

// ============ KEYBOARD SHORTCUTS ============
document.addEventListener('keydown', (e) => {
  // Escape to close discovery or call
  if (e.key === 'Escape') {
    const preview = document.getElementById('serverPreviewOverlay');
    if (preview) { preview.remove(); return; }

    const discover = document.getElementById('discoverOverlay');
    if (discover) { discover.remove(); return; }

    const callOverlay = document.getElementById('callOverlay');
    if (callOverlay && !callState.active) { cancelCall(); return; }
  }
});