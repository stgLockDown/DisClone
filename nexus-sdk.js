// ============================================
// NEXUS CHAT - Developer SDK
// Plugin & Extension Framework
// NOT open source — proprietary SDK for integrations
// ============================================

(function(global) {
  'use strict';

  const SDK_VERSION = '1.0.0';

  // ============ EVENT SYSTEM ============

  class NexusEventEmitter {
    constructor() {
      this._listeners = {};
    }

    on(event, callback, priority = 0) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push({ callback, priority });
      this._listeners[event].sort((a, b) => b.priority - a.priority);
      return () => this.off(event, callback);
    }

    off(event, callback) {
      if (!this._listeners[event]) return;
      this._listeners[event] = this._listeners[event].filter(l => l.callback !== callback);
    }

    emit(event, ...args) {
      if (!this._listeners[event]) return;
      for (const listener of this._listeners[event]) {
        try {
          listener.callback(...args);
        } catch (err) {
          console.error(`[NexusSDK] Error in ${event} listener:`, err);
        }
      }
    }

    once(event, callback) {
      const wrapper = (...args) => {
        this.off(event, wrapper);
        callback(...args);
      };
      return this.on(event, wrapper);
    }
  }

  // ============ PLUGIN REGISTRY ============

  class PluginRegistry {
    constructor() {
      this._plugins = new Map();
      this._hooks = new Map();
    }

    register(manifest) {
      const required = ['id', 'name', 'version', 'author'];
      for (const field of required) {
        if (!manifest[field]) {
          throw new Error(`[NexusSDK] Plugin missing required field: ${field}`);
        }
      }

      if (this._plugins.has(manifest.id)) {
        throw new Error(`[NexusSDK] Plugin "${manifest.id}" is already registered`);
      }

      const plugin = {
        ...manifest,
        enabled: true,
        registeredAt: Date.now(),
        commands: [],
        widgets: [],
        hooks: [],
        permissions: manifest.permissions || []
      };

      this._plugins.set(manifest.id, plugin);
      console.log(`[NexusSDK] Plugin registered: ${manifest.name} v${manifest.version}`);
      return plugin;
    }

    unregister(pluginId) {
      const plugin = this._plugins.get(pluginId);
      if (!plugin) return false;

      // Cleanup commands
      plugin.commands.forEach(cmd => {
        NexusSDK.commands.unregister(cmd);
      });

      // Cleanup widgets
      plugin.widgets.forEach(w => {
        NexusSDK.ui.removeWidget(w);
      });

      this._plugins.delete(pluginId);
      console.log(`[NexusSDK] Plugin unregistered: ${pluginId}`);
      return true;
    }

    get(pluginId) {
      return this._plugins.get(pluginId);
    }

    getAll() {
      return Array.from(this._plugins.values());
    }

    enable(pluginId) {
      const p = this._plugins.get(pluginId);
      if (p) p.enabled = true;
    }

    disable(pluginId) {
      const p = this._plugins.get(pluginId);
      if (p) p.enabled = false;
    }
  }

  // ============ COMMAND SYSTEM ============

  class CommandSystem {
    constructor() {
      this._commands = new Map();
    }

    register(config) {
      if (!config.name || !config.execute) {
        throw new Error('[NexusSDK] Command requires name and execute function');
      }

      const command = {
        name: config.name.toLowerCase(),
        description: config.description || '',
        usage: config.usage || `/${config.name}`,
        args: config.args || [],
        permissions: config.permissions || [],
        pluginId: config.pluginId || 'core',
        cooldown: config.cooldown || 0,
        lastUsed: 0,
        execute: config.execute,
        autocomplete: config.autocomplete || null
      };

      this._commands.set(command.name, command);
      return command.name;
    }

    unregister(commandName) {
      return this._commands.delete(commandName.toLowerCase());
    }

    async execute(name, context) {
      const cmd = this._commands.get(name.toLowerCase());
      if (!cmd) {
        return { success: false, error: `Unknown command: /${name}` };
      }

      // Cooldown check
      const now = Date.now();
      if (cmd.cooldown > 0 && (now - cmd.lastUsed) < cmd.cooldown) {
        const remaining = Math.ceil((cmd.cooldown - (now - cmd.lastUsed)) / 1000);
        return { success: false, error: `Command on cooldown. Try again in ${remaining}s` };
      }

      try {
        cmd.lastUsed = now;
        const result = await cmd.execute(context);
        return { success: true, result };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    getAll() {
      return Array.from(this._commands.values());
    }

    get(name) {
      return this._commands.get(name.toLowerCase());
    }

    search(query) {
      const q = query.toLowerCase();
      return this.getAll().filter(cmd =>
        cmd.name.includes(q) || cmd.description.toLowerCase().includes(q)
      );
    }
  }

  // ============ WEBHOOK SYSTEM ============

  class WebhookSystem {
    constructor() {
      this._webhooks = new Map();
      this._idCounter = 0;
    }

    create(config) {
      const id = `wh-${++this._idCounter}-${Date.now().toString(36)}`;
      const webhook = {
        id,
        name: config.name || 'Webhook',
        channelId: config.channelId,
        avatar: config.avatar || null,
        token: this._generateToken(),
        createdAt: Date.now(),
        createdBy: config.createdBy || 'system',
        pluginId: config.pluginId || null
      };

      this._webhooks.set(id, webhook);
      return { id: webhook.id, token: webhook.token, url: `/api/webhooks/${id}/${webhook.token}` };
    }

    async send(webhookId, payload) {
      const wh = this._webhooks.get(webhookId);
      if (!wh) throw new Error('Webhook not found');

      const message = {
        id: 'wh-msg-' + Date.now(),
        userId: null,
        webhookName: payload.username || wh.name,
        webhookAvatar: payload.avatar_url || wh.avatar,
        content: payload.content || '',
        embeds: payload.embeds || [],
        channelId: wh.channelId,
        timestamp: new Date(),
        isWebhook: true
      };

      NexusSDK.events.emit('webhook:message', message);
      return message;
    }

    delete(webhookId) {
      return this._webhooks.delete(webhookId);
    }

    getAll() {
      return Array.from(this._webhooks.values());
    }

    _generateToken() {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let token = '';
      for (let i = 0; i < 64; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return token;
    }
  }

  // ============ BOT FRAMEWORK ============

  class BotFramework {
    constructor() {
      this._bots = new Map();
    }

    create(config) {
      if (!config.name || !config.id) {
        throw new Error('[NexusSDK] Bot requires name and id');
      }

      const bot = {
        id: config.id,
        name: config.name,
        avatar: config.avatar || null,
        initials: config.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(),
        color: config.color || '#06d6a0',
        prefix: config.prefix || '!',
        description: config.description || '',
        commands: new Map(),
        onMessage: config.onMessage || null,
        onReaction: config.onReaction || null,
        onMemberJoin: config.onMemberJoin || null,
        onMemberLeave: config.onMemberLeave || null,
        enabled: true,
        pluginId: config.pluginId || null
      };

      this._bots.set(bot.id, bot);

      // Register bot as a user
      if (typeof users !== 'undefined') {
        users[bot.id] = {
          id: bot.id,
          name: bot.name,
          tag: `${bot.name.toLowerCase().replace(/\s/g, '')}#0001`,
          initials: bot.initials,
          color: bot.color,
          status: 'online',
          roleClass: 'role-bot',
          isBot: true,
          about: bot.description,
          roles: [{ name: 'Bot', color: bot.color }]
        };
      }

      return bot;
    }

    addCommand(botId, config) {
      const bot = this._bots.get(botId);
      if (!bot) throw new Error('Bot not found');

      bot.commands.set(config.name, {
        name: config.name,
        description: config.description || '',
        execute: config.execute
      });
    }

    async processMessage(message) {
      for (const [, bot] of this._bots) {
        if (!bot.enabled) continue;

        // Check prefix commands
        if (message.content.startsWith(bot.prefix)) {
          const args = message.content.slice(bot.prefix.length).trim().split(/\s+/);
          const cmdName = args.shift().toLowerCase();
          const cmd = bot.commands.get(cmdName);

          if (cmd) {
            try {
              const response = await cmd.execute({ message, args, bot });
              if (response) {
                return {
                  id: 'bot-' + Date.now(),
                  userId: bot.id,
                  content: response,
                  timestamp: new Date(),
                  reactions: [],
                  isBot: true
                };
              }
            } catch (err) {
              console.error(`[Bot:${bot.name}] Command error:`, err);
            }
          }
        }

        // General message handler
        if (bot.onMessage) {
          try {
            const response = await bot.onMessage(message);
            if (response) {
              return {
                id: 'bot-' + Date.now(),
                userId: bot.id,
                content: response,
                timestamp: new Date(),
                reactions: [],
                isBot: true
              };
            }
          } catch (err) {
            console.error(`[Bot:${bot.name}] onMessage error:`, err);
          }
        }
      }
      return null;
    }

    get(botId) { return this._bots.get(botId); }
    getAll() { return Array.from(this._bots.values()); }
    enable(botId) { const b = this._bots.get(botId); if (b) b.enabled = true; }
    disable(botId) { const b = this._bots.get(botId); if (b) b.enabled = false; }
  }

  // ============ UI WIDGET SYSTEM ============

  class UIWidgetSystem {
    constructor() {
      this._widgets = new Map();
      this._panels = new Map();
    }

    createWidget(config) {
      const widget = {
        id: config.id || `widget-${Date.now()}`,
        pluginId: config.pluginId,
        type: config.type || 'panel', // panel, button, badge, embed, modal
        position: config.position || 'sidebar', // sidebar, header, message, modal, chat-input
        title: config.title || '',
        icon: config.icon || '🔌',
        render: config.render,
        onClick: config.onClick || null,
        onInit: config.onInit || null,
        visible: config.visible !== false,
        order: config.order || 0
      };

      this._widgets.set(widget.id, widget);
      NexusSDK.events.emit('ui:widget-added', widget);
      return widget.id;
    }

    removeWidget(widgetId) {
      this._widgets.delete(widgetId);
      NexusSDK.events.emit('ui:widget-removed', widgetId);
    }

    getWidgets(position) {
      return Array.from(this._widgets.values())
        .filter(w => !position || w.position === position)
        .sort((a, b) => a.order - b.order);
    }

    createEmbed(config) {
      return {
        type: 'rich',
        color: config.color || '#0ea5e9',
        title: config.title || '',
        description: config.description || '',
        url: config.url || null,
        fields: config.fields || [],
        footer: config.footer || null,
        thumbnail: config.thumbnail || null,
        image: config.image || null,
        author: config.author || null,
        timestamp: config.timestamp || null
      };
    }

    showModal(config) {
      NexusSDK.events.emit('ui:show-modal', {
        title: config.title || 'Plugin',
        content: config.content || '',
        buttons: config.buttons || [{ label: 'Close', style: 'secondary' }],
        onAction: config.onAction || null
      });
    }

    showToast(message, type = 'info') {
      NexusSDK.events.emit('ui:toast', { message, type });
    }
  }

  // ============ STREAMING API ============

  class StreamingAPI {
    constructor() {
      this._streams = new Map();
      this._viewers = new Map();
    }

    async startStream(config) {
      const streamId = `stream-${Date.now()}`;
      const stream = {
        id: streamId,
        userId: config.userId || 'unknown',
        channelId: config.channelId,
        type: config.type || 'screen', // screen, window, camera
        quality: config.quality || 'auto', // auto, 720p, 1080p, source
        frameRate: config.frameRate || 30,
        audio: config.audio !== false,
        status: 'starting',
        startedAt: Date.now(),
        viewers: [],
        mediaStream: null
      };

      this._streams.set(streamId, stream);
      NexusSDK.events.emit('stream:starting', stream);
      return stream;
    }

    stopStream(streamId) {
      const stream = this._streams.get(streamId);
      if (!stream) return false;

      stream.status = 'stopped';
      if (stream.mediaStream) {
        stream.mediaStream.getTracks().forEach(track => track.stop());
      }

      NexusSDK.events.emit('stream:stopped', stream);
      this._streams.delete(streamId);
      return true;
    }

    joinStream(streamId, userId) {
      const stream = this._streams.get(streamId);
      if (!stream) return false;

      if (!stream.viewers.includes(userId)) {
        stream.viewers.push(userId);
      }
      NexusSDK.events.emit('stream:viewer-joined', { streamId, userId });
      return true;
    }

    leaveStream(streamId, userId) {
      const stream = this._streams.get(streamId);
      if (!stream) return false;

      stream.viewers = stream.viewers.filter(id => id !== userId);
      NexusSDK.events.emit('stream:viewer-left', { streamId, userId });
      return true;
    }

    getActiveStreams() {
      return Array.from(this._streams.values()).filter(s => s.status === 'live');
    }

    getStream(streamId) {
      return this._streams.get(streamId);
    }

    setQuality(streamId, quality) {
      const stream = this._streams.get(streamId);
      if (stream) stream.quality = quality;
    }
  }

  // ============ SERVER MANAGEMENT API ============

  class ServerAPI {
    constructor() {}

    create(config) {
      const serverId = `srv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      return {
        id: serverId,
        name: config.name,
        icon: config.icon || null,
        ownerId: config.ownerId || 'unknown',
        channels: config.channels || [
          { name: 'general', type: 'text' },
          { name: 'General Voice', type: 'voice' }
        ],
        roles: config.roles || [
          { name: 'Admin', color: '#f87171', permissions: ['all'] },
          { name: 'Member', color: '#0ea5e9', permissions: ['read', 'write', 'react'] }
        ],
        settings: {
          isPublic: config.isPublic || false,
          verificationLevel: config.verificationLevel || 'none',
          defaultNotifications: config.defaultNotifications || 'mentions',
          allowPlugins: config.allowPlugins !== false,
          maxPlugins: config.maxPlugins || 20,
          ...config.settings
        },
        createdAt: Date.now()
      };
    }

    createChannel(serverId, config) {
      return {
        id: `ch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        serverId,
        name: config.name,
        type: config.type || 'text',
        topic: config.topic || '',
        permissions: config.permissions || {},
        position: config.position || 0,
        parentCategory: config.category || null
      };
    }

    createRole(serverId, config) {
      return {
        id: `role-${Date.now()}`,
        serverId,
        name: config.name,
        color: config.color || '#99aab5',
        permissions: config.permissions || ['read', 'write'],
        position: config.position || 0,
        mentionable: config.mentionable || false,
        hoisted: config.hoisted || false
      };
    }
  }

  // ============ STORAGE API ============

  class StorageAPI {
    constructor() {
      this._stores = new Map();
    }

    getStore(pluginId) {
      if (!this._stores.has(pluginId)) {
        this._stores.set(pluginId, new Map());
      }
      return {
        get: (key) => {
          const store = this._stores.get(pluginId);
          const val = store.get(key);
          return val !== undefined ? JSON.parse(JSON.stringify(val)) : undefined;
        },
        set: (key, value) => {
          this._stores.get(pluginId).set(key, value);
        },
        delete: (key) => {
          this._stores.get(pluginId).delete(key);
        },
        has: (key) => {
          return this._stores.get(pluginId).has(key);
        },
        clear: () => {
          this._stores.get(pluginId).clear();
        },
        keys: () => {
          return Array.from(this._stores.get(pluginId).keys());
        },
        getAll: () => {
          const store = this._stores.get(pluginId);
          const obj = {};
          store.forEach((v, k) => { obj[k] = JSON.parse(JSON.stringify(v)); });
          return obj;
        }
      };
    }
  }

  // ============ PERMISSIONS SYSTEM ============

  const PERMISSIONS = {
    READ_MESSAGES: 'read',
    SEND_MESSAGES: 'write',
    MANAGE_MESSAGES: 'manage_messages',
    MANAGE_CHANNELS: 'manage_channels',
    MANAGE_SERVER: 'manage_server',
    MANAGE_ROLES: 'manage_roles',
    KICK_MEMBERS: 'kick',
    BAN_MEMBERS: 'ban',
    ADD_REACTIONS: 'react',
    ATTACH_FILES: 'attach',
    USE_VOICE: 'voice',
    STREAM: 'stream',
    MANAGE_PLUGINS: 'manage_plugins',
    USE_SLASH_COMMANDS: 'slash_commands',
    ADMINISTRATOR: 'all'
  };

  // ============ MAIN SDK OBJECT ============

  const NexusSDK = {
    version: SDK_VERSION,
    events: new NexusEventEmitter(),
    plugins: new PluginRegistry(),
    commands: new CommandSystem(),
    webhooks: new WebhookSystem(),
    bots: new BotFramework(),
    ui: new UIWidgetSystem(),
    streaming: new StreamingAPI(),
    servers: new ServerAPI(),
    storage: new StorageAPI(),
    permissions: PERMISSIONS,

    // Quick helper to create a full plugin
    createPlugin(manifest, setup) {
      const plugin = this.plugins.register(manifest);
      const ctx = {
        plugin,
        sdk: NexusSDK,
        store: this.storage.getStore(manifest.id),
        registerCommand: (config) => {
          config.pluginId = manifest.id;
          const name = this.commands.register(config);
          plugin.commands.push(name);
          return name;
        },
        createBot: (config) => {
          config.pluginId = manifest.id;
          return this.bots.create(config);
        },
        createWebhook: (config) => {
          config.pluginId = manifest.id;
          return this.webhooks.create(config);
        },
        addWidget: (config) => {
          config.pluginId = manifest.id;
          const id = this.ui.createWidget(config);
          plugin.widgets.push(id);
          return id;
        },
        on: (event, callback) => {
          const unsub = this.events.on(event, callback);
          plugin.hooks.push({ event, unsub });
          return unsub;
        },
        showToast: (msg, type) => this.ui.showToast(msg, type),
        showModal: (config) => this.ui.showModal(config),
        createEmbed: (config) => this.ui.createEmbed(config)
      };

      if (typeof setup === 'function') {
        setup(ctx);
      }

      return plugin;
    },

    // Get SDK info
    getInfo() {
      return {
        version: SDK_VERSION,
        plugins: this.plugins.getAll().length,
        commands: this.commands.getAll().length,
        bots: this.bots.getAll().length,
        webhooks: this.webhooks.getAll().length
      };
    }
  };

  // Expose globally
  global.NexusSDK = NexusSDK;

})(typeof window !== 'undefined' ? window : global);