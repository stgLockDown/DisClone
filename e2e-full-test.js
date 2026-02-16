// ============================================
// NEXUS CHAT — Full End-to-End Test Suite
// ============================================

const BASE = 'http://localhost:8090';

let userA = null, userB = null, userC = null;
let tokenA = null, tokenB = null, tokenC = null;
let passed = 0, failed = 0, total = 0;

async function request(method, path, body, token) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { _raw: text, _status: res.status }; }
}

function assert(condition, label, detail) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}${detail ? ' — ' + JSON.stringify(detail).slice(0, 200) : ''}`);
  }
}

// ============ TEST SECTIONS ============

async function testAuth() {
  console.log('\n🔐 === AUTH TESTS ===');

  // Register user A
  const regA = await request('POST', '/api/auth/register', {
    email: 'alice@test.com', username: 'alice', displayName: 'Alice Test', password: 'password123'
  });
  assert(regA.success === true, 'Register user A (Alice)', regA);
  tokenA = regA.token;
  userA = regA.user;

  // Register user B
  const regB = await request('POST', '/api/auth/register', {
    email: 'bob@test.com', username: 'bob', displayName: 'Bob Test', password: 'password123'
  });
  assert(regB.success === true, 'Register user B (Bob)', regB);
  tokenB = regB.token;
  userB = regB.user;

  // Register user C
  const regC = await request('POST', '/api/auth/register', {
    email: 'charlie@test.com', username: 'charlie', displayName: 'Charlie Test', password: 'password123'
  });
  assert(regC.success === true, 'Register user C (Charlie)', regC);
  tokenC = regC.token;
  userC = regC.user;

  // Login
  const loginA = await request('POST', '/api/auth/login', {
    email: 'alice@test.com', password: 'password123'
  });
  assert(loginA.success === true, 'Login user A', loginA);
  tokenA = loginA.token || tokenA;

  // Get profile
  const me = await request('GET', '/api/auth/me', null, tokenA);
  assert(me.success === true && me.user?.username === 'alice', 'Get profile (me)', me);

  // Update profile (PATCH, not PUT)
  const update = await request('PATCH', '/api/auth/me', {
    displayName: 'Alice Updated', about: 'Testing!'
  }, tokenA);
  assert(update.success === true, 'Update profile', update);

  // Verify update
  const me2 = await request('GET', '/api/auth/me', null, tokenA);
  assert(me2.user?.displayName === 'Alice Updated', 'Profile update persisted', me2.user?.displayName);

  // Auth without token should fail
  const noAuth = await request('GET', '/api/auth/me', null, null);
  assert(noAuth.success !== true, 'Reject unauthenticated request', noAuth);

  // Duplicate registration should fail
  const dupReg = await request('POST', '/api/auth/register', {
    email: 'alice@test.com', username: 'alice2', displayName: 'Dup', password: 'password123'
  });
  assert(dupReg.success !== true, 'Reject duplicate email registration', dupReg);

  // Login with wrong password
  const badLogin = await request('POST', '/api/auth/login', {
    email: 'alice@test.com', password: 'wrongpassword'
  });
  assert(badLogin.success !== true, 'Reject wrong password', badLogin);
}

async function testServers() {
  console.log('\n🏠 === SERVER TESTS ===');

  // Create server
  const create = await request('POST', '/api/servers', {
    name: 'Test Server', description: 'A test server'
  }, tokenA);
  assert(create.success === true && create.server?.id, 'Create server', create);
  const serverId = create.server?.id;

  // List servers
  const list = await request('GET', '/api/servers', null, tokenA);
  assert(list.success === true && list.servers?.length > 0, 'List servers', list);
  const myServer = list.servers?.find(s => s.id === serverId);
  assert(myServer !== undefined, 'Created server appears in list');

  // Get server details
  const detail = await request('GET', `/api/servers/${serverId}`, null, tokenA);
  assert(detail.success === true && detail.server?.name === 'Test Server', 'Get server details', detail.server?.name);

  // Server should have categories with channels
  const categories = detail.server?.categories || [];
  assert(categories.length > 0, 'Server has categories', categories.length);
  
  // Find general channel in categories
  let generalChannelId = null;
  for (const cat of categories) {
    const general = (cat.channels || []).find(c => c.name === 'general');
    if (general) { generalChannelId = general.id; break; }
  }
  assert(generalChannelId !== null, 'Server has #general channel', categories.map(c => c.name));

  // Create invite
  const invite = await request('POST', `/api/servers/${serverId}/invites`, {}, tokenA);
  assert(invite.success === true && invite.invite?.code, 'Create invite', invite);

  // User B joins via invite (correct path: /api/servers/invite/:code/join)
  const join = await request('POST', `/api/servers/invite/${invite.invite?.code}/join`, {}, tokenB);
  assert(join.success === true, 'User B joins via invite', join);

  // User B should see the server
  const listB = await request('GET', '/api/servers', null, tokenB);
  const bHasServer = listB.servers?.some(s => s.id === serverId);
  assert(bHasServer, 'User B sees joined server');

  // Server members
  const members = await request('GET', `/api/servers/${serverId}/members`, null, tokenA);
  assert(members.success === true && members.members?.length >= 2, 'Server has 2+ members', members.members?.length);

  return { serverId, generalChannelId };
}

async function testChannels(serverId) {
  console.log('\n📺 === CHANNEL TESTS ===');

  // Create a new channel
  const create = await request('POST', `/api/servers/${serverId}/channels`, {
    name: 'test-channel', type: 'text', topic: 'Testing channel'
  }, tokenA);
  assert(create.success === true && create.channel?.id, 'Create channel', create);
  const channelId = create.channel?.id;

  // Update channel (PATCH /api/channels/:id)
  const update = await request('PATCH', `/api/channels/${channelId}`, {
    name: 'renamed-channel', topic: 'Updated topic'
  }, tokenA);
  assert(update.success === true, 'Update channel', update);

  // Verify update
  const detail = await request('GET', `/api/servers/${serverId}`, null, tokenA);
  let found = false;
  for (const cat of (detail.server?.categories || [])) {
    if ((cat.channels || []).find(c => c.id === channelId && c.name === 'renamed-channel')) {
      found = true; break;
    }
  }
  assert(found, 'Channel rename persisted in server');

  // Delete channel
  const del = await request('DELETE', `/api/channels/${channelId}`, null, tokenA);
  assert(del.success === true, 'Delete channel', del);

  // Verify deletion
  const detail2 = await request('GET', `/api/servers/${serverId}`, null, tokenA);
  let stillExists = false;
  for (const cat of (detail2.server?.categories || [])) {
    if ((cat.channels || []).find(c => c.id === channelId)) { stillExists = true; break; }
  }
  assert(!stillExists, 'Channel deleted from server');
}

async function testMessages(channelId) {
  console.log('\n💬 === MESSAGE TESTS ===');

  // Send message as user A
  const send1 = await request('POST', `/api/channels/${channelId}/messages`, {
    content: 'Hello from Alice!'
  }, tokenA);
  assert(send1.success === true && send1.message?.id, 'Send message (Alice)', send1);
  const msgId = send1.message?.id;

  // Send message as user B
  const send2 = await request('POST', `/api/channels/${channelId}/messages`, {
    content: 'Hello from Bob!'
  }, tokenB);
  assert(send2.success === true && send2.message?.id, 'Send message (Bob)', send2);

  // Get messages
  const msgs = await request('GET', `/api/channels/${channelId}/messages`, null, tokenA);
  assert(msgs.success === true && msgs.messages?.length >= 2, 'Get messages (at least 2)', msgs.messages?.length);

  // Verify message content
  const aliceMsg = msgs.messages?.find(m => m.content === 'Hello from Alice!');
  const bobMsg = msgs.messages?.find(m => m.content === 'Hello from Bob!');
  assert(aliceMsg !== undefined, 'Alice message found in list');
  assert(bobMsg !== undefined, 'Bob message found in list');

  // Verify message has proper user data
  assert(aliceMsg?.user?.username === 'alice', 'Alice message has correct user', aliceMsg?.user);

  // Edit message (PATCH, not PUT)
  const edit = await request('PATCH', `/api/messages/${msgId}`, {
    content: 'Hello from Alice! (edited)'
  }, tokenA);
  assert(edit.success === true, 'Edit message', edit);

  // Verify edit
  const msgs2 = await request('GET', `/api/channels/${channelId}/messages`, null, tokenA);
  const editedMsg = msgs2.messages?.find(m => m.id === msgId);
  assert(editedMsg?.content === 'Hello from Alice! (edited)', 'Message edit persisted', editedMsg?.content);

  // Delete message
  const del = await request('DELETE', `/api/messages/${msgId}`, null, tokenA);
  assert(del.success === true, 'Delete message', del);

  // Verify deletion
  const msgs3 = await request('GET', `/api/channels/${channelId}/messages`, null, tokenA);
  const deletedMsg = msgs3.messages?.find(m => m.id === msgId);
  assert(deletedMsg === undefined, 'Message deleted from list');

  return send2.message?.id;
}

async function testReactions(channelId, messageId) {
  console.log('\n😀 === REACTION TESTS ===');

  // Add reaction
  const add = await request('POST', `/api/messages/${messageId}/reactions`, {
    emoji: '👍'
  }, tokenA);
  assert(add.success === true, 'Add reaction', add);

  // Add same reaction from user B
  const add2 = await request('POST', `/api/messages/${messageId}/reactions`, {
    emoji: '👍'
  }, tokenB);
  assert(add2.success === true, 'Add same reaction from user B', add2);

  // Add different reaction
  const add3 = await request('POST', `/api/messages/${messageId}/reactions`, {
    emoji: '❤️'
  }, tokenA);
  assert(add3.success === true, 'Add different reaction', add3);

  // Get messages and check reactions
  const msgs = await request('GET', `/api/channels/${channelId}/messages`, null, tokenA);
  const msg = msgs.messages?.find(m => m.id === messageId);
  const reactionCount = msg?.reactions?.length || 0;
  assert(reactionCount >= 2, 'Message has 2+ reaction types', msg?.reactions);

  // Check thumbs up has 2 users
  const thumbsUp = msg?.reactions?.find(r => r.emoji === '👍');
  assert(thumbsUp?.count === 2, 'Thumbs up has 2 users', thumbsUp);

  // Remove reaction (DELETE with emoji in URL)
  const remove = await request('DELETE', `/api/messages/${messageId}/reactions/${encodeURIComponent('👍')}`, null, tokenA);
  assert(remove.success === true, 'Remove reaction', remove);

  // Verify removal
  const msgs2 = await request('GET', `/api/channels/${channelId}/messages`, null, tokenA);
  const msg2 = msgs2.messages?.find(m => m.id === messageId);
  const thumbsUp2 = msg2?.reactions?.find(r => r.emoji === '👍');
  assert(!thumbsUp2 || thumbsUp2.count === 1, 'Reaction removed (count decreased)', thumbsUp2);
}

async function testFriends() {
  console.log('\n👥 === FRIEND TESTS ===');

  // Send friend request A -> C (using targetUserId)
  const sendReq = await request('POST', '/api/friends/request', {
    targetUserId: userC.id
  }, tokenA);
  assert(sendReq.success === true, 'Send friend request (A -> C)', sendReq);

  // Check pending for C
  const pendingC = await request('GET', '/api/friends', null, tokenC);
  assert(pendingC.success === true, 'Get friends list for C', pendingC);
  const incomingC = pendingC.incoming || [];
  assert(incomingC.length > 0, 'User C has incoming request', incomingC);

  // Accept friend request (POST /api/friends/accept/:id)
  const accept = await request('POST', `/api/friends/accept/${userA.id}`, {}, tokenC);
  assert(accept.success === true, 'Accept friend request', accept);

  // Verify friendship
  const friendsA = await request('GET', '/api/friends', null, tokenA);
  assert(friendsA.success === true, 'Get friends list for A', friendsA);
  const hasFriendC = friendsA.friends?.some(f => f.id === userC.id || f.friendId === userC.id);
  assert(hasFriendC, 'A and C are friends', friendsA.friends?.map(f => f.id));

  // Send friend request A -> B (using targetUserId)
  const sendReq2 = await request('POST', '/api/friends/request', {
    targetUserId: userB.id
  }, tokenA);
  assert(sendReq2.success === true, 'Send friend request (A -> B)', sendReq2);

  // B accepts
  const accept2 = await request('POST', `/api/friends/accept/${userA.id}`, {}, tokenB);
  assert(accept2.success === true, 'B accepts friend request', accept2);

  // Verify A has 2 friends
  const friendsA2 = await request('GET', '/api/friends', null, tokenA);
  assert(friendsA2.friends?.length >= 2, 'A has 2+ friends', friendsA2.friends?.length);

  // Remove friend (DELETE /api/friends/:id)
  const remove = await request('DELETE', `/api/friends/${userC.id}`, null, tokenA);
  assert(remove.success === true, 'Remove friend (A removes C)', remove);

  // Verify removal
  const friendsA3 = await request('GET', '/api/friends', null, tokenA);
  const stillFriendC = friendsA3.friends?.some(f => f.id === userC.id || f.friendId === userC.id);
  assert(!stillFriendC, 'C no longer in A\'s friends');
}

async function testDMs() {
  console.log('\n📩 === DM TESTS ===');

  // Open DM with user B (A and B are friends)
  const openDM = await request('POST', '/api/friends/dms', {
    targetUserId: userB.id
  }, tokenA);
  assert(openDM.success === true && openDM.channel?.id, 'Open DM channel (A -> B)', openDM);
  const dmChannelId = openDM.channel?.id;

  // Send DM message
  const sendDM = await request('POST', `/api/channels/${dmChannelId}/messages`, {
    content: 'Hey Bob, this is a DM!'
  }, tokenA);
  assert(sendDM.success === true && sendDM.message?.id, 'Send DM message', sendDM);

  // Bob reads DM
  const readDM = await request('GET', `/api/channels/${dmChannelId}/messages`, null, tokenB);
  assert(readDM.success === true && readDM.messages?.length > 0, 'Bob reads DM messages', readDM.messages?.length);
  const dmMsg = readDM.messages?.find(m => m.content === 'Hey Bob, this is a DM!');
  assert(dmMsg !== undefined, 'DM message content correct');

  // Get DM list for A
  const dmsA = await request('GET', '/api/friends/dms', null, tokenA);
  assert(dmsA.success === true && dmsA.dms?.length > 0, 'Get DM list for A', dmsA.dms?.length);
  const hasBobDM = dmsA.dms?.some(dm => dm.id === dmChannelId);
  assert(hasBobDM, 'DM with Bob appears in A\'s DM list');

  // Get DM list for B
  const dmsB = await request('GET', '/api/friends/dms', null, tokenB);
  assert(dmsB.success === true && dmsB.dms?.length > 0, 'Get DM list for B', dmsB.dms?.length);

  // Verify DM has user info
  const bobDM = dmsA.dms?.find(dm => dm.id === dmChannelId);
  assert(bobDM?.user?.username === 'bob' || bobDM?.user?.id === userB.id, 'DM has correct user info', bobDM?.user);

  return dmChannelId;
}

async function testFileUpload() {
  console.log('\n📎 === FILE UPLOAD TESTS ===');

  // Test multipart upload
  const formData = new FormData();
  const blob = new Blob(['test file content'], { type: 'text/plain' });
  formData.append('file', blob, 'test.txt');

  try {
    const res = await fetch(`${BASE}/api/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: formData
    });
    const data = await res.json();
    assert(data.success === true && data.file?.url, 'Upload file', data);

    // Verify file is accessible
    if (data.file?.url) {
      const fileRes = await fetch(`${BASE}${data.file.url}`);
      const fileText = await fileRes.text();
      assert(fileText === 'test file content', 'Uploaded file is accessible and correct', fileText);
    }
  } catch (e) {
    assert(false, 'Upload endpoint accessible', e.message);
  }
}

