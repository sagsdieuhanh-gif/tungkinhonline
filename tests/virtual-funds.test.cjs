'use strict';
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const port = String(15000 + Math.floor(Math.random() * 2000));
const base = 'http://127.0.0.1:' + port;
const server = spawn(process.execPath, ['server.js'], {
  cwd: process.cwd(), env: { ...process.env, PORT: port, ADMIN_PASSWORD: 'TEST_ONLY_CHANGE_ME', ENABLE_TTS: '0', TIKTOK_USER: '' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let output = '';
server.stdout.on('data', b => output += b.toString());
server.stderr.on('data', b => output += b.toString());
async function request(route, body, cookie) {
  const res = await fetch(base + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data, headers: res.headers };
}
const nameA = { sessionId: 'a'.repeat(32), name: 'Minh Tam' };
const nameB = { sessionId: 'b'.repeat(32), name: 'Dieu An' };

async function main() {
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try { if ((await request('/api/virtual/status')).status === 200) { ready = true; break; } } catch {}
      await delay(180);
    }
    assert.ok(ready, 'Server failed to start: ' + output);
    assert.equal((await request('/api/virtual/status')).data.envelope, null);
    assert.equal((await request('/api/virtual/envelope/create', { total: 500 })).status, 401);

    const login = await request('/auth/login', { password: 'TEST_ONLY_CHANGE_ME' });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie, 'Admin signed cookie required');
    assert.equal((await request('/api/virtual/envelope/create', { total: -50 }, cookie)).status, 400);
    assert.equal((await request('/api/virtual/envelope/create', { total: 500 }, cookie)).status, 200);
    assert.equal((await request('/api/virtual/envelope/create', { total: 100 }, cookie)).status, 409);

    assert.equal((await request('/api/virtual/claim', { sessionId: nameA.sessionId })).status, 403);
    assert.equal((await request('/api/visitors/join', nameA)).status, 200);
    assert.equal((await request('/api/visitors/join', nameB)).status, 200);
    const [c1, c2] = await Promise.all([
      request('/api/virtual/claim', { sessionId: nameA.sessionId }),
      request('/api/virtual/claim', { sessionId: nameA.sessionId })
    ]);
    assert.deepEqual([c1.status, c2.status].sort(), [200, 409], 'Double-claim protection');
    const first = c1.status === 200 ? c1.data : c2.data;
    assert.ok(first.amount >= 1 && first.amount <= 150, 'Random amount cap 30%');
    assert.equal((await request('/api/virtual/claim', { sessionId: nameA.sessionId })).status, 409);
    const second = await request('/api/virtual/claim', { sessionId: nameB.sessionId });
    assert.equal(second.status, 200);
    assert.ok(second.data.amount >= 1);
    assert.equal(second.data.envelope.remaining, 500 - first.amount - second.data.amount);
    const accountA = await request('/api/virtual/me', { sessionId: nameA.sessionId });
    assert.equal(accountA.data.balance, first.amount);
    assert.equal(accountA.data.alreadyClaimed, true);

    const freeBow = await request('/api/virtual/ritual', { sessionId: nameA.sessionId, ritual: 'bow' });
    assert.equal(freeBow.status, 200);
    assert.equal(freeBow.data.balance, first.amount);
    assert.equal(freeBow.data.event.type, 'bowToBuddha');
    await delay(1650);
    const lotus = await request('/api/virtual/ritual', { sessionId: nameA.sessionId, ritual: 'lotus' });
    if (first.amount >= 20) {
      assert.equal(lotus.status, 200);
      assert.equal(lotus.data.balance, first.amount - 20);
      assert.equal(lotus.data.event.type, 'offerGift');
      assert.equal(lotus.data.event.coins, 0, 'No TikTok coins spent');
    } else assert.equal(lotus.status, 409, 'Cannot spend without balance');
    await delay(1650);
    assert.equal((await request('/api/virtual/ritual', { sessionId: nameA.sessionId, ritual: 'unknown' })).status, 400);

    const stop = await request('/api/virtual/envelope/close', {}, cookie);
    assert.equal(stop.status, 200);
    assert.equal(stop.data.envelope.active, false);
    assert.equal((await request('/api/virtual/claim', { sessionId: nameB.sessionId })).status, 409);
    assert.equal((await request('/api/virtual/envelope/create', { total: 20 }, cookie)).status, 200);
    const newRound = await request('/api/virtual/claim', { sessionId: nameB.sessionId });
    assert.equal(newRound.status, 200, 'Each new round allows one claim');
    assert.ok(newRound.data.amount >= 1 && newRound.data.amount <= 6);
    console.log('PASS virtual envelopes: admin auth, random claims, limits, wallet, free/paid rituals, new rounds');
  } finally {
    server.kill('SIGTERM');
    await delay(250);
  }
}
main().catch(error => {
  console.error(error);
  console.error('Server log:', output.slice(-8000));
  process.exitCode = 1;
});
