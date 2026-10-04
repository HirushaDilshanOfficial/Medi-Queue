const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { errorHandler, asyncHandler, createError } = require('../utils/errorHandler');
const { searchPatients, getSlots, walkInBooking } = require('../controllers/walkInController');

test.after(async () => {
  await mongoose.disconnect();
});

function runThroughErrorHandler(err, initialStatusCode = 200) {
  let responseStatus = initialStatusCode;
  let responseBody = null;

  const res = {
    statusCode: initialStatusCode,
    status(code) {
      this.statusCode = code;
      responseStatus = code;
      return this;
    },
    json(data) {
      responseBody = data;
      this.body = data;
      return this;
    },
  };

  errorHandler(err, {}, res, () => {});
  return { status: responseStatus, body: responseBody };
}

test('errorHandler: consistent JSON shape { success: false, message, code }', () => {
  const err = new Error('Test generic error');
  const { status, body } = runThroughErrorHandler(err);

  assert.equal(status, 500);
  assert.equal(body.success, false);
  assert.equal(body.message, 'Test generic error');
  assert.equal(body.code, 500);
});

test('errorHandler: Mongoose ValidationError returns 400 and { success: false, message, code }', () => {
  const validationError = new mongoose.Error.ValidationError();
  validationError.addError(
    'department',
    new mongoose.Error.ValidatorError({ path: 'department', message: 'Department is required.' })
  );

  const { status, body } = runThroughErrorHandler(validationError);

  assert.equal(status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /Department is required/);
  assert.equal(body.code, 400);
});

test('errorHandler: Mongoose CastError (bad ObjectId) returns 400, not 500', () => {
  const castError = new mongoose.Error.CastError('ObjectId', 'bad-object-id', '_id');
  const { status, body } = runThroughErrorHandler(castError);

  assert.equal(status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /bad-object-id/);
  assert.equal(body.code, 400);
});

test('errorHandler: MongoDB 11000 duplicate key error returns 409', () => {
  const dupErr = Object.assign(new Error('E11000 duplicate key error'), { code: 11000 });
  const { status, body } = runThroughErrorHandler(dupErr);

  assert.equal(status, 409);
  assert.equal(body.success, false);
  assert.equal(body.code, 11000);
});

test('errorHandler: custom createError with status 404', () => {
  const err = createError('Doctor not found.', 404);
  const { status, body } = runThroughErrorHandler(err);

  assert.equal(status, 404);
  assert.equal(body.success, false);
  assert.equal(body.message, 'Doctor not found.');
  assert.equal(body.code, 404);
});

test('errorHandler: includes nextAvailableSlot and requestedSlot on slot conflict', () => {
  const conflictErr = createError('Slot was just taken, please choose the next slot', 409);
  conflictErr.requestedSlot = '09:00';
  conflictErr.nextAvailableSlot = '09:15';

  const { status, body } = runThroughErrorHandler(conflictErr);

  assert.equal(status, 409);
  assert.equal(body.success, false);
  assert.equal(body.message, 'Slot was just taken, please choose the next slot');
  assert.equal(body.code, 409);
  assert.equal(body.requestedSlot, '09:00');
  assert.equal(body.nextAvailableSlot, '09:15');
});

test('asyncHandler: wraps async functions and catches rejected promises into next(err)', async () => {
  let forwardedError = null;
  const wrapped = asyncHandler(async () => {
    throw new Error('Async failure test');
  });

  const next = (err) => {
    forwardedError = err;
  };

  wrapped({}, {}, next);

  // Give microtask tick to resolve Promise.catch
  await new Promise((resolve) => setImmediate(resolve));

  assert.ok(forwardedError);
  assert.equal(forwardedError.message, 'Async failure test');
});

test('walkInController handlers are wrapped in asyncHandler and catch input errors', async () => {
  // searchPatients query validation
  let caughtErr = null;
  await searchPatients({ query: { q: 'a' } }, {}, (err) => { caughtErr = err; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(caughtErr);
  assert.equal(caughtErr.statusCode, 400);
  assert.match(caughtErr.message, /at least 3 characters/);

  // getSlots missing doctorId
  caughtErr = null;
  await getSlots({ query: {} }, {}, (err) => { caughtErr = err; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(caughtErr);
  assert.equal(caughtErr.statusCode, 400);
  assert.match(caughtErr.message, /doctorId is required/);

  // walkInBooking missing department
  caughtErr = null;
  await walkInBooking({ body: {} }, {}, (err) => { caughtErr = err; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(caughtErr);
  assert.equal(caughtErr.statusCode, 400);
  assert.match(caughtErr.message, /Department is required/);
});
