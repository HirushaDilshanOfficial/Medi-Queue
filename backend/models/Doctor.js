const mongoose = require('mongoose');
const { options, ref, text } = require('./receptionistFields');

const doctorSchema = new mongoose.Schema({
  user: { ...ref('User'), unique: true },
  registrationNumber: { ...text(40), uppercase: true, unique: true },
  specialty: text(),
  department: text(),
  isActive: { type: Boolean, default: true },
}, options);

module.exports = mongoose.model('Doctor', doctorSchema);
