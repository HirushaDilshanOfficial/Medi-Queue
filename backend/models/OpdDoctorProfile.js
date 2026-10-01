const mongoose = require('mongoose');

// Patient-facing extras for a doctor. The canonical doctor record lives in the
// shared `Doctor` model (owned by the MOH flow) and is never mutated by the
// patient module. This collection only stores presentation data the MOH model
// does not have, keyed by the shared doctor id.
const opdDoctorProfileSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      unique: true,
      index: true,
    },
    avatarUrl: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
      default: 'Dr.',
    },
    qualifications: {
      type: String,
      trim: true,
    },
    languages: {
      type: [String],
      default: [],
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    fee: {
      type: Number,
      min: 0,
    },
    about: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('OpdDoctorProfile', opdDoctorProfileSchema);
