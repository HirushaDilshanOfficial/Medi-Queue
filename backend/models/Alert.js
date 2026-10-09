const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: false
  },
  hospitalName: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['HIGH PRIORITY', 'MEDIUM PRIORITY', 'STAFFING NOTICE'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  metrics: {
    type: Map,
    of: String // Flexible key-value pairs (e.g., "Active Queue": "128 Patients")
  },
  aiRecommendation: {
    type: String
  },
  status: {
    type: String,
    enum: ['Active', 'Acknowledged', 'Resolved'],
    default: 'Active'
  },
  category: {
    type: String,
    enum: ['All Alerts', 'Overcrowding', 'Doctor Shortage'],
    default: 'Overcrowding'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Alert', alertSchema);
