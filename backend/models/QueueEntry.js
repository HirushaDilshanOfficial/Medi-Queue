const mongoose = require('mongoose');
const { options, ref, text, dateKey, positiveInteger } = require('./receptionistFields');

const queueEntrySchema = new mongoose.Schema({
  appointment: { ...ref('Appointment'), unique: true },
  assignedDoctor: ref('Doctor', false),
  queueDate: dateKey(),
  department: text(),
  tokenNumber: positiveInteger(),
  priority: { type: String, enum: ['normal', 'urgent'], default: 'normal', required: true },
  status: { type: String, enum: ['waiting', 'called', 'in_consultation', 'completed', 'no_show', 'cancelled'], default: 'waiting', required: true },
  checkedInAt: { type: Date, default: Date.now, required: true },
  calledAt: {
    type: Date,
    required: function () { return ['called', 'in_consultation', 'completed'].includes(this.status); },
    validate: { validator: function (value) { return value == null || value >= this.checkedInAt; }, message: 'Call time cannot be before check-in.' },
  },
  completedAt: {
    type: Date, required: function () { return this.status === 'completed'; },
    validate: { validator: function (value) { return value == null || (this.calledAt != null && value >= this.calledAt); }, message: 'Completion time cannot be before call time.' },
  },
}, options);

queueEntrySchema.index({ department: 1, queueDate: 1, tokenNumber: 1 }, { unique: true });
queueEntrySchema.index({ department: 1, queueDate: 1, status: 1, priority: 1 });
module.exports = mongoose.model('QueueEntry', queueEntrySchema);
