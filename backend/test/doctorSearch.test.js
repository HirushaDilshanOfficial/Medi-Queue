const test = require('node:test');
const assert = require('node:assert/strict');
const sift = require('sift').default;
const Doctor = require('../models/Doctor');
const Hospital = require('../models/Hospital');
const Staff = require('../models/Staff');
const Appointment = require('../models/Appointment');
const { listDoctors } = require('../controllers/doctorController');

const hospitalA = '507f1f77bcf86cd799439011';
const hospitalB = '507f1f77bcf86cd799439012';
const inactiveHospital = '507f1f77bcf86cd799439013';
const rows = [
  { _id: 'aruna', name: 'Dr. Aruna Perera', specialization: 'Orthopedic Surgeon', department: 'Orthopaedic', hospital: hospitalA },
  { _id: 'chathura', name: 'Dr. Chathura Silva', specialization: 'General Physician', department: 'General OPD', hospital: hospitalA },
  { _id: 'dilani', name: 'Dr. Dilani Jayasuriya', specialization: 'Pediatrician', department: 'Pediatrics', hospital: hospitalB },
  { _id: 'regex', name: 'Dr. Regex.*', specialization: 'ENT Specialist', department: 'ENT (Adults)', hospital: hospitalA },
  { _id: 'legacy', name: 'Dr. Legacy Perera', specialization: 'General Physician', department: 'General OPD', staffId: 'staff-a' },
  { _id: 'inactive', name: 'Dr. Hidden Perera', specialization: 'General Physician', department: 'General OPD', hospital: inactiveHospital },
];

function stub(t) {
  t.mock.method(Hospital, 'find', () => ({ select: () => ({ lean: async () => [{ _id: hospitalA }, { _id: hospitalB }] }) }));
  t.mock.method(Staff, 'find', query => ({ distinct: async () => query.hospital === hospitalA ? ['staff-a'] : [] }));
  t.mock.method(Doctor, 'find', filter => ({ sort: () => ({ lean: async () => rows.filter(sift(filter)) }) }));
  t.mock.method(Appointment, 'aggregate', async () => []);
}
async function search(query) {
  const response = await new Promise((resolve, reject) => {
    listDoctors({ query }, { json: resolve }, reject);
  });
  return response.map(doctor => doctor._id);
}

test('search finds names, specialties and departments irrespective of case or word order', async t => {
  stub(t);
  assert.deepEqual(await search({ search: '  PERERA   aruna  ' }), ['aruna']);
  assert.deepEqual(await search({ search: 'orthopedic' }), ['aruna']);
  assert.deepEqual(await search({ search: 'general OPD chathura' }), ['chathura']);
  assert.deepEqual(await search({ search: 'no matching doctor' }), []);
});

test('search and exact department selection treat regex punctuation literally', async t => {
  stub(t);
  assert.deepEqual(await search({ search: '.*' }), ['regex']);
  assert.deepEqual(await search({ search: '[' }), []);
  assert.deepEqual(await search({ department: 'ENT (Adults)', search: 'specialist' }), ['regex']);
  assert.deepEqual(await search({ department: '.*' }), []);
});

test('hospital filters keep their scope when searching, including legacy staff links', async t => {
  stub(t);
  assert.deepEqual(await search({ hospitalId: hospitalA, search: 'Perera' }), ['aruna', 'legacy']);
  assert.deepEqual(await search({ hospitalId: hospitalA, search: 'Pediatrician' }), []);
  assert.deepEqual(await search({ hospitalId: inactiveHospital, search: 'Perera' }), []);
});

test('clearing the query restores the active hospital directory', async t => {
  stub(t);
  assert.deepEqual(await search({ search: '   ' }), ['aruna', 'chathura', 'dilani', 'regex']);
  assert.deepEqual(await search({ hospitalId: hospitalA, department: 'General OPD', search: '' }), ['chathura', 'legacy']);
});
