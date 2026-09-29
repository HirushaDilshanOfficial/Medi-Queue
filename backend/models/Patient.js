const mongoose = require('mongoose');
const { options, ref, text } = require('./receptionistFields');

const patientSchema = new mongoose.Schema({
  // A walk-in patient does not need a login account.
  user: ref('User', false),
  fullName: text(120),
  nic: { type: String, trim: true, uppercase: true, match: [/^(\d{12}|\d{9}[VX])$/, 'NIC must contain 12 digits or 9 digits followed by V/X.'] },
  dateOfBirth: {
    type: Date, required: true,
    validate: { validator: value => value <= new Date() && value >= new Date('1900-01-01T00:00:00Z'), message: 'Date of birth must be between 1900-01-01 and today.' },
  },
  gender: { type: String, required: true, enum: ['female', 'male', 'other', 'unspecified'] },
  phone: { type: String, trim: true, required: true, match: [/^(0[1-9]\d{8}|\+94[1-9]\d{8})$/, 'Enter a local 10-digit or +94 phone number.'] },
  address: { type: String, trim: true, maxlength: 300 },
}, options);

// Optional identifiers: patients without an NIC/account are allowed.
patientSchema.index({ nic: 1 }, { unique: true, partialFilterExpression: { nic: { $type: 'string' } } });
patientSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { user: { $type: 'objectId' } } });
patientSchema.index({ fullName: 1 });
module.exports = mongoose.model('Patient', patientSchema);
