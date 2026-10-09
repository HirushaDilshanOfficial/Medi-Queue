const test = require('node:test');
const assert = require('node:assert/strict');
const sift = require('sift').default;
const Appointment = require('../models/OpdAppointment');
const Report = require('../models/OpdMedicalReport');
const QueueEntry = require('../models/OpdQueueEntry');
const { getMyHistory } = require('../controllers/patientController');
const { cancelBooking } = require('../controllers/bookingController');
const { today } = require('../utils/opdQueue');

const profile = '507f1f77bcf86cd799439011';
const otherProfile = '507f1f77bcf86cd799439012';
const currentDate = today();
const offsetDate = offset => {
  const date = new Date(`${currentDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
const appointment = (id, status, offset, owner = profile) => ({
  _id: id, profile: owner, status, date: offsetDate(offset),
  doctorName: 'Dr. Test', department: 'General Medical', slotTime: '09:00',
});
function query(rows, filter) {
  let selected = rows.filter(sift(filter));
  const chain = {
    sort: () => { selected.sort((a, b) => b.date.localeCompare(a.date)); return chain; },
    limit: n => { selected = selected.slice(0, n); return chain; },
    lean: async () => selected,
  };
  return chain;
}
function stubHistory(t, appointments, reports = []) {
  t.mock.method(Appointment, 'find', filter => query(appointments, filter));
  t.mock.method(Report, 'find', filter => query(reports, filter));
}
async function history() {
  let body;
  await getMyHistory({ patientProfile: { _id: profile }, query: { profile: otherProfile } }, {
    json: value => { body = value; },
  }, error => { throw error; });
  return body;
}

test('future cancellations and visits completed today appear immediately', async t => {
  stubHistory(t, [appointment('cancelled', 'cancelled', 7), appointment('seen', 'completed', 0), appointment('missed', 'no_show', 0)]);
  const body = await history();
  assert.deepEqual(body.visits.map(visit => visit.id), ['cancelled', 'seen', 'missed']);
  assert.deepEqual(body.summary, { totalVisits: 1, cancelled: 1, noShow: 1, reports: 0 });
  assert.ok(body.visits.every(visit => !visit.canCancel && !visit.canReschedule && !visit.canCheckIn));
});

test('today and future active bookings stay out of history', async t => {
  stubHistory(t, [appointment('today', 'booked', 0), appointment('future', 'booked', 2), appointment('checked-in', 'checked_in', 0)]);
  assert.deepEqual((await history()).visits, []);
});

test('expired unattended bookings count as missed without changing stored statuses', async t => {
  const expired = appointment('expired', 'booked', -1);
  stubHistory(t, [expired, appointment('seen', 'completed', -2), appointment('cancelled', 'cancelled', -3)]);
  const body = await history();
  assert.equal(body.visits[0].status, 'no_show');
  assert.equal(body.summary.noShow, 1);
  assert.equal(expired.status, 'booked');
});

test('history never includes another patient appointments or reports', async t => {
  stubHistory(t, [appointment('own', 'cancelled', 3), appointment('other', 'cancelled', 3, otherProfile)], [
    { _id: 'other-report', profile: otherProfile, date: currentDate, title: 'Private report' },
  ]);
  const body = await history();
  assert.deepEqual(body.visits.map(visit => visit.id), ['own']);
  assert.deepEqual(body.reports, []);
});

test('cancelling a future booking makes it available in the next history request', async t => {
  const booking = appointment('507f1f77bcf86cd799439013', 'booked', 7);
  booking.save = async () => {};
  stubHistory(t, [booking]);
  t.mock.method(Appointment, 'findOne', async filter => sift(filter)(booking) ? booking : null);
  t.mock.method(QueueEntry, 'findOne', async () => null);
  assert.equal((await history()).visits.length, 0);
  let response;
  await cancelBooking({ patientProfile: { _id: profile }, params: { id: booking._id }, body: { reason: 'Cancelled by patient' } }, {
    json: value => { response = value; },
    status: () => { throw new Error('Unexpected cancellation failure'); },
  }, error => { throw error; });
  assert.equal(response.appointment.status, 'cancelled');
  const body = await history();
  assert.equal(body.summary.cancelled, 1);
  assert.equal(body.visits[0].id, booking._id);
});
