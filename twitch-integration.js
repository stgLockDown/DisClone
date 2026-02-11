// ============================================
// NEXUS CHAT - Twitch Integration Module
// Connect, watch, and manage Twitch streams
// ============================================

(function(global) {
  'use strict';

  // ============ TWITCH AUTH & CONFIG ============

  const TwitchConfig = {
    clientId: 'nexus-twitch-integration',
    redirectUri: 'https://nexuschat.app/auth/twitch/callback',
    scopes: ['user:read:email', 'channel:read:subscriptions', 'chat:read', 'chat:edit'],
    apiBase: 'https://api.twitch.tv/helix',
  };

  // ============ MOCK TWITCH DATA ============
  // In production these would come from the Twitch API

  const mockStreamers = [
    {
      id: 'tw-1',
      username: 'NexusGamer',
      displayName: 'NexusGamer',
      avatar: null,
      color: '#9146FF',
      isLive: true,
      title: '🔥 Ranked Grind to Immortal! | Day 45 | !socials',
      game: 'VALORANT',
      viewers: 12453,
      startedAt: new Date(Date.now() - 3 * 3600000),
      tags: ['English', 'FPS', 'Competitive'],
      thumbnailColor: '#1a0533',
      followers: 284000,
      isPartner: true
    },
    {
      id: 'tw-2',
      username: 'PixelArtist',
      displayName: 'PixelArtist',
      avatar: null,
      color: '#FF6B9D',
      isLive: true,
      title: 'Creating a fantasy world map 🗺️ | Chill vibes | !discord',
      game: 'Art',
      viewers: 3241,
      startedAt: new Date(Date.now() - 5.5 * 3600000),
      tags: ['English', 'Creative', 'Art'],
      thumbnailColor: '#330d1a',
      followers: 156000,
      isPartner: true
    },
    {
      id: 'tw-3',
      username: 'CodeWithSara',
      displayName: 'CodeWithSara',
      avatar: null,
      color: '#00E5FF',
      isLive: true,
      title: 'Building a chat app from scratch! TypeScript + WebSockets 💻',
      game: 'Software and Game Development',
      viewers: 1876,
      startedAt: new Date(Date.now() - 2 * 3600000),
      tags: ['English', 'Programming', 'Educational'],
      thumbnailColor: '#001a20',
      followers: 89000,
      isPartner: false
    },
    {
      id: 'tw-4',
      username: 'SpeedyBoi',
      displayName: 'SpeedyBoi',
      avatar: null,
      color: '#FFD700',
      isLive: true,
      title: 'WR Attempts!! Celeste Any% | PB 26:42',
      game: 'Celeste',
      viewers: 8920,
      startedAt: new Date(Date.now() - 1.5 * 3600000),
      tags: ['English', 'Speedrun', 'Gaming'],
      thumbnailColor: '#332b00',
      followers: 412000,
      isPartner: true
    },
    {
      id: 'tw-5',
      username: 'ChillBeats',
      displayName: 'ChillBeats',
      avatar: null,
      color: '#06d6a0',
      isLive: false,
      title: 'Late night lo-fi production session 🎵',
      game: 'Music',
      viewers: 0,
      startedAt: null,
      tags: ['English', 'Music', 'Creative'],
      thumbnailColor: '#001a13',
      followers: 67000,
      isPartner: false
    },
    {
      id: 'tw-6',
      username: 'ProLeague_Official',
      displayName: 'ProLeague Official',
      avatar: null,
      color: '#ef4444',
      isLive: true,
      title: '🏆 GRAND FINALS | Team Alpha vs Team Omega | $50K Prize Pool',
      game: 'League of Legends',
      viewers: 45230,
      startedAt: new Date(Date.now() - 4 * 3600000),
      tags: ['English', 'Esports', 'Tournament'],
      thumbnailColor: '#330000',
      followers: 1200000,
      isPartner: true
    },
    {
      id: 'tw-7',
      username: 'CozyGamer',
      displayName: 'CozyGamer',
      avatar: null,
      color: '#f59e0b',
      isLive: false,
      title: 'Stardew Valley chill farm stream 🌾',
      game: 'Stardew Valley',
      viewers: 0,
      startedAt: null,
      tags: ['English', 'Cozy', 'Casual'],
      thumbnailColor: '#332200',
      followers: 34000,
      isPartner: false
    },
    {
      id: 'tw-8',
      username: 'RetroKing',
      displayName: 'RetroKing',
      avatar: null,
      color: '#a78bfa',
      isLive: true,
      title: 'N64 Marathon! All games start to finish 👾',
      game: 'Retro',
      viewers: 2105,
      startedAt: new Date(Date.now() - 8 * 3600000),
      tags: ['English', 'Retro', 'Marathon'],
      thumbnailColor: '#1a0d33',
      followers: 178000,
      isPartner: true
    }
  ];

  const mockTwitchChat = [
    { user: 'xShadowHunter', color: '#FF4500', message: 'LET\'S GOOO 🔥🔥🔥', badges: ['sub'] },
    { user: 'PixelQueen99', color: '#FF69B4', message: 'That play was insane!', badges: ['vip'] },
    { user: 'NightOwl_TV', color: '#9146FF', message: 'First time here, love the vibes!', badges: [] },
    { user: 'GameMaster3000', color: '#00FF7F', message: 'Can we get some Ws in chat', badges: ['sub', 'mod'] },
    { user: 'TurboFan', color: '#FFD700', message: 'POGGERS', badges: ['sub'] },
    { user: 'ChillVibes420', color: '#1E90FF', message: 'This is so relaxing to watch', badges: [] },
    { user: 'ProSniper_X', color: '#FF6347', message: 'HOW DID YOU HIT THAT SHOT', badges: ['sub'] },
    { user: 'MoonlightGamer', color: '#DDA0DD', message: 'Just subscribed! Love the content ❤️', badges: ['sub'] },
    { user: 'StreamBot', color: '#06d6a0', message: '🎉 MoonlightGamer just subscribed!', badges: ['mod'] },
    { user: 'CasualAndy', color: '#87CEEB', message: 'What rank are you?', badges: [] },
    { user: 'HypeTrainConductor', color: '#FF8C00', message: 'HYPE TRAIN LEVEL 3!! 🚂', badges: ['sub', 'vip'] },
    { user: 'QuietWatcher', color: '#98FB98', message: 'Been watching for 2 hours, can\'t stop', badges: [] },
    { user: 'ClipChamp', color: '#FF1493', message: 'CLIP THAT! CLIP THAT!', badges: ['sub'] },
    { user: 'NewFollower42', color: '#ADD8E6', message: 'Just followed! Great stream!', badges: [] },
    { user: 'EmoteSpammer', color: '#FFD700', message: '🎮🎮🎮🎮🎮', badges: ['sub'] }
  ];

  // Alert types
  const alertTypes = {
    FOLLOW: { icon: '💜', label: 'New Follower', color: '#9146FF' },
    SUBSCRIBE: { icon: '⭐', label: 'New Subscriber', color: '#FFD700' },
    GIFT_SUB: { icon: '🎁', label: 'Gift Sub', color: '#FF69B4' },
    BITS: { icon: '💎', label: 'Bits', color: '#9146FF' },
    RAID: { icon: '🚀', label: 'Raid', color: '#ef4444' },
    HOST: { icon: '📺', label: 'Host', color: '#0ea5e9' },
    HYPE_TRAIN: { icon: '🚂', label: 'Hype Train', color: '#FF8C00' }
  };

  // ============ TWITCH INTEGRATION CLASS ============

  class TwitchIntegration {
    constructor() {
      this.connected = false;
      this.user = null;
      this.following = [];
      this.alerts = [];
      this.chatMessages = [];
      this.activeStream = null;
      this.alertCallbacks = [];
      this.chatCallbacks = [];
      this._chatInterval = null;
      this._alertInterval = null;
      this._viewerInterval = null;
    }

    // === Authentication ===

    async connect(username) {
      // Simulate OAuth flow
      this.connected = true;
      this.user = {
        id: 'tw-self',
        username: username || 'NexusUser',
        displayName: username || 'NexusUser',
        avatar: null,
        color: '#0ea5e9',
        isAffiliate: true,
        isPartner: false,
        followers: 1247,
        following: mockStreamers.length
      };
      this.following = [...mockStreamers];

      console.log('[Twitch] Connected as', this.user.displayName);
      return this.user;
    }

    disconnect() {
      this.connected = false;
      this.user = null;
      this.following = [];
      this.stopChatSync();
      this.stopAlerts();
      console.log('[Twitch] Disconnected');
    }

    isConnected() {
      return this.connected;
    }

    // === Stream Discovery ===

    getLiveStreams() {
      return this.following.filter(s => s.isLive).sort((a, b) => b.viewers - a.viewers);
    }

    getOfflineStreams() {
      return this.following.filter(s => !s.isLive);
    }

    getAllFollowing() {
      return [...this.following];
    }

    getStream(streamId) {
      return this.following.find(s => s.id === streamId);
    }

    searchStreams(query) {
      const q = query.toLowerCase();
      return this.following.filter(s =>
        s.displayName.toLowerCase().includes(q) ||
        s.game.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q)
      );
    }

    // === Stream Watching ===

    watchStream(streamId) {
      const stream = this.getStream(streamId);
      if (!stream) return null;
      this.activeStream = stream;
      this.startChatSync(streamId);
      return stream;
    }

    stopWatching() {
      this.activeStream = null;
      this.stopChatSync();
    }

    // === Chat Sync ===

    startChatSync(streamId) {
      this.stopChatSync();
      this.chatMessages = [];

      // Simulate incoming Twitch chat messages
      let chatIdx = 0;
      this._chatInterval = setInterval(() => {
        const msg = { ...mockTwitchChat[chatIdx % mockTwitchChat.length] };
        msg.timestamp = Date.now();
        msg.id = 'tc-' + Date.now() + '-' + chatIdx;
        this.chatMessages.push(msg);

        // Keep buffer manageable
        if (this.chatMessages.length > 200) {
          this.chatMessages = this.chatMessages.slice(-100);
        }

        this.chatCallbacks.forEach(cb => cb(msg));
        chatIdx++;
      }, 2000 + Math.random() * 3000);
    }

    stopChatSync() {
      if (this._chatInterval) {
        clearInterval(this._chatInterval);
        this._chatInterval = null;
      }
    }

    onChatMessage(callback) {
      this.chatCallbacks.push(callback);
      return () => {
        this.chatCallbacks = this.chatCallbacks.filter(cb => cb !== callback);
      };
    }

    sendChatMessage(message) {
      const msg = {
        id: 'tc-self-' + Date.now(),
        user: this.user ? this.user.displayName : 'NexusUser',
        color: this.user ? this.user.color : '#0ea5e9',
        message: message,
        badges: ['nexus'],
        timestamp: Date.now()
      };
      this.chatMessages.push(msg);
      this.chatCallbacks.forEach(cb => cb(msg));
      return msg;
    }

    // === Alerts ===

    startAlerts() {
      this.stopAlerts();

      const names = [
        'CoolGamer42', 'StreamFan99', 'NightHawk', 'PixelDust',
        'GameWizard', 'StarChaser', 'NeonRider', 'CloudSurfer',
        'ThunderBolt', 'MysticWolf', 'SilverFox', 'GoldenEagle'
      ];

      this._alertInterval = setInterval(() => {
        const types = Object.keys(alertTypes);
        const type = types[Math.floor(Math.random() * types.length)];
        const name = names[Math.floor(Math.random() * names.length)];
        const alertInfo = alertTypes[type];

        const alert = {
          id: 'alert-' + Date.now(),
          type,
          ...alertInfo,
          username: name,
          timestamp: Date.now(),
          amount: type === 'BITS' ? (Math.floor(Math.random() * 50) + 1) * 100 : null,
          months: type === 'SUBSCRIBE' ? Math.floor(Math.random() * 24) + 1 : null,
          viewers: type === 'RAID' ? Math.floor(Math.random() * 500) + 50 : null,
          giftCount: type === 'GIFT_SUB' ? Math.floor(Math.random() * 10) + 1 : null
        };

        this.alerts.push(alert);
        if (this.alerts.length > 50) this.alerts = this.alerts.slice(-50);

        this.alertCallbacks.forEach(cb => cb(alert));
      }, 8000 + Math.random() * 15000);
    }

    stopAlerts() {
      if (this._alertInterval) {
        clearInterval(this._alertInterval);
        this._alertInterval = null;
      }
    }

    onAlert(callback) {
      this.alertCallbacks.push(callback);
      return () => {
        this.alertCallbacks = this.alertCallbacks.filter(cb => cb !== callback);
      };
    }

    getRecentAlerts(count = 20) {
      return this.alerts.slice(-count).reverse();
    }

    // === Viewer Simulation ===

    startViewerSimulation() {
      this._viewerInterval = setInterval(() => {
        this.following.forEach(stream => {
          if (stream.isLive) {
            const change = Math.floor(Math.random() * 200) - 80;
            stream.viewers = Math.max(100, stream.viewers + change);
          }
        });
      }, 10000);
    }

    stopViewerSimulation() {
      if (this._viewerInterval) {
        clearInterval(this._viewerInterval);
        this._viewerInterval = null;
      }
    }

    // === Utility ===

    formatViewerCount(count) {
      if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
      if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
      return count.toString();
    }

    formatUptime(startedAt) {
      if (!startedAt) return '';
      const diff = Date.now() - startedAt.getTime();
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    }

    formatFollowerCount(count) {
      if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M followers';
      if (count >= 1000) return (count / 1000).toFixed(0) + 'K followers';
      return count + ' followers';
    }
  }

  // Create singleton
  global.NexusTwitch = new TwitchIntegration();

})(typeof window !== 'undefined' ? window : global);