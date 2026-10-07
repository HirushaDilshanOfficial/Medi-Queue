const mongoose = require('mongoose');

// A medical report the patient has lodged for a past or upcoming visit — a lab
// result, an outside referral, a discharge summary. Additive, like the other
// Opd* models, so the receptionist-side `Patient` and any MOH records are
// untouched.
//
// The report metadata and private upload metadata are stored here. File bytes
// live outside MongoDB so the document collection remains small and queryable.
const opdMedicalReportSchema = new mongoose.Schema(
  {
    profile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OpdPatientProfile',
      required: true,
      index: true,
    },
    // Optional link to the visit this report belongs to. Not required: a report
    // can be for a visit that happened before the patient started using the app.
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OpdAppointment',
      default: null,
    },

    title: {
      type: String,
      required: [true, 'Give the report a title'],
      trim: true,
      maxlength: 120,
    },
    // The category a doctor would file it under. Kept as a loose string rather
    // than a strict enum so the hospital can add a type without a deploy.
    category: {
      type: String,
      trim: true,
      default: 'General',
      maxlength: 60,
    },

    // When the report itself is dated, which is often not the upload date.
    reportDate: { type: Date, default: null },
    // Date the hospital performed the test, kept separately from reportDate
    // because a report dated today may describe last month's blood work.
    performedOn: { type: Date, default: null },

    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    fileName: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    fileKey: { type: String, trim: true, maxlength: 260 },
    fileMimeType: { type: String, trim: true, maxlength: 100 },
    fileSize: { type: Number, min: 1 },

    // `pending` -> `reviewed` is set by staff, not the patient, so the patient
    // can never mark their own report as seen by a doctor.
    status: {
      type: String,
      enum: ['pending', 'reviewed'],
      default: 'pending',
    },
  },
  { timestamps: true, strict: 'throw' },
);

opdMedicalReportSchema.index({ profile: 1, createdAt: -1 });
// Guards the optional link: a report cannot point at a visit that does not exist.
opdMedicalReportSchema.index({ appointment: 1 }, { sparse: true });

const OpdMedicalReport = mongoose.model('OpdMedicalReport', opdMedicalReportSchema);

module.exports = OpdMedicalReport;
