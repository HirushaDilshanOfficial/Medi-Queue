const mongoose = require('mongoose');
const { options, ref, text, endAfterStart } = require('./receptionistFields');

const scheduleSchema = new mongoose.Schema({
  doctor: ref('Doctor'),
  department: text(),
  room: text(30),
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true, validate: { validator: endAfterStart, message: 'Schedule end must be after its start.' } },
  status: { type: String, enum: ['scheduled', 'cancelled', 'completed'], default: 'scheduled', required: true },
}, options);

scheduleSchema.index({ doctor: 1, startsAt: 1 }, { unique: true });
module.exports = mongoose.model('Schedule', scheduleSchema);
