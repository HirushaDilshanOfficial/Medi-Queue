const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    nic: {
      type: String,
      unique: true,
      sparse: true, // allows multiple documents without NIC
      uppercase: true,
      trim: true,
    },
    nicVerified: {
      type: Boolean,
      default: false,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    dob: {
      type: Date,
    },
    age: {
      type: Number,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
    address: {
      type: String,
      trim: true,
    },
    district: {
      type: String,
      trim: true,
    },
    emergencyContact: {
      name: { type: String, trim: true },
      relationship: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    },
    allergies: [
      {
        name: { type: String, trim: true },
        severity: { type: String, trim: true },
      },
    ],
    registeredVia: {
      type: String,
      enum: ['app', 'reception'],
      default: 'reception',
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    patientNo: {
      type: String,
      unique: true,
      sparse: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast lookup
// nic index is auto-created by unique + sparse on the schema field
patientSchema.index({ phone: 1 });

module.exports = mongoose.model('Patient', patientSchema);