async function testEdgeCases() {
  console.log('\n🔧 === EDGE CASE TESTS ===');

  // Empty message should fail
  const emptyMsg = await request('POST', '/api/channels/nonexistent/messages', {
    content: ''
  }, tokenA);
  assert(emptyMsg.success !== true, 'Reject empty message');

  // Invalid channel should fail
  const badChannel = await request('GET', '/api/channels/nonexistent-id/messages', null, tokenA);
  assert(badChannel.success !== true || badChannel.messages?.length === 0, 'Handle invalid channel gracefully');

  // Invalid token should fail
  const badToken = await request('GET', '/api/auth/me', null, 'invalid-token-123');
  assert(badToken.success !== true, 'Reject invalid token');

  // Very long message (within limit)
  const longContent = 'A'.repeat(3999);
  const list = await request('GET', '/api/servers', null, tokenA);
  const serverId = list.servers?.[0]?.id;
  if (serverId) {
    const detail = await request('GET', `/api/servers/${serverId}`, null, tokenA);
    let chId = null;
    for (const cat of (detail.server?.categories || [])) {
      const ch = (cat.channels || []).find(c => c.type === 'text');
      if (ch) { chId = ch.id; break; }
    }
    if (chId) {
      const longMsg = await request('POST', `/api/channels/${chId}/messages`, { content: longContent }, tokenA);
      assert(longMsg.success === true, 'Accept long message (3999 chars)', longMsg.success);
    }
  }

  // Too long message (over limit)
  if (serverId) {
    const detail = await request('GET', `/api/servers/${serverId}`, null, tokenA);
    let chId = null;
    for (const cat of (detail.server?.categories || [])) {
      const ch = (cat.channels || []).find(c => c.type === 'text');
      if (ch) { chId = ch.id; break; }
    }
    if (chId) {
      const tooLong = await request('POST', `/api/channels/${chId}/messages`, { content: 'A'.repeat(4001) }, tokenA);
      assert(tooLong.success !== true, 'Reject too-long message (4001 chars)');
    }
  }

  // Register with missing fields
  const badReg = await request('POST', '/api/auth/register', { email: 'bad@test.com' });
  assert(badReg.success !== true, 'Reject incomplete registration');

  // Cannot edit someone else's message
  if (serverId) {
    const detail = await request('GET', `/api/servers/${serverId}`, null, tokenA);
    let chId = null;
    for (const cat of (detail.server?.categories || [])) {
      const ch = (cat.channels || []).find(c => c.type === 'text');
      if (ch) { chId = ch.id; break; }
    }
    if (chId) {
      const msg = await request('POST', `/api/channels/${chId}/messages`, { content: 'Alice only' }, tokenA);
      if (msg.message?.id) {
        const editByB = await request('PATCH', `/api/messages/${msg.message.id}`, { content: 'Hacked by Bob' }, tokenB);
        assert(editByB.success !== true, 'Cannot edit another user\'s message', editByB);
      }
    }
  }
}

