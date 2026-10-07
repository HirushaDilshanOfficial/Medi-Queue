const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema(
  {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    specialization: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    room: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'on_break', 'offline'],
      default: 'offline',
    },
    dailyCapacity: {
      type: Number,
      default: 30,
    },
    avgConsultMinutes: {
      type: Number,
      default: 10,
    },
    workingHours: {
      start: { type: String, default: '08:00' },
      end: { type: String, default: '16:30' },
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
    },
    hospitalName: {
      type: String,
      trim: true,
      default: 'Colombo Teaching Hospital 1',
    },
  },
  {
    timestamps: true,
  }
);

// Index for filtering doctors by department and status
doctorSchema.index({ department: 1, status: 1 });

module.exports = mongoose.model('Doctor', doctorSchema);
