const mongoose = require('mongoose');

const clinicSchema = new mongoose.Schema(
  {
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    clinicDays: { type: [String], default: [] },
    startTime: { type: String, default: '08:00' },
    endTime: { type: String, default: '16:30' },
    maxPatients: { type: Number, min: 1, default: 30 },
    status: { type: String, enum: ['active', 'inactive'], default: 'inactive' },
    priority: { type: Number, default: 100 },
  },
  { timestamps: true },
);

clinicSchema.index({ hospital: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Clinic', clinicSchema);
