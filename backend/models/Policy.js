const mongoose = require('mongoose');

const policySchema = new mongoose.Schema({
  targetWaitTime: {
    type: Number,
    default: 30, // in minutes
  },
  priorityQueue: {
    type: Boolean,
    default: true,
  },
  tokenAutoExpiry: {
    type: Boolean,
    default: true,
  },
  dataMasking: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Policy', policySchema);
