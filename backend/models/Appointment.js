const mongoose = require('mongoose');
const { options, ref, dateKey } = require('./receptionistFields');

const appointmentSchema = new mongoose.Schema({
  patient: ref('Patient'),
  // Walk-ins may await allocation; online appointments require a doctor and slot.
  doctor: { ...ref('Doctor', false), required: function () { return this.source === 'online'; } },
  slot: { ...ref('Slot', false), required: function () { return this.source === 'online'; } },
  visitDate: dateKey(),
  source: { type: String, required: true, enum: ['online', 'walk_in'], immutable: true },
  status: { type: String, required: true, enum: ['booked', 'checked_in', 'completed', 'cancelled', 'no_show'], default: 'booked' },
  createdBy: ref('User'),
}, options);

appointmentSchema.index({ patient: 1, visitDate: -1 });
appointmentSchema.index({ doctor: 1, visitDate: 1, status: 1 });
appointmentSchema.index({ slot: 1, status: 1 });
module.exports = mongoose.model('Appointment', appointmentSchema);
