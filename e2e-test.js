// End-to-end API test script for Nexus Chat
const BASE = 'http://localhost:8090';

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  return res.json();
}

async function runTests() {
  let passed = 0, failed = 0;
  const results = [];

  function assert(name, condition, detail) {
    if (condition) {
      passed++;
      results.push(`✅ ${name}`);
    } else {
      failed++;
      results.push(`❌ ${name}: ${detail || 'FAILED'}`);
    }
  }

  // ========== AUTH TESTS ==========
  console.log('\n=== AUTH TESTS ===');

  // Register user A
  const regA = await request('POST', '/api/auth/register', {
    email: `e2e_a_${Date.now()}@test.com`,
    displayName: 'E2E User A',
    username: `e2e_a_${Date.now()}`,
    password: 'password123'
  });
  assert('Register User A', regA.success, JSON.stringify(regA));
  const tokenA = regA.token;
  const userA = regA.user;

  // Register user B
  const regB = await request('POST', '/api/auth/register', {
    email: `e2e_b_${Date.now()}@test.com`,
    displayName: 'E2E User B',
    username: `e2e_b_${Date.now()}`,
    password: 'password123'
  });
  assert('Register User B', regB.success, JSON.stringify(regB));
  const tokenB = regB.token;
  const userB = regB.user;

  // Get profile
  const profile = await request('GET', '/api/auth/me', null, tokenA);
  assert('Get Profile', profile.success && profile.user.id === userA.id, JSON.stringify(profile));

  // Login
  const login = await request('POST', '/api/auth/login', {
    email: regA.user.email,
    password: 'password123'
  });
  assert('Login', login.success && login.token, JSON.stringify(login));

  // Bad login
  const badLogin = await request('POST', '/api/auth/login', {
    email: regA.user.email,
    password: 'wrongpassword'
  });
  assert('Bad Login Rejected', !badLogin.success, JSON.stringify(badLogin));

  // ========== SERVER TESTS ==========
  console.log('\n=== SERVER TESTS ===');

  // Create server
  const createSrv = await request('POST', '/api/servers', { name: 'E2E Test Server' }, tokenA);
  assert('Create Server', createSrv.success && createSrv.server.id, JSON.stringify(createSrv));
  const serverId = createSrv.server?.id;

  // Get server details
  const getSrv = await request('GET', `/api/servers/${serverId}`, null, tokenA);
  assert('Get Server Details', getSrv.success && getSrv.server.categories.length > 0, JSON.stringify(getSrv).substring(0, 200));

  // Get server channels
  const channels = getSrv.server?.categories?.[0]?.channels || [];
  const textChannel = channels.find(c => c.type === 'text');
  assert('Server Has Text Channel', !!textChannel, JSON.stringify(channels));
  const channelId = textChannel?.id;

  // List servers
  const listSrv = await request('GET', '/api/servers', null, tokenA);
  assert('List Servers', listSrv.success && listSrv.servers.length > 0, JSON.stringify(listSrv).substring(0, 200));

  // User B joins server
  const joinSrv = await request('POST', `/api/servers/${serverId}/join`, {}, tokenB);
  assert('User B Joins Server', joinSrv.success, JSON.stringify(joinSrv));

  // Get members
  const members = await request('GET', `/api/servers/${serverId}/members`, null, tokenA);
  assert('Get Members', members.success && members.members.length >= 2, JSON.stringify(members).substring(0, 200));

  // ========== INVITE TESTS ==========
  console.log('\n=== INVITE TESTS ===');

  const createInvite = await request('POST', `/api/servers/${serverId}/invites`, {}, tokenA);
  assert('Create Invite', createInvite.success && createInvite.invite.code, JSON.stringify(createInvite));

  // ========== MESSAGE TESTS ==========
  console.log('\n=== MESSAGE TESTS ===');

  if (channelId) {
    // Send message
    const sendMsg = await request('POST', `/api/channels/${channelId}/messages`, { content: 'Hello E2E!' }, tokenA);
    assert('Send Message', sendMsg.success && sendMsg.message.content === 'Hello E2E!', JSON.stringify(sendMsg));
    assert('Message Has Timestamp', !!sendMsg.message?.timestamp, sendMsg.message?.timestamp);
    assert('Message Has User Data', !!sendMsg.message?.user?.displayName, JSON.stringify(sendMsg.message?.user));
    assert('Message UserId Matches', sendMsg.message?.userId === userA.id, `${sendMsg.message?.userId} !== ${userA.id}`);
    const msgId = sendMsg.message?.id;

    // Send message from user B
    const sendMsgB = await request('POST', `/api/channels/${channelId}/messages`, { content: 'Hello from B!' }, tokenB);
    assert('User B Send Message', sendMsgB.success, JSON.stringify(sendMsgB));

    // Get messages
    const getMessages = await request('GET', `/api/channels/${channelId}/messages`, null, tokenA);
    assert('Get Messages', getMessages.success && getMessages.messages.length >= 2, `Got ${getMessages.messages?.length} messages`);

    // Verify message format
    if (getMessages.messages?.length > 0) {
      const msg = getMessages.messages[0];
      assert('Message Has ID', !!msg.id, msg.id);
      assert('Message Has Content', !!msg.content, msg.content);
      assert('Message Has CreatedAt', !!msg.createdAt, msg.createdAt);
      assert('Message Timestamp Is ISO', /^\d{4}-\d{2}-\d{2}T/.test(msg.timestamp || msg.createdAt), msg.timestamp || msg.createdAt);
    }

    // Edit message
    if (msgId) {
      const editMsg = await request('PATCH', `/api/messages/${msgId}`, { content: 'Hello E2E (edited)!' }, tokenA);
      assert('Edit Message', editMsg.success && editMsg.message.content === 'Hello E2E (edited)!', JSON.stringify(editMsg));
      assert('Edit Shows EditedAt', !!editMsg.message?.editedAt, editMsg.message?.editedAt);
    }

    // Add reaction
    if (msgId) {
      const addReaction = await request('POST', `/api/messages/${msgId}/reactions`, { emoji: '👍' }, tokenA);
      assert('Add Reaction', addReaction.success, JSON.stringify(addReaction));
    }

    // Delete message
    if (msgId) {
      const deleteMsg = await request('DELETE', `/api/messages/${msgId}`, null, tokenA);
      assert('Delete Message', deleteMsg.success, JSON.stringify(deleteMsg));
    }

    // Verify deletion
    const afterDelete = await request('GET', `/api/channels/${channelId}/messages`, null, tokenA);
    const deletedMsg = afterDelete.messages?.find(m => m.id === msgId);
    assert('Message Deleted', !deletedMsg, deletedMsg ? 'Still found' : 'OK');
  }

  // ========== CHANNEL TESTS ==========
  console.log('\n=== CHANNEL TESTS ===');

  const createCh = await request('POST', `/api/servers/${serverId}/channels`, {
    name: 'e2e-test-channel',
    type: 'text',
    topic: 'E2E test channel'
  }, tokenA);
  assert('Create Channel', createCh.success && createCh.channel.id, JSON.stringify(createCh));

  // ========== DM TESTS ==========
  console.log('\n=== DM TESTS ===');

  const openDM = await request('POST', '/api/friends/dms', { targetUserId: userB.id }, tokenA);
  assert('Open DM', openDM.success && openDM.channel.id, JSON.stringify(openDM));
  const dmChannelId = openDM.channel?.id;

  if (dmChannelId) {
    const sendDM = await request('POST', `/api/channels/${dmChannelId}/messages`, { content: 'Hello DM!' }, tokenA);
    assert('Send DM Message', sendDM.success, JSON.stringify(sendDM));

    const getDMs = await request('GET', `/api/channels/${dmChannelId}/messages`, null, tokenA);
    assert('Get DM Messages', getDMs.success && getDMs.messages.length > 0, `Got ${getDMs.messages?.length} messages`);
  }

  // ========== FRIEND TESTS ==========
  console.log('\n=== FRIEND TESTS ===');

  const sendFR = await request('POST', '/api/friends/request', { tag: userB.tag }, tokenA);
  assert('Send Friend Request', sendFR.success, JSON.stringify(sendFR));

  const friendsB = await request('GET', '/api/friends', null, tokenB);
  assert('User B Sees Friend Request', friendsB.success, JSON.stringify(friendsB).substring(0, 200));

  // ========== PROFILE UPDATE TESTS ==========
  console.log('\n=== PROFILE TESTS ===');

  const updateProfile = await request('PATCH', '/api/auth/me', {
    displayName: 'E2E User A Updated',
    about: 'Updated bio from E2E test'
  }, tokenA);
  assert('Update Profile', updateProfile.success && updateProfile.user.displayName === 'E2E User A Updated', JSON.stringify(updateProfile));

  // ========== RESULTS ==========
  console.log('\n\n========== E2E TEST RESULTS ==========');
  results.forEach(r => console.log(r));
  console.log(`\nTotal: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('======================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('E2E test error:', err);
  process.exit(1);
});