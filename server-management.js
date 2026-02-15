// ============================================
// NEXUS CHAT - Server Management & Permissions
// Hierarchy, roles, channels, folders, privacy
// ============================================

(function(global) {
  'use strict';

  // ============ PERMISSION FLAGS ============
  const PERMS = {
    VIEW_CHANNEL:       1 << 0,
    SEND_MESSAGES:      1 << 1,
    READ_HISTORY:       1 << 2,
    ADD_REACTIONS:      1 << 3,
    ATTACH_FILES:       1 << 4,
    EMBED_LINKS:        1 << 5,
    MENTION_EVERYONE:   1 << 6,
    MANAGE_MESSAGES:    1 << 7,
    CONNECT_VOICE:      1 << 8,
    SPEAK:              1 << 9,
    STREAM:             1 << 10,
    MUTE_MEMBERS:       1 << 11,
    DEAFEN_MEMBERS:     1 << 12,
    MOVE_MEMBERS:       1 << 13,
    CREATE_INVITE:      1 << 14,
    MANAGE_CHANNELS:    1 << 15,
    MANAGE_ROLES:       1 << 16,
    MANAGE_SERVER:      1 << 17,
    KICK_MEMBERS:       1 << 18,
    BAN_MEMBERS:        1 << 19,
    ADMINISTRATOR:      1 << 20,
    MANAGE_WEBHOOKS:    1 << 21,
    MANAGE_PLUGINS:     1 << 22,
    VIEW_AUDIT_LOG:     1 << 23
  };

  // Permission presets
  const PRESET_EVERYONE = PERMS.VIEW_CHANNEL | PERMS.SEND_MESSAGES | PERMS.READ_HISTORY |
    PERMS.ADD_REACTIONS | PERMS.ATTACH_FILES | PERMS.EMBED_LINKS | PERMS.CONNECT_VOICE |
    PERMS.SPEAK | PERMS.CREATE_INVITE;

  const PRESET_MOD = PRESET_EVERYONE | PERMS.MANAGE_MESSAGES | PERMS.MUTE_MEMBERS |
    PERMS.DEAFEN_MEMBERS | PERMS.MOVE_MEMBERS | PERMS.KICK_MEMBERS | PERMS.MENTION_EVERYONE;

  const PRESET_ADMIN = 0xFFFFFFFF; // All permissions

  // ============ ROLE CLASS ============
  class Role {
    constructor(config) {
      this.id = config.id || 'role-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
      this.name = config.name || 'New Role';
      this.color = config.color || '#99aab5';
      this.permissions = config.permissions !== undefined ? config.permissions : PRESET_EVERYONE;
      this.position = config.position || 0;
      this.hoisted = config.hoisted || false;    // Show separately in member list
      this.mentionable = config.mentionable || false;
      this.isDefault = config.isDefault || false; // @everyone role
      this.icon = config.icon || null;
    }

    hasPermission(perm) {
      if (this.permissions & PERMS.ADMINISTRATOR) return true;
      return (this.permissions & perm) !== 0;
    }

    addPermission(perm) { this.permissions |= perm; }
    removePermission(perm) { this.permissions &= ~perm; }
    togglePermission(perm) { this.permissions ^= perm; }
  }

  // ============ CHANNEL OVERRIDE ============
  class PermissionOverride {
    constructor(targetId, targetType, allow, deny) {
      this.targetId = targetId;       // role ID or user ID
      this.targetType = targetType;   // 'role' or 'member'
      this.allow = allow || 0;
      this.deny = deny || 0;
    }
  }

  // ============ MANAGED CHANNEL ============
  class ManagedChannel {
    constructor(config) {
      this.id = config.id || 'ch-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
      this.name = config.name || 'new-channel';
      this.type = config.type || 'text';          // text, voice, announcement, stage, forum
      this.topic = config.topic || '';
      this.icon = config.icon || (config.type === 'voice' ? '🔊' : '#');
      this.parentId = config.parentId || null;     // folder/category ID
      this.position = config.position || 0;
      this.isPrivate = config.isPrivate || false;
      this.isNSFW = config.isNSFW || false;
      this.slowMode = config.slowMode || 0;        // seconds
      this.permissionOverrides = config.permissionOverrides || [];
      this.voiceUsers = config.voiceUsers || [];
      this.userLimit = config.userLimit || 0;       // 0 = unlimited
      this.bitrate = config.bitrate || 64000;
      this.badge = config.badge || null;
    }
  }

  // ============ FOLDER/CATEGORY ============
  class ChannelFolder {
    constructor(config) {
      this.id = config.id || 'folder-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
      this.name = config.name || 'New Category';
      this.position = config.position || 0;
      this.collapsed = config.collapsed || false;
      this.permissionOverrides = config.permissionOverrides || [];
      this.isPrivate = config.isPrivate || false;
    }
  }

  // ============ MANAGED SERVER ============
  class ManagedServer {
    constructor(config) {
      this.id = config.id || 'srv-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
      this.name = config.name || 'New Server';
      this.icon = config.icon || null;
      this.initials = config.initials || this.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      this.color = config.color || '#0ea5e9';
      this.ownerId = config.ownerId || (typeof currentUser !== 'undefined' && currentUser.id) || 'unknown';
      this.description = config.description || '';
      this.isPublic = config.isPublic || false;
      this.verificationLevel = config.verificationLevel || 'none'; // none, low, medium, high
      this.defaultNotifications = config.defaultNotifications || 'mentions'; // all, mentions
      this.roles = [];
      this.folders = [];
      this.channels = [];
      this.members = [];
      this.bans = [];
      this.invites = [];
      this.auditLog = [];
      this.createdAt = Date.now();

      // Create default @everyone role
      this.roles.push(new Role({
        id: this.id + '-everyone',
        name: '@everyone',
        color: '#99aab5',
        permissions: PRESET_EVERYONE,
        position: 0,
        isDefault: true
      }));
    }

    // === Role Management ===
    createRole(config) {
      const role = new Role({
        ...config,
        position: this.roles.length
      });
      this.roles.push(role);
      this.roles.sort((a, b) => b.position - a.position);
      this.logAudit('ROLE_CREATE', { roleName: role.name });
      return role;
    }

    deleteRole(roleId) {
      const idx = this.roles.findIndex(r => r.id === roleId);
      if (idx === -1 || this.roles[idx].isDefault) return false;
      const role = this.roles[idx];
      this.roles.splice(idx, 1);
      this.logAudit('ROLE_DELETE', { roleName: role.name });
      return true;
    }

    getRole(roleId) {
      return this.roles.find(r => r.id === roleId);
    }

    getRolesSorted() {
      return [...this.roles].sort((a, b) => b.position - a.position);
    }

    getEveryoneRole() {
      return this.roles.find(r => r.isDefault);
    }

    // === Folder Management ===
    createFolder(config) {
      const folder = new ChannelFolder({
        ...config,
        position: this.folders.length
      });
      this.folders.push(folder);
      this.logAudit('FOLDER_CREATE', { folderName: folder.name });
      return folder;
    }

    deleteFolder(folderId) {
      const idx = this.folders.findIndex(f => f.id === folderId);
      if (idx === -1) return false;
      // Move channels out of folder
      this.channels.forEach(ch => {
        if (ch.parentId === folderId) ch.parentId = null;
      });
      this.folders.splice(idx, 1);
      return true;
    }

    // === Channel Management ===
    createChannel(config) {
      const channel = new ManagedChannel({
        ...config,
        position: this.channels.filter(c => c.parentId === (config.parentId || null)).length
      });

      // If private, add override to deny @everyone VIEW_CHANNEL
      if (config.isPrivate) {
        const everyoneRole = this.getEveryoneRole();
        if (everyoneRole) {
          channel.permissionOverrides.push(
            new PermissionOverride(everyoneRole.id, 'role', 0, PERMS.VIEW_CHANNEL | PERMS.CONNECT_VOICE)
          );
        }
      }

      this.channels.push(channel);
      this.logAudit('CHANNEL_CREATE', { channelName: channel.name, type: channel.type });
      return channel;
    }

    deleteChannel(channelId) {
      const idx = this.channels.findIndex(c => c.id === channelId);
      if (idx === -1) return false;
      const ch = this.channels[idx];
      this.channels.splice(idx, 1);
      this.logAudit('CHANNEL_DELETE', { channelName: ch.name });
      return true;
    }

    getChannel(channelId) {
      return this.channels.find(c => c.id === channelId);
    }

    getChannelsInFolder(folderId) {
      return this.channels
        .filter(c => c.parentId === folderId)
        .sort((a, b) => a.position - b.position);
    }

    getOrphanChannels() {
      return this.channels
        .filter(c => !c.parentId)
        .sort((a, b) => a.position - b.position);
    }

    // === Permission Checking ===
    getMemberPermissions(userId, channelId) {
      // Server owner has all permissions
      if (userId === this.ownerId) return 0xFFFFFFFF;

      const member = this.members.find(m => m.userId === userId);
      if (!member) return 0;

      // Combine role permissions
      let perms = 0;
      const memberRoles = member.roleIds.map(rid => this.getRole(rid)).filter(Boolean);
      const everyoneRole = this.getEveryoneRole();
      if (everyoneRole) perms |= everyoneRole.permissions;
      memberRoles.forEach(role => { perms |= role.permissions; });

      // Admin bypasses everything
      if (perms & PERMS.ADMINISTRATOR) return 0xFFFFFFFF;

      // Apply channel overrides
      if (channelId) {
        const channel = this.getChannel(channelId);
        if (channel) {
          // Apply folder overrides first
          if (channel.parentId) {
            const folder = this.folders.find(f => f.id === channel.parentId);
            if (folder) {
              perms = this._applyOverrides(perms, folder.permissionOverrides, member, memberRoles);
            }
          }
          // Then channel overrides
          perms = this._applyOverrides(perms, channel.permissionOverrides, member, memberRoles);
        }
      }

      return perms;
    }

    _applyOverrides(perms, overrides, member, memberRoles) {
      let allow = 0, deny = 0;

      // Role overrides
      overrides.filter(o => o.targetType === 'role').forEach(override => {
        const hasRole = override.targetId.endsWith('-everyone') ||
          memberRoles.some(r => r.id === override.targetId);
        if (hasRole) {
          allow |= override.allow;
          deny |= override.deny;
        }
      });

      // Member-specific overrides (highest priority)
      overrides.filter(o => o.targetType === 'member' && o.targetId === member.userId).forEach(override => {
        allow |= override.allow;
        deny |= override.deny;
      });

      perms = (perms & ~deny) | allow;
      return perms;
    }

    canViewChannel(userId, channelId) {
      const perms = this.getMemberPermissions(userId, channelId);
      return (perms & PERMS.VIEW_CHANNEL) !== 0;
    }

    canSendMessages(userId, channelId) {
      const perms = this.getMemberPermissions(userId, channelId);
      return (perms & PERMS.SEND_MESSAGES) !== 0;
    }

    hasPermission(userId, perm, channelId) {
      const perms = this.getMemberPermissions(userId, channelId);
      return (perms & perm) !== 0;
    }

    // === Member Management ===
    addMember(userId, roleIds) {
      if (this.members.find(m => m.userId === userId)) return;
      this.members.push({
        userId,
        roleIds: roleIds || [],
        joinedAt: Date.now(),
        nickname: null
      });
    }

    removeMember(userId) {
      this.members = this.members.filter(m => m.userId !== userId);
    }

    assignRole(userId, roleId) {
      const member = this.members.find(m => m.userId === userId);
      if (member && !member.roleIds.includes(roleId)) {
        member.roleIds.push(roleId);
        this.logAudit('ROLE_ASSIGN', { userId, roleId });
      }
    }

    removeRole(userId, roleId) {
      const member = this.members.find(m => m.userId === userId);
      if (member) {
        member.roleIds = member.roleIds.filter(id => id !== roleId);
      }
    }

    getMember(userId) {
      return this.members.find(m => m.userId === userId);
    }

    getMemberHighestRole(userId) {
      const member = this.getMember(userId);
      if (!member) return this.getEveryoneRole();
      const roles = member.roleIds.map(id => this.getRole(id)).filter(Boolean);
      if (roles.length === 0) return this.getEveryoneRole();
      return roles.sort((a, b) => b.position - a.position)[0];
    }

    // === Audit Log ===
    logAudit(action, details) {
      this.auditLog.push({
        id: 'audit-' + Date.now(),
        action,
        details,
        userId: (typeof currentUser !== 'undefined' && currentUser.id) || 'unknown',
        timestamp: Date.now()
      });
      if (this.auditLog.length > 100) this.auditLog = this.auditLog.slice(-100);
    }

    // === Export for sidebar rendering ===
    toSidebarData() {
      const result = {};
      const sortedFolders = [...this.folders].sort((a, b) => a.position - b.position);

      // Orphan channels first
      const orphans = this.getOrphanChannels();
      if (orphans.length > 0) {
        result['Channels'] = orphans.map(ch => this._channelToSidebar(ch));
      }

      // Folder channels
      sortedFolders.forEach(folder => {
        const channels = this.getChannelsInFolder(folder.id);
        result[folder.name] = channels.map(ch => this._channelToSidebar(ch));
        // Store folder metadata
        result[folder.name]._folderId = folder.id;
        result[folder.name]._isPrivate = folder.isPrivate;
      });

      return result;
    }

    _channelToSidebar(ch) {
      return {
        id: ch.id,
        name: ch.name,
        type: ch.type,
        icon: ch.isPrivate ? (ch.type === 'voice' ? '🔒' : '🔒') : ch.icon,
        topic: ch.topic,
        isPrivate: ch.isPrivate,
        badge: ch.badge,
        voiceUsers: ch.voiceUsers,
        slowMode: ch.slowMode
      };
    }
  }

  // ============ SERVER MANAGER (global) ============
  class ServerManager {
    constructor() {
      this.servers = new Map();
      this.templates = this._createTemplates();
    }

    create(config, templateId) {
      const template = templateId ? this.templates.get(templateId) : null;
      const server = new ManagedServer(config);

      // Add owner as member with admin
      server.addMember(config.ownerId || (typeof currentUser !== 'undefined' && currentUser.id) || 'unknown', []);

      if (template) {
        this._applyTemplate(server, template);
      } else {
        // Default structure
        this._applyDefaultStructure(server);
      }

      // Add all existing users as members
      if (typeof users !== 'undefined') {
        Object.keys(users).forEach(uid => {
          if (uid !== (config.ownerId || (typeof currentUser !== 'undefined' && currentUser.id) || 'unknown')) {
            server.addMember(uid, []);
          }
        });
      }

      this.servers.set(server.id, server);
      return server;
    }

    get(serverId) { return this.servers.get(serverId); }
    delete(serverId) { return this.servers.delete(serverId); }
    getAll() { return Array.from(this.servers.values()); }

    _applyDefaultStructure(server) {
      // Create default roles
      const adminRole = server.createRole({ name: 'Admin', color: '#f87171', permissions: PRESET_ADMIN, position: 3, hoisted: true });
      const modRole = server.createRole({ name: 'Moderator', color: '#a78bfa', permissions: PRESET_MOD, position: 2, hoisted: true });
      server.createRole({ name: 'Member', color: '#0ea5e9', permissions: PRESET_EVERYONE, position: 1 });

      // Assign admin role to owner
      server.assignRole(server.ownerId, adminRole.id);

      // Create folders and channels
      const infoFolder = server.createFolder({ name: 'Information', position: 0 });
      const generalFolder = server.createFolder({ name: 'General', position: 1 });
      const voiceFolder = server.createFolder({ name: 'Voice Channels', position: 2 });

      server.createChannel({ name: 'welcome', type: 'text', icon: '👋', parentId: infoFolder.id, topic: 'Welcome to the server!' });
      server.createChannel({ name: 'rules', type: 'text', icon: '📋', parentId: infoFolder.id, topic: 'Server rules' });
      server.createChannel({ name: 'announcements', type: 'announcement', icon: '📢', parentId: infoFolder.id, topic: 'Important announcements' });

      server.createChannel({ name: 'general', type: 'text', icon: '#', parentId: generalFolder.id, topic: 'General chat' });
      server.createChannel({ name: 'off-topic', type: 'text', icon: '#', parentId: generalFolder.id, topic: 'Anything goes!' });

      server.createChannel({ name: 'General', type: 'voice', icon: '🔊', parentId: voiceFolder.id, voiceUsers: [] });
      server.createChannel({ name: 'AFK', type: 'voice', icon: '🔊', parentId: voiceFolder.id, voiceUsers: [] });
    }

    _createTemplates() {
      const templates = new Map();

      templates.set('gaming', {
        name: 'Gaming Community',
        icon: '🎮',
        folders: [
          { name: 'Info', channels: [
            { name: 'rules', type: 'text', icon: '📋' },
            { name: 'announcements', type: 'text', icon: '📢' }
          ]},
          { name: 'Chat', channels: [
            { name: 'general', type: 'text', icon: '#' },
            { name: 'looking-for-group', type: 'text', icon: '🎯' },
            { name: 'clips-and-highlights', type: 'text', icon: '🎬' },
            { name: 'memes', type: 'text', icon: '😂' }
          ]},
          { name: 'Games', channels: [
            { name: 'valorant', type: 'text', icon: '#' },
            { name: 'minecraft', type: 'text', icon: '#' },
            { name: 'league', type: 'text', icon: '#' }
          ]},
          { name: 'Voice', channels: [
            { name: 'Game Room 1', type: 'voice', icon: '🔊' },
            { name: 'Game Room 2', type: 'voice', icon: '🔊' },
            { name: 'AFK', type: 'voice', icon: '🔊' }
          ]}
        ],
        roles: [
          { name: 'Admin', color: '#f87171', permissions: PRESET_ADMIN, hoisted: true },
          { name: 'Moderator', color: '#a78bfa', permissions: PRESET_MOD, hoisted: true },
          { name: 'Gamer', color: '#22c55e', permissions: PRESET_EVERYONE }
        ]
      });

      templates.set('streamer', {
        name: 'Streamer Community',
        icon: '📺',
        folders: [
          { name: 'Info', channels: [
            { name: 'rules', type: 'text', icon: '📋' },
            { name: 'announcements', type: 'text', icon: '📢' },
            { name: 'stream-schedule', type: 'text', icon: '📅' }
          ]},
          { name: 'Community', channels: [
            { name: 'general', type: 'text', icon: '#' },
            { name: 'stream-chat', type: 'text', icon: '💬' },
            { name: 'fan-art', type: 'text', icon: '🎨' },
            { name: 'clips', type: 'text', icon: '🎬' }
          ]},
          { name: 'Subscribers Only', isPrivate: true, channels: [
            { name: 'sub-chat', type: 'text', icon: '⭐', isPrivate: true },
            { name: 'sub-voice', type: 'voice', icon: '🔊', isPrivate: true }
          ]},
          { name: 'Voice', channels: [
            { name: 'Watch Party', type: 'voice', icon: '🔊' },
            { name: 'Hangout', type: 'voice', icon: '🔊' }
          ]}
        ],
        roles: [
          { name: 'Streamer', color: '#9146FF', permissions: PRESET_ADMIN, hoisted: true },
          { name: 'Moderator', color: '#a78bfa', permissions: PRESET_MOD, hoisted: true },
          { name: 'Subscriber', color: '#FFD700', permissions: PRESET_EVERYONE | PERMS.ATTACH_FILES, hoisted: true },
          { name: 'Viewer', color: '#0ea5e9', permissions: PRESET_EVERYONE }
        ]
      });

      templates.set('study', {
        name: 'Study Group',
        icon: '📚',
        folders: [
          { name: 'Resources', channels: [
            { name: 'announcements', type: 'text', icon: '📢' },
            { name: 'resources', type: 'text', icon: '📚' },
            { name: 'schedule', type: 'text', icon: '📅' }
          ]},
          { name: 'Discussion', channels: [
            { name: 'general', type: 'text', icon: '#' },
            { name: 'homework-help', type: 'text', icon: '✏️' },
            { name: 'study-tips', type: 'text', icon: '💡' }
          ]},
          { name: 'Study Rooms', channels: [
            { name: 'Quiet Study', type: 'voice', icon: '🔊' },
            { name: 'Group Study', type: 'voice', icon: '🔊' },
            { name: 'Tutoring', type: 'voice', icon: '🔊' }
          ]}
        ],
        roles: [
          { name: 'Teacher', color: '#f87171', permissions: PRESET_ADMIN, hoisted: true },
          { name: 'Tutor', color: '#f59e0b', permissions: PRESET_MOD, hoisted: true },
          { name: 'Student', color: '#0ea5e9', permissions: PRESET_EVERYONE }
        ]
      });

      templates.set('community', {
        name: 'General Community',
        icon: '🌐',
        folders: [
          { name: 'Welcome', channels: [
            { name: 'rules', type: 'text', icon: '📋' },
            { name: 'introductions', type: 'text', icon: '👋' },
            { name: 'announcements', type: 'text', icon: '📢' }
          ]},
          { name: 'Chat', channels: [
            { name: 'general', type: 'text', icon: '#' },
            { name: 'off-topic', type: 'text', icon: '#' },
            { name: 'media', type: 'text', icon: '📸' }
          ]},
          { name: 'Staff Only', isPrivate: true, channels: [
            { name: 'staff-chat', type: 'text', icon: '🔒', isPrivate: true },
            { name: 'mod-log', type: 'text', icon: '🔒', isPrivate: true }
          ]},
          { name: 'Voice', channels: [
            { name: 'Lounge', type: 'voice', icon: '🔊' },
            { name: 'Events', type: 'voice', icon: '🔊' }
          ]}
        ],
        roles: [
          { name: 'Owner', color: '#f87171', permissions: PRESET_ADMIN, hoisted: true },
          { name: 'Admin', color: '#ef4444', permissions: PRESET_ADMIN, hoisted: true },
          { name: 'Moderator', color: '#a78bfa', permissions: PRESET_MOD, hoisted: true },
          { name: 'VIP', color: '#FFD700', permissions: PRESET_EVERYONE, hoisted: true },
          { name: 'Member', color: '#0ea5e9', permissions: PRESET_EVERYONE }
        ]
      });

      return templates;
    }

    _applyTemplate(server, template) {
      // Create roles
      let adminRoleId = null;
      template.roles.forEach((rc, i) => {
        const role = server.createRole({ ...rc, position: template.roles.length - i });
        if (rc.permissions === PRESET_ADMIN && !adminRoleId) adminRoleId = role.id;
      });
      if (adminRoleId) server.assignRole(server.ownerId, adminRoleId);

      // Create folders and channels
      template.folders.forEach((fc, fi) => {
        const folder = server.createFolder({ name: fc.name, position: fi, isPrivate: fc.isPrivate || false });
        fc.channels.forEach((cc, ci) => {
          server.createChannel({
            ...cc,
            parentId: folder.id,
            position: ci,
            voiceUsers: cc.voiceUsers || []
          });
        });
      });
    }

    getTemplates() {
      return Array.from(this.templates.entries()).map(([id, t]) => ({ id, ...t }));
    }
  }

  // Expose
  global.NexusPerms = PERMS;
  global.NexusServerManager = new ServerManager();

})(typeof window !== 'undefined' ? window : global);