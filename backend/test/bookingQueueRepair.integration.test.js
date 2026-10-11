const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();
const Appointment = require('../models/OpdAppointment');
const Entry = require('../models/OpdQueueEntry');
const Counter = require('../models/OpdQueueCounter');
const { ensureBookingQueueEntry } = require('../utils/ensureBookingQueueEntry');

test('MongoDB: legacy token repair, parallel reads, cancellation, and moving a pass', {
  skip: process.env.RUN_BOOKING_DB_TESTS !== '1',
}, async () => {
  const department = `Booking regression ${new mongoose.Types.ObjectId()}`;
  const date = '2099-10-12';
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await Promise.all([Appointment.init(), Entry.init(), Counter.init()]);
    const doctor = new mongoose.Types.ObjectId();
    const makeBooking = tokenNumber => Appointment.create({
      profile: new mongoose.Types.ObjectId(), doctor, doctorName: 'Regression Doctor',
      department, date, slotTime: '09:00', tokenNumber,
    });
    const first = await makeBooking(1);
    const second = await makeBooking(1);
    await ensureBookingQueueEntry(first);
    const [a, b] = await Promise.all([ensureBookingQueueEntry(second), ensureBookingQueueEntry(second)]);
    assert.equal(String(a._id), String(b._id));
    assert.equal(await Entry.countDocuments({ department }), 2);
    assert.notEqual(a.tokenNumber, 1);

    a.status = 'cancelled';
    await a.save();
    await Counter.releaseTokenNumber(department, date, a.tokenNumber);
    const next = await Counter.nextTokenNumber(department, date);
    assert.ok(next > a.tokenNumber);
    second.date = '2099-10-13';
    await second.save();
    const moved = await ensureBookingQueueEntry(second);
    assert.equal(String(moved._id), String(a._id));
    assert.equal(moved.queueDate, second.date);
    assert.notEqual(moved.passCode, a.passCode);
    assert.equal(moved.status, 'waiting');
    const saved = await Appointment.findById(second._id);
    assert.equal(saved.tokenNumber, moved.tokenNumber);
    assert.equal(String(saved.queueEntry), String(moved._id));
  } finally {
    // Only remove this run's fixture records; never touch patient bookings.
    await Entry.deleteMany({ department });
    await Appointment.deleteMany({ department });
    await Counter.deleteMany({ department });
    await mongoose.disconnect();
  }
});
