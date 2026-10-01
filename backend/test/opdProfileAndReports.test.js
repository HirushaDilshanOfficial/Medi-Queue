const test = require('node:test');
const assert = require('node:assert/strict');

const OpdPatientProfile = require('../models/OpdPatientProfile');
const OpdMedicalReport = require('../models/OpdMedicalReport');
const {
  buildProfilePatch,
  buildReportPatch,
  toProfileDto,
} = require('../controllers/patientController');

const OID = '507f1f77bcf86cd799439012';
const OID2 = '507f1f77bcf86cd799439013';

function validate(Model, doc) {
  const result = new Model(doc).validateSync();
  return result ? result.message : null;
}

function validProfile(overrides = {}) {
  return { user: OID, fullName: 'Nimal Perera', ...overrides };
}

function validReport(overrides = {}) {
  return { profile: OID, title: 'Full blood count', ...overrides };
}

// --- profile editing -------------------------------------------------------

test('profile patch accepts a normal self-service update', () => {
  const { patch, error } = buildProfilePatch({
    phone: '0771234567',
    email: 'Nimal@Example.COM',
    gender: 'Male',
    bloodGroup: 'o+',
    allergies: ['Penicillin', 'Dust'],
    remindersEnabled: false,
  });
  assert.equal(error, undefined);
  assert.equal(patch.phone, '0771234567');
  // Email is stored lower-case and blood group upper-case, so the same value
  // cannot end up stored two different ways.
  assert.equal(patch.email, 'nimal@example.com');
  assert.equal(patch.gender, 'male');
  assert.equal(patch.bloodGroup, 'O+');
  assert.deepEqual(patch.allergies, ['Penicillin', 'Dust']);
  assert.equal(patch.remindersEnabled, false);
});

test('profile patch only returns fields the client actually sent', () => {
  // A PATCH on a partially filled profile must not blank out everything the
  // client left out, so absent keys must not appear in the patch at all.
  const { patch } = buildProfilePatch({ phone: '0771234567' });
  assert.deepEqual(Object.keys(patch), ['phone']);
});

test('profile patch refuses fields the patient must not change', () => {
  // `user` and `patient` are link columns owned by the middleware, and `nic` is
  // the key used to attach this profile to a receptionist record. Allowing any of
  // them would let a patient re-point their identity at someone else's data.
  for (const field of ['user', 'patient', 'nic', 'fullName', 'isAdmin']) {
    const { error } = buildProfilePatch({ [field]: 'x' });
    assert.ok(error, `expected ${field} to be rejected`);
    assert.match(error, /Cannot change/);
  }
});

test('profile patch validates a birthday', () => {
  assert.equal(buildProfilePatch({ birthday: '1990-05-04' }).patch.birthday instanceof Date, true);
  // A future date is a typo rather than a real birthday.
  const future = new Date(Date.now() + 86400000).toISOString();
  assert.match(buildProfilePatch({ birthday: future }).error, /past date/);
  assert.match(buildProfilePatch({ birthday: 'not-a-date' }).error, /past date/);
});

test('profile patch rejects enum values outside the schema', () => {
  assert.match(buildProfilePatch({ gender: 'unknown' }).error, /male, female or other/);
  assert.match(buildProfilePatch({ bloodGroup: 'Z+' }).error, /blood group/);
  // Clearing a field is allowed and stored as null.
  assert.equal(buildProfilePatch({ gender: null }).patch.gender, null);
  assert.equal(buildProfilePatch({ bloodGroup: '' }).patch.bloodGroup, null);
});

test('profile patch rejects a malformed email and a non-boolean reminder flag', () => {
  assert.match(buildProfilePatch({ email: 'nimal@' }).error, /email/);
  assert.match(buildProfilePatch({ remindersEnabled: 'yes' }).error, /true or false/);
  // Clearing the address must be possible.
  assert.equal(buildProfilePatch({ email: null }).patch.email, null);
});

test('profile patch bounds free-text and list fields', () => {
  assert.match(buildProfilePatch({ address: 'x'.repeat(201) }).error, /too long/);
  assert.match(buildProfilePatch({ allergies: new Array(21).fill('a') }).error, /up to 20/);
  assert.match(buildProfilePatch({ allergies: 'Penicillin' }).error, /list/);
  // Blank strings collapse to null rather than being stored as "".
  assert.equal(buildProfilePatch({ address: '   ' }).patch.address, null);
});

test('profile patch cleans the emergency contact object', () => {
  const { patch } = buildProfilePatch({
    emergencyContact: { name: '  Kamala ', relationship: 'Mother', phone: '0779998887' },
  });
  assert.deepEqual(patch.emergencyContact, {
    name: 'Kamala',
    relationship: 'Mother',
    phone: '0779998887',
  });
  // An all-empty object clears the contact instead of storing a blank row.
  assert.equal(buildProfilePatch({ emergencyContact: { name: '', phone: '' } }).patch.emergencyContact, null);
  assert.match(buildProfilePatch({ emergencyContact: 'Kamala' }).error, /not valid/);
});

test('profile patch rejects non-objects', () => {
  for (const body of [null, undefined, 'nimal', 42, ['phone']]) {
    assert.match(buildProfilePatch(body).error, /JSON object/);
  }
});

test('profile patch with an empty body is not an error', () => {
  const { patch, error } = buildProfilePatch({});
  assert.equal(error, undefined);
  assert.deepEqual(patch, {});
});

// --- report upload metadata ----------------------------------------------