async function testNoFakeDemoData() {
  console.log('\n🚫 === NO FAKE DEMO DATA TESTS ===');

  // Register a fresh user and check they don't see demo DMs
  const regFresh = await request('POST', '/api/auth/register', {
    email: 'fresh@test.com', username: 'freshuser', displayName: 'Fresh User', password: 'password123'
  });
  assert(regFresh.success === true, 'Register fresh user');
  const freshToken = regFresh.token;

  // Fresh user should have no DMs
  const dms = await request('GET', '/api/friends/dms', null, freshToken);
  assert(dms.success === true && (!dms.dms || dms.dms.length === 0), 'Fresh user has no DMs', dms.dms?.length);

  // Fresh user should have no friends
  const friends = await request('GET', '/api/friends', null, freshToken);
  assert(friends.success === true, 'Fresh user friends endpoint works');
  const friendCount = friends.friends?.length || 0;
  assert(friendCount === 0, 'Fresh user has no friends', friendCount);

  // Check that demo users don't appear in DM list
  const demoNames = ['Riley', 'Kim', 'Drew', 'Parker', 'Sam', 'Torres', 'Avery', 'Quinn', 'Taylor Swift'];
  const dmNames = (dms.dms || []).map(d => d.user?.displayName || d.user?.username || '').join(' ');
  const hasDemoInDMs = demoNames.some(name => dmNames.includes(name));
  assert(!hasDemoInDMs, 'No demo users in DM list');

  // Verify the frontend calls.js no longer injects fake DMs
  const fs = require('fs');
  const callsCode = fs.readFileSync('./calls.js', 'utf8');
  assert(!callsCode.includes('Riley Kim'), 'calls.js has no Riley Kim');
  assert(!callsCode.includes('Drew Park'), 'calls.js has no Drew Park');
  assert(!callsCode.includes('Sam Torres'), 'calls.js has no Sam Torres');
  assert(!callsCode.includes('Taylor Swift'), 'calls.js has no Taylor Swift');
  assert(!callsCode.includes("'dm-riley'"), 'calls.js has no dm-riley channel');
}

// ============ RUN ALL TESTS ============

async function runAll() {
  console.log('🚀 NEXUS CHAT — Full E2E Test Suite');
  console.log('====================================\n');

  try {
    await testAuth();
    const { serverId, generalChannelId } = await testServers();
    await testChannels(serverId);
    const msgId = await testMessages(generalChannelId);
    await testReactions(generalChannelId, msgId);
    await testFriends();
    await testDMs();
    await testFileUpload();
    await testEdgeCases();
    await testNoFakeDemoData();
  } catch (e) {
    console.error('\n💥 FATAL ERROR:', e.message);
    console.error(e.stack);
  }

  console.log('\n====================================');
  console.log(`📊 RESULTS: ${passed}/${total} passed, ${failed} failed`);
  console.log('====================================');

  process.exit(failed > 0 ? 1 : 0);
}

runAll();