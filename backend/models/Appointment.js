const mongoose = require('mongoose');

const ACTIVE_STATUSES = ['booked', 'checked_in', 'in_consultation'];

const appointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: String, // "YYYY-MM-DD" — keeps daily queries and indexes simple
      required: true,
    },
    slotTime: {
      type: String, // "HH:mm"
      required: true,
    },
    type: {
      type: String,
      enum: ['walk_in', 'pre_booked'],
      required: true,
    },
    status: {
      type: String,
      enum: [
        'booked',
        'checked_in',
        'in_consultation',
        'completed',
        'no_show',
        'cancelled',
      ],
      default: 'booked',
    },
    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    priority: { type: String, enum: ['urgent', 'senior', 'normal'], default: 'normal' },
    tokenNumber: {
      type: Number,
    },
    notes: {
      type: String,
      trim: true,
    },
    // Computed flag for the unique partial index — set automatically via pre-save
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Keep isActive in sync with status before every save
appointmentSchema.pre('save', function (next) {
  this.isActive = ACTIVE_STATUSES.includes(this.status);
  next();
});

// Also sync on findOneAndUpdate / updateOne / updateMany
appointmentSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function (next) {
  const update = this.getUpdate();
  if (update && update.status !== undefined) {
    this.set({ isActive: ACTIVE_STATUSES.includes(update.status) });
  }
  if (update && update.$set && update.$set.status !== undefined) {
    if (!update.$set) update.$set = {};
    update.$set.isActive = ACTIVE_STATUSES.includes(update.$set.status);
  }
  next();
});

// Double-booking protection: only one active appointment per doctor + date + slot
appointmentSchema.index(
  { doctor: 1, date: 1, slotTime: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

// Fast lookups by date + status (e.g. today's queue)
appointmentSchema.index({ date: 1, status: 1 });

// Fast lookups by patient
appointmentSchema.index({ patient: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