test('report requires a title and validates its own shape', () => {
  assert.match(validate(OpdMedicalReport, { profile: OID }), /title/);
  assert.equal(validate(OpdMedicalReport, validReport()), null);
  assert.equal(validate(OpdMedicalReport, validReport({ notes: 'x'.repeat(501) })) !== null, true);
  assert.equal(validate(OpdMedicalReport, validReport({ title: 'x'.repeat(121) })) !== null, true);
});

test('report patch accepts a patient lodgement', () => {
  const { patch, error } = buildReportPatch({
    title: 'Chest X-ray',
    category: 'Imaging',
    reportDate: '2026-03-04',
    notes: 'Reported a dry cough.',
    fileName: 'xray-2026-03-04.pdf',
  });
  assert.equal(error, undefined);
  assert.equal(patch.title, 'Chest X-ray');
  assert.equal(patch.category, 'Imaging');
  assert.equal(patch.reportDate instanceof Date, true);
});

test('report patch defaults a blank category to General', () => {
  assert.equal(buildReportPatch({ title: 'Scan', category: '  ' }).patch.category, 'General');
  assert.equal(buildReportPatch({ title: 'Scan' }).patch.category, undefined);
});

test('report patch refuses to let a patient mark their own report reviewed', () => {
  // `status` is set by staff. Accepting it here would let a patient fabricate the
  // impression a doctor had already looked at their results.
  for (const field of ['status', 'profile', '_id']) {
    const { error } = buildReportPatch({ title: 'Scan', [field]: 'reviewed' });
    assert.ok(error, `expected ${field} to be rejected`);
    assert.match(error, /Cannot set/);
  }
});

test('report patch validates the optional visit link shape', () => {
  const { patch } = buildReportPatch({ title: 'Scan', appointmentId: OID2 });
  assert.equal(patch.appointmentId, OID2);
  // A well-formed id that belongs to another patient passes the shape check and
  // is caught by the ownership query in the controller.
  assert.match(buildReportPatch({ title: 'Scan', appointmentId: 'nope' }).error, /not valid/);
  // Null clears the link rather than failing.
  assert.equal(buildReportPatch({ title: 'Scan', appointmentId: null }).patch.appointmentId, undefined);
});

test('report patch requires a title and bounds its text', () => {
  // Unlike a profile PATCH, a report with no title has nothing to show, so an
  // empty body is rejected rather than treated as a no-op.
  assert.match(buildReportPatch({}).error, /title/);
  assert.match(buildReportPatch({ title: '   ' }).error, /title/);
  assert.match(buildReportPatch({ title: 'Scan', notes: 'x'.repeat(501) }).error, /too long/);
  assert.match(buildReportPatch({ title: 'Scan', fileName: 'x'.repeat(161) }).error, /too long/);
  assert.match(buildReportPatch({ title: 'Scan', reportDate: 'nope' }).error, /not a valid date/);
});

// --- DTO -------------------------------------------------------------------

test('profile DTO reports age and hides an absent birthday', () => {
  const withBirthday = toProfileDto({
    _id: OID,
    fullName: 'Nimal Perera',
    birthday: new Date('1990-05-04T00:00:00.000Z'),
  });
  assert.equal(typeof withBirthday.age, 'number');
  assert.ok(withBirthday.age > 30, `expected an adult age, got ${withBirthday.age}`);
  assert.equal(withBirthday.birthday, '1990-05-04T00:00:00.000Z');

  // Optional fields must be null, never undefined, so the client can rely on
  // the shape without optional chaining everywhere.
  const bare = toProfileDto({ _id: OID, fullName: 'Nimal Perera' });
  assert.equal(bare.birthday, null);
  assert.equal(bare.age, null);
  assert.equal(bare.nic, null);
  assert.equal(bare.gender, null);
  assert.equal(bare.bloodGroup, null);
  assert.deepEqual(bare.allergies, []);
  assert.equal(bare.emergencyContact, null);
  assert.equal(bare.remindersEnabled, true);
});

test('profile model still accepts the values the edit screen writes', () => {
  // The validator and the schema have to agree, or a valid patch would be
  // rejected at the database boundary with a confusing error.
  const { patch } = buildProfilePatch({
    phone: '0771234567',
    email: 'nimal@example.com',
    gender: 'female',
    bloodGroup: 'AB+',
    allergies: ['Penicillin'],
    emergencyContact: { name: 'Kamala', relationship: 'Mother', phone: '0779998887' },
    birthday: '1990-05-04',
  });

  assert.equal(
    validate(
      OpdPatientProfile,
      validProfile({
        phone: patch.phone,
        email: patch.email,
        gender: patch.gender,
        bloodGroup: patch.bloodGroup,
        allergies: patch.allergies,
        emergencyContact: patch.emergencyContact,
        birthday: patch.birthday,
      }),
    ),
    null,
  );
});

test('report model accepts every value the upload form writes', () => {
  const { patch } = buildReportPatch({
    title: 'CT scan',
    category: 'Imaging',
    reportDate: '2026-02-01',
    performedOn: '2026-01-31',
    notes: 'Mild finding.',
    fileName: 'ct.pdf',
  });

  assert.equal(
    validate(
      OpdMedicalReport,
      validReport({
        title: patch.title,
        category: patch.category,
        reportDate: patch.reportDate,
        performedOn: patch.performedOn,
        notes: patch.notes,
        fileName: patch.fileName,
      }),
    ),
    null,
  );
});
