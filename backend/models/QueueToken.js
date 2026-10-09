const mongoose = require('mongoose');

const queueTokenSchema = new mongoose.Schema(
  {
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    department: {
      type: String,
      trim: true,
    },
    date: {
      type: String, // "YYYY-MM-DD"
      required: true,
    },
    tokenNumber: {
      type: Number,
      required: true,
    },
    tokenLabel: {
      type: String, // e.g. "OPD-035"
      required: true,
    },
    status: {
      type: String,
      enum: ['waiting', 'called', 'serving', 'done', 'no_show'],
      default: 'waiting',
    },
    priority: {
      type: String,
      enum: ['normal', 'senior', 'urgent'],
      default: 'normal',
    },
    assignedDoctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      default: null,
    },
    calledAt: {
      type: Date,
    },
    servedAt: {
      type: Date,
    },
    moveBackCount: {
      type: Number,
      default: 0,
    },
    sortOffset: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// One token number per department per date — prevents duplicate tokens
queueTokenSchema.index({ department: 1, date: 1, tokenNumber: 1 }, { unique: true });

// Fast queue listing filtered by department, date, status and priority
queueTokenSchema.index({ department: 1, date: 1, status: 1, priority: 1 });

module.exports = mongoose.model('QueueToken', queueTokenSchema);
