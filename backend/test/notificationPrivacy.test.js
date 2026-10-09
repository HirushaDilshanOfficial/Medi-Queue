const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const sift = require('sift').default;
const Notification = require('../models/Notification');
const User = require('../models/User');
const routes = require('../routes/notificationRoutes');
const { errorHandler } = require('../utils/errorHandler');

const ids = { a: '507f1f77bcf86cd799439011', b: '507f1f77bcf86cd799439012', doctor: '507f1f77bcf86cd799439013', moh: '507f1f77bcf86cd799439014' };
const users = Object.fromEntries(Object.entries(ids).map(([key, _id]) => [_id, { _id, role: key === 'doctor' ? 'Doctor' : key === 'moh' ? 'MOH' : key === 'b' ? 'patient' : 'Patient' }]));
const docs = [
  { _id: 'own-a', recipient: ids.a, targetRole: 'Patient', kind: 'personal' },
  { _id: 'own-b', recipient: ids.b, targetRole: 'Patient', kind: 'personal' },
  { _id: 'mislabelled-private-b', recipient: ids.b, targetRole: 'All', kind: 'announcement' },
  { _id: 'hospital', recipient: null, targetRole: 'All', kind: 'announcement' },
  { _id: 'patient-announcement', recipient: null, targetRole: 'Patient', kind: 'announcement' },
  { _id: 'legacy-hospital', targetRole: 'All' },
  { _id: 'doctor-announcement', targetRole: 'Doctor' },
  { _id: 'orphan-personal', recipient: null, targetRole: 'Patient', kind: 'personal' },
].map(doc => ({ ...doc, title: doc._id, message: 'Message', sender: ids.moh, createdAt: new Date('2026-10-08') }));

async function api(t) {
  t.mock.method(User, 'findById', id => ({ select: async () => users[String(id)] || null }));
  t.mock.method(Notification, 'find', query => ({ sort: async () => docs.filter(sift(query)) }));
  const app = express();
  app.use(express.json()); app.use('/notifications', routes); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return async (user, suffix = '', body) => fetch(`http://127.0.0.1:${server.address().port}/notifications${suffix}`, {
    method: body ? 'POST' : 'GET',
    headers: { ...(user ? { Authorization: `Bearer ${jwt.sign({ id: ids[user] }, process.env.JWT_SECRET || 'fallback_secret')}` } : {}), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test('patient A sees only their own private notices and hospital announcements', async t => {
  const request = await api(t);
  const response = await request('a');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-notification-user'), ids.a);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await response.json()).map(doc => doc._id), ['own-a', 'hospital', 'patient-announcement', 'legacy-hospital']);
});

test('lowercase patient role gets their own inbox without another patient’s notices', async t => {
  const request = await api(t);
  const response = await request('b');
  assert.deepEqual((await response.json()).map(doc => doc._id), ['own-b', 'mislabelled-private-b', 'hospital', 'patient-announcement', 'legacy-hospital']);
});

test('query parameters cannot impersonate another patient or widen the feed', async t => {
  const request = await api(t);
  const response = await request('a', `?recipient=${ids.b}&userId=${ids.b}&targetRole=All`);
  assert.deepEqual((await response.json()).map(doc => doc._id), ['own-a', 'hospital', 'patient-announcement', 'legacy-hospital']);
});

test('doctor announcements never include patient-private notices', async t => {
  const request = await api(t);
  const response = await request('doctor');
  assert.deepEqual((await response.json()).map(doc => doc._id), ['hospital', 'legacy-hospital', 'doctor-announcement']);
});

test('unauthenticated notification requests are rejected', async t => {
  const request = await api(t);
  assert.equal((await request(null)).status, 401);
});

test('a targeted patient message is saved as private even when All is requested', async t => {
  const request = await api(t);
  t.mock.method(Notification.prototype, 'save', async function () { return this; });
  const response = await request('moh', '', { title: 'Private', message: 'Your appointment', recipient: ids.b, targetRole: 'All' });
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert.equal(saved.recipient, ids.b);
  assert.equal(saved.kind, 'personal');
  assert.equal(saved.targetRole, 'Patient');
});

test('personal messages require a valid patient recipient and authorized sender', async t => {
  const request = await api(t);
  const body = { title: 'Private', message: 'Your appointment' };
  assert.equal((await request('moh', '', { ...body, kind: 'personal' })).status, 400);
  assert.equal((await request('moh', '', { ...body, recipient: ids.doctor })).status, 400);
  assert.equal((await request('moh', '', { ...body, recipient: 'invalid' })).status, 400);
  assert.equal((await request('a', '', { ...body, recipient: ids.b })).status, 403);
});

test('model validation rejects a personal notification without an owner', () => {
  const error = new Notification({ title: 'Private', message: 'Message', sender: ids.moh, kind: 'personal' }).validateSync();
  assert.ok(error.errors.recipient);
});
