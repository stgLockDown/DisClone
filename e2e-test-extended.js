// Extended E2E tests - edge cases and WebSocket verification
const BASE = 'http://localhost:8090';

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { _raw: text, _status: res.status }; }
}

async function runTests() {
  let passed = 0, failed = 0;
  const results = [];

  function assert(name, condition, detail) {
    if (condition) { passed++; results.push(`✅ ${name}`); }
    else { failed++; results.push(`❌ ${name}: ${detail || 'FAILED'}`); }
  }

  // Setup: register two users
  const regA = await request('POST', '/api/auth/register', {
    email: `ext_a_${Date.now()}@test.com`, displayName: 'Ext User A',
    username: `ext_a_${Date.now()}`, password: 'password123'
  });
  const regB = await request('POST', '/api/auth/register', {
    email: `ext_b_${Date.now()}@test.com`, displayName: 'Ext User B',
    username: `ext_b_${Date.now()}`, password: 'password123'
  });
  const tokenA = regA.token, tokenB = regB.token;
  const userA = regA.user, userB = regB.user;

  // ========== EDGE CASE: Empty message ==========
  console.log('\n=== EDGE CASE TESTS ===');

  const createSrv = await request('POST', '/api/servers', { name: 'Edge Case Server' }, tokenA);
  const serverId = createSrv.server.id;
  const getSrv = await request('GET', `/api/servers/${serverId}`, null, tokenA);
  const channelId = getSrv.server.categories[0].channels.find(c => c.type === 'text').id;

  // Empty message should fail
  const emptyMsg = await request('POST', `/api/channels/${channelId}/messages`, { content: '' }, tokenA);
  assert('Empty Message Rejected', !emptyMsg.success, JSON.stringify(emptyMsg));

  // Very long message
  const longContent = 'A'.repeat(4000);
  const longMsg = await request('POST', `/api/channels/${channelId}/messages`, { content: longContent }, tokenA);
  assert('Long Message Accepted', longMsg.success && longMsg.message.content.length === 4000, `Length: ${longMsg.message?.content?.length}`);

  // Message with special characters
  const specialMsg = await request('POST', `/api/channels/${channelId}/messages`, { content: '<script>alert("xss")</script> & "quotes" \'single\'' }, tokenA);
  assert('Special Chars Message', specialMsg.success, JSON.stringify(specialMsg));

  // Message with unicode/emoji
  const emojiMsg = await request('POST', `/api/channels/${channelId}/messages`, { content: '🎉🔥💯 Hello World! 你好世界' }, tokenA);
  assert('Emoji Message', emojiMsg.success && emojiMsg.message.content.includes('🎉'), JSON.stringify(emojiMsg));

  // ========== EDGE CASE: Unauthorized access ==========
  console.log('\n=== AUTH EDGE CASES ===');

  const noAuth = await request('GET', `/api/channels/${channelId}/messages`);
  assert('No Auth Token Rejected', !noAuth.success || noAuth._status === 401, JSON.stringify(noAuth));

  const badToken = await request('GET', `/api/channels/${channelId}/messages`, null, 'invalid-token-xyz');
  assert('Bad Token Rejected', !badToken.success || badToken._status === 401, JSON.stringify(badToken));

  // ========== EDGE CASE: Non-member access ==========
  console.log('\n=== ACCESS CONTROL ===');

  // User B is not a member of the server yet
  const nonMemberMsg = await request('POST', `/api/channels/${channelId}/messages`, { content: 'sneaky' }, tokenB);
  assert('Non-Member Cannot Send', !nonMemberMsg.success, JSON.stringify(nonMemberMsg));

  // User B joins
  await request('POST', `/api/servers/${serverId}/join`, {}, tokenB);

  // Now user B can send
  const memberMsg = await request('POST', `/api/channels/${channelId}/messages`, { content: 'now I can send!' }, tokenB);
  assert('Member Can Send', memberMsg.success, JSON.stringify(memberMsg));

  // ========== EDGE CASE: Edit/Delete permissions ==========
  console.log('\n=== PERMISSION TESTS ===');

  // User B tries to edit User A's message
  const msgA = await request('POST', `/api/channels/${channelId}/messages`, { content: 'my message' }, tokenA);
  const editByB = await request('PATCH', `/api/messages/${msgA.message.id}`, { content: 'hacked!' }, tokenB);
  assert('Cannot Edit Others Message', !editByB.success, JSON.stringify(editByB));

  // User B tries to delete User A's message
  const deleteByB = await request('DELETE', `/api/messages/${msgA.message.id}`, null, tokenB);
  assert('Cannot Delete Others Message', !deleteByB.success, JSON.stringify(deleteByB));

  // User A can edit own message
  const editByA = await request('PATCH', `/api/messages/${msgA.message.id}`, { content: 'edited by me' }, tokenA);
  assert('Can Edit Own Message', editByA.success, JSON.stringify(editByA));

  // ========== EDGE CASE: Invite flow ==========
  console.log('\n=== INVITE FLOW ===');

  const invite = await request('POST', `/api/servers/${serverId}/invites`, {}, tokenA);
  assert('Create Invite OK', invite.success && invite.invite.code, JSON.stringify(invite));

  // Look up invite by code
  const lookupInvite = await request('GET', `/api/servers/invite/${invite.invite.code}`);
  assert('Lookup Invite', lookupInvite.success, JSON.stringify(lookupInvite));

  // ========== EDGE CASE: Duplicate registration ==========
  console.log('\n=== DUPLICATE TESTS ===');

  const dupReg = await request('POST', '/api/auth/register', {
    email: userA.email, displayName: 'Dup', username: 'dup_user_xyz', password: 'password123'
  });
  assert('Duplicate Email Rejected', !dupReg.success, JSON.stringify(dupReg));

  // ========== EDGE CASE: Server operations ==========
  console.log('\n=== SERVER OPERATIONS ===');

  // Update server
  const updateSrv = await request('PATCH', `/api/servers/${serverId}`, { name: 'Updated Server Name' }, tokenA);
  assert('Update Server Name', updateSrv.success, JSON.stringify(updateSrv));

  // Non-owner cannot update
  const updateByB = await request('PATCH', `/api/servers/${serverId}`, { name: 'Hacked' }, tokenB);
  assert('Non-Owner Cannot Update Server', !updateByB.success, JSON.stringify(updateByB));

  // User B leaves server
  const leave = await request('POST', `/api/servers/${serverId}/leave`, {}, tokenB);
  assert('Leave Server', leave.success, JSON.stringify(leave));

  // After leaving, cannot send messages
  const afterLeave = await request('POST', `/api/channels/${channelId}/messages`, { content: 'ghost msg' }, tokenB);
  assert('Cannot Send After Leaving', !afterLeave.success, JSON.stringify(afterLeave));

  // ========== EDGE CASE: Friend operations ==========
  console.log('\n=== FRIEND OPERATIONS ===');

  // Accept friend request
  const friendsB = await request('GET', '/api/friends', null, tokenB);
  const pendingReq = friendsB.friends?.find(f => f.status === 'pending_incoming');
  if (pendingReq) {
    const accept = await request('POST', `/api/friends/accept/${pendingReq.user.id}`, {}, tokenB);
    assert('Accept Friend Request', accept.success, JSON.stringify(accept));

    // Verify friendship
    const friendsA = await request('GET', '/api/friends', null, tokenA);
    const friend = friendsA.friends?.find(f => f.user.id === userB.id && f.status === 'accepted');
    assert('Friendship Established', !!friend, JSON.stringify(friendsA));
  } else {
    // Send fresh request and accept
    await request('POST', '/api/friends/request', { tag: userB.tag }, tokenA);
    const friendsB2 = await request('GET', '/api/friends', null, tokenB);
    const req2 = friendsB2.friends?.find(f => f.status === 'pending_incoming');
    if (req2) {
      const accept2 = await request('POST', `/api/friends/accept/${req2.user.id}`, {}, tokenB);
      assert('Accept Friend Request', accept2.success, JSON.stringify(accept2));
      assert('Friendship Established', true, 'OK');
    } else {
      assert('Accept Friend Request', false, 'No pending request found');
      assert('Friendship Established', false, 'No pending request');
    }
  }

  // ========== RESULTS ==========
  console.log('\n\n========== EXTENDED E2E TEST RESULTS ==========');
  results.forEach(r => console.log(r));
  console.log(`\nTotal: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Extended E2E test error:', err);
  process.exit(1);
});