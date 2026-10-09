const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const { nextTokenNumber } = require('../models/OpdQueueCounter');
const { getNextToken } = require('../utils/tokenGenerator');

test('sequential token allocation increments numbers predictably', async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/medi-queue-test';
  if (mongoose.connection.readyState === 0) {
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    } catch (e) {
      // Skip live Mongo assertion if DB server is offline during standalone unit testing
      return;
    }
  }

  try {
    const department = 'TestDepartment_' + Date.now();
    const queueDate = '2026-10-15';

    // 1. Initial token allocation via nextTokenNumber
    const tok1 = await nextTokenNumber(department, queueDate);

    // 2. Next token via getNextToken (department, date)
    const tok2 = await getNextToken(department, queueDate);

    // 3. Next token via getNextToken (date)
    const tok3 = await getNextToken(department, queueDate);

    // 4. Next token via nextTokenNumber
    const tok4 = await nextTokenNumber(department, queueDate);

    assert.equal(tok2.tokenNumber, tok1 + 1, `Expected token2 (${tok2.tokenNumber}) to be token1+1 (${tok1 + 1})`);
    assert.equal(tok3.tokenNumber, tok1 + 2, `Expected token3 (${tok3.tokenNumber}) to be token1+2 (${tok1 + 2})`);
    assert.equal(tok4, tok1 + 3, `Expected token4 (${tok4}) to be token1+3 (${tok1 + 3})`);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
});
