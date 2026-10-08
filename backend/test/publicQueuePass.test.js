const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const OpdQueueEntry = require('../models/OpdQueueEntry');
const { publicPass } = require('../controllers/queueController');
const code = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

async function serverFor(t, entry, fail = false) {
  t.mock.method(OpdQueueEntry, 'findOne', () => ({ lean: async () => {
    if (fail) throw new Error('database unavailable');
    return entry;
  } }));
  const app = express();
  app.get('/api/v1/public/queue-pass/:passCode', publicPass);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}/api/v1/public/queue-pass/`;
}

test('a scanned pass loads HTML without requiring login', async t => {
  const base = await serverFor(t, { tokenNumber: 7, department: 'Cardiology', doctorName: '<img src=x onerror=alert(1)>', room: '304', queueDate: '2026-10-08', status: 'waiting' });
  const response = await fetch(base + code);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const html = await response.text();
  assert.match(html, /A-007/);
  assert.match(html, /Cardiology/);
  assert.match(html, /304/);
  assert.match(html, /&lt;img/);
  assert.ok(!html.includes('<img'));
});

test('invalid and missing passes return readable error pages', async t => {
  const base = await serverFor(t, null);
  for (const [value, status, title] of [['invalid', 400, 'Invalid queue pass'], [code, 404, 'Queue pass not found']]) {
    const response = await fetch(base + value);
    assert.equal(response.status, status);
    const html = await response.text();
    assert.match(html, /<!doctype html>/);
    assert.ok(html.includes(title));
    assert.match(html, /Refresh pass/);
  }
});

test('a database outage shows retry instructions rather than raw JSON', async t => {
  const base = await serverFor(t, null, true);
  const response = await fetch(base + code);
  assert.equal(response.status, 503);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(await response.text(), /temporarily unavailable/);
});

test('a cancelled pass clearly identifies its closed status', async t => {
  const base = await serverFor(t, { tokenNumber: 7, status: 'cancelled' });
  const response = await fetch(base + code);
  const html = await response.text();
  assert.match(html, /Queue pass closed/);
  assert.ok(!html.includes('Queue pass verified'));
});
