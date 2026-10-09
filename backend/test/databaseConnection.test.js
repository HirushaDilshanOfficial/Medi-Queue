const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function connectionHarness(errors = [], uri = 'mongodb+srv://example.invalid/app') {
  const attempts = [];
  const dnsServers = [];
  const exits = [];
  const connection = { connection: { host: 'database.example.invalid' } };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../config/db.js'), 'utf8'), {
    module,
    require: name => name === 'mongoose' ? {
      connect: async (value, options) => {
        attempts.push({ uri: value, options });
        const error = errors.shift();
        if (error) throw error;
        return connection;
      },
    } : { setServers: servers => dnsServers.push([...servers]) },
    process: { env: { MONGO_URI: uri }, exit: code => exits.push(code) },
    console: { log() {}, warn() {}, error() {} },
  });
  return { connect: module.exports, attempts, dnsServers, exits, connection };
}

const dnsError = () => Object.assign(new Error('querySrv ECONNREFUSED example.invalid'), { code: 'ECONNREFUSED' });

test('successful connection keeps the system DNS and uses configured URI', async () => {
  const harness = connectionHarness();
  assert.equal(await harness.connect(), harness.connection);
  assert.equal(harness.attempts.length, 1);
  assert.equal(harness.attempts[0].uri, 'mongodb+srv://example.invalid/app');
  assert.deepEqual(harness.dnsServers, []);
  assert.deepEqual(harness.exits, []);
});

test('temporary SRV failure falls back without changing database credentials', async () => {
  const harness = connectionHarness([dnsError(), dnsError()]);
  assert.equal(await harness.connect(), harness.connection);
  assert.deepEqual(harness.dnsServers, [['1.1.1.1'], ['8.8.8.8']]);
  assert.equal(harness.attempts.length, 3);
  assert.ok(harness.attempts.every(attempt => attempt.uri === harness.attempts[0].uri));
  assert.deepEqual(harness.exits, []);
});

test('DNS retries are bounded and genuine authentication failures are not retried', async () => {
  const exhausted = connectionHarness([dnsError(), dnsError(), dnsError()]);
  await exhausted.connect();
  assert.equal(exhausted.attempts.length, 3);
  assert.deepEqual(exhausted.exits, [1]);
  const unauthorized = connectionHarness([Object.assign(new Error('Authentication failed'), { code: 18 })]);
  await unauthorized.connect();
  assert.equal(unauthorized.attempts.length, 1);
  assert.deepEqual(unauthorized.dnsServers, []);
  assert.deepEqual(unauthorized.exits, [1]);
});

test('missing configuration fails before any database connection attempt', async () => {
  const harness = connectionHarness([], '');
  await harness.connect();
  assert.equal(harness.attempts.length, 0);
  assert.deepEqual(harness.exits, [1]);
});
