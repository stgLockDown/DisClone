// ============================================
// NEXUS CHAT - Watch Party System
// Synchronized viewing with friends
// ============================================

(function(global) {
  'use strict';

  class WatchParty {
    constructor() {
      this.parties = new Map();
      this._idCounter = 0;
    }

    create(config) {
      const id = 'wp-' + (++this._idCounter) + '-' + Date.now().toString(36);
      const party = {
        id,
        hostId: config.hostId || 'unknown',
        hostName: config.hostName || 'NexusUser',
        channelId: config.channelId || null,
        title: config.title || 'Watch Party',
        description: config.description || '',
        source: config.source || null,       // { type: 'twitch'|'youtube'|'screen', id: '...' }
        status: 'waiting',                    // waiting, playing, paused, ended
        viewers: [config.hostId || 'unknown'],
        maxViewers: config.maxViewers || 50,
        isPrivate: config.isPrivate || false,
        chat: [],
        reactions: [],
        createdAt: Date.now(),
        startedAt: null,
        currentTime: 0,
        volume: 100
      };

      this.parties.set(id, party);
      return party;
    }

    start(partyId) {
      const p = this.parties.get(partyId);
      if (!p) return null;
      p.status = 'playing';
      p.startedAt = Date.now();
      return p;
    }

    pause(partyId) {
      const p = this.parties.get(partyId);
      if (p) p.status = 'paused';
      return p;
    }

    resume(partyId) {
      const p = this.parties.get(partyId);
      if (p) p.status = 'playing';
      return p;
    }

    end(partyId) {
      const p = this.parties.get(partyId);
      if (p) p.status = 'ended';
      return p;
    }

    join(partyId, userId) {
      const p = this.parties.get(partyId);
      if (!p) return false;
      if (p.viewers.length >= p.maxViewers) return false;
      if (!p.viewers.includes(userId)) {
        p.viewers.push(userId);
      }
      return true;
    }

    leave(partyId, userId) {
      const p = this.parties.get(partyId);
      if (!p) return false;
      p.viewers = p.viewers.filter(id => id !== userId);
      if (p.viewers.length === 0) p.status = 'ended';
      return true;
    }

    addReaction(partyId, emoji, userId) {
      const p = this.parties.get(partyId);
      if (!p) return;
      p.reactions.push({ emoji, userId, timestamp: Date.now() });
      // Keep last 50
      if (p.reactions.length > 50) p.reactions = p.reactions.slice(-50);
    }

    sendChat(partyId, userId, userName, message) {
      const p = this.parties.get(partyId);
      if (!p) return null;
      const msg = {
        id: 'wpc-' + Date.now(),
        userId, userName, message,
        timestamp: Date.now()
      };
      p.chat.push(msg);
      if (p.chat.length > 200) p.chat = p.chat.slice(-200);
      return msg;
    }

    get(partyId) { return this.parties.get(partyId); }
    getActive() { return Array.from(this.parties.values()).filter(p => p.status !== 'ended'); }
    getAll() { return Array.from(this.parties.values()); }
    delete(partyId) { return this.parties.delete(partyId); }
  }

  global.NexusWatchParty = new WatchParty();

})(typeof window !== 'undefined' ? window : global);