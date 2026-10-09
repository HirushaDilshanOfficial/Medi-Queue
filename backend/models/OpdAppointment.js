const mongoose = require('mongoose');

const ACTIVE_STATUSES = ['booked', 'checked_in', 'in_consultation'];

// Patient-booked OPD appointment.
//
// The shared `Appointment` model requires `patient` to reference a receptionist
// `Patient` row, but app patients are provisioned against `User` /
// `OpdPatientProfile` and most never have a receptionist record. This model is
// therefore keyed on `OpdPatientProfile` so the booking flow works for every
// registered patient, and the shared `Appointment` model is left untouched.
const opdAppointmentSchema = new mongoose.Schema(
  {
    profile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OpdPatientProfile',
      required: true,
      index: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    // Snapshot of the doctor fields shown on the pass. The doctor record is owned
    // by the MOH flow and may be renamed later, so the pass must not depend on it.
    doctorName: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    room: { type: String, trim: true },

    date: {
      type: String, // "YYYY-MM-DD" in Asia/Colombo
      required: true,
    },
    slotTime: {
      type: String, // "HH:mm"
      required: true,
    },
    endsAt: { type: Date },

    type: {
      type: String,
      enum: ['walk_in', 'pre_booked'],
      default: 'pre_booked',
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

    // Denormalised token pointer, set when the patient checks in. The queue entry
    // itself is the source of truth for the live position.
    queueEntry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OpdQueueEntry',
      default: null,
    },
    priority: { type: String, enum: ['urgent', 'senior', 'normal'], default: 'normal' },
    tokenNumber: { type: Number, default: null },

    reason: { type: String, trim: true, maxlength: 300 },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, trim: true, maxlength: 200 },
    rescheduledFrom: { type: String, trim: true },

    // Drives the double-booking guard, mirroring the shared Appointment model.
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, strict: 'throw' },
);

// `isActive` exists only so the unique index can express "one live booking per
// patient per doctor per slot". It is derived from `status` rather than set
// independently, so the two cannot drift apart.
//
// Document writes (save) sync it automatically. Query updates must set it
// explicitly in their `$set`, which is why `isActive` is listed in the two
// `updateOne` calls in `controllers/queueController.js`.
function activeFor(status) {
  return ACTIVE_STATUSES.includes(status);
}

opdAppointmentSchema.pre('validate', function syncOnValidate(next) {
  this.isActive = activeFor(this.status);
  next();
});

// One active booking per patient per doctor per slot.
opdAppointmentSchema.index(
  { profile: 1, doctor: 1, date: 1, slotTime: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);
opdAppointmentSchema.index({ profile: 1, date: 1, status: 1 });
opdAppointmentSchema.index({ doctor: 1, date: 1, status: 1 });

const OpdAppointment = mongoose.model('OpdAppointment', opdAppointmentSchema);

module.exports = OpdAppointment;
module.exports.ACTIVE_STATUSES = ACTIVE_STATUSES;
