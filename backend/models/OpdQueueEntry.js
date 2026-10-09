const mongoose = require('mongoose');

const { options, ref, text, dateKey } = require('./receptionistFields');

// A patient's place in a department's live queue.
//
// One row per appointment, so a patient never holds two active queue entries and
// the token number they are given at check-in stays valid for the whole day. The
// token is NOT reused after a cancel unless it is the most recent one, which is
// handled by the counter rather than here.
const opdQueueEntrySchema = new mongoose.Schema(
  {
    appointment: {
      ...ref('OpdAppointment'),
      unique: true,
    },
    profile: { ...ref('OpdPatientProfile'), index: true },

    department: text(),
    queueDate: dateKey(),

    tokenNumber: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isSafeInteger, message: '{PATH} must be a whole number.' },
    },

    // Opaque, high-entropy code encoded in the pass QR. Kept separate from
    // tokenNumber so a screenshot of the QR cannot be used to guess someone's
    // place in the queue, and so a pass can be revoked without the token moving.
    passCode: {
      type: String,
      required: true,
      unique: true,
      minlength: 24,
      maxlength: 64,
    },

    doctor: { ...ref('Doctor', false) },
    doctorName: { type: String, trim: true },
    room: { type: String, trim: true },

    // Snapshot of the serving pace at check-in, used to estimate the ETA. It is
    // deliberately not recomputed on read, otherwise the ETA would jump around as
    // the doctor takes breaks.
    avgConsultMinutes: { type: Number, min: 1, default: 10 },

    priority: {
      type: String,
      enum: ['normal', 'urgent'],
      default: 'normal',
      required: true,
    },
    status: {
      type: String,
      enum: ['waiting', 'called', 'in_consultation', 'completed', 'no_show', 'cancelled'],
      default: 'waiting',
      required: true,
    },

    checkedInAt: { type: Date, default: Date.now, required: true },
    calledAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  options,
);

// The token a patient holds is unique within a department on a given day.
opdQueueEntrySchema.index({ department: 1, queueDate: 1, tokenNumber: 1 }, { unique: true });
// Serves the live "who is ahead of me" count: ordered by priority, then token.
opdQueueEntrySchema.index({ department: 1, queueDate: 1, status: 1, priority: 1 });
// "My current pass" lookup for the patient.
opdQueueEntrySchema.index({ profile: 1, status: 1 });

const OpdQueueEntry = mongoose.model('OpdQueueEntry', opdQueueEntrySchema);

module.exports = OpdQueueEntry;
