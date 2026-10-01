const mongoose = require('mongoose');
const { options, ref, positiveInteger, endAfterStart } = require('./receptionistFields');

const slotSchema = new mongoose.Schema({
  schedule: ref('Schedule'),
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true, validate: { validator: endAfterStart, message: 'Slot end must be after its start.' } },
  capacity: { ...positiveInteger(100), default: 1 },
  status: { type: String, enum: ['available', 'blocked'], default: 'available', required: true },
}, options);

slotSchema.index({ schedule: 1, startsAt: 1 }, { unique: true });
module.exports = mongoose.model('Slot', slotSchema);
