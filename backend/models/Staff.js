const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  fullName: {
    type: String,
    required: true,
  },
  nic: {
    type: String,
    required: true,
  },
  employeeNo: {
    type: String,
    required: true,
    unique: true,
  },
  dob: {
    type: String,
  },
  gender: {
    type: String,
  },
  mobile: {
    type: String,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  address: {
    type: String,
  },
  role: {
    type: String,
    required: true,
  },
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
  },
  hospitalName: {
    type: String,
  },
  department: {
    type: String,
  },
  status: {
    type: String,
    default: 'Active',
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  // Doctor Specific
  medRegNo: {
    type: String,
  },
  specialization: {
    type: String,
  },
  doctorQualification: {
    type: String,
  },
  // Nurse Specific
  nurseRegNo: {
    type: String,
  },
  nurseQualification: {
    type: String,
  },
  ward: {
    type: String,
  },
}, { timestamps: true });

module.exports = mongoose.model('Staff', staffSchema);
