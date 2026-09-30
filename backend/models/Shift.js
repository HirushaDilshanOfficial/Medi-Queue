const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema(
  {
    counterName: {
      type: String,
      default: 'Counter 01',
      trim: true,
    },
    receptionist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: String, // "YYYY-MM-DD"
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
    },
    summary: {
      totalRegistered: { type: Number, default: 0 },
      attended: { type: Number, default: 0 },
      noShows: { type: Number, default: 0 },
      cancelled: { type: Number, default: 0 },
      avgHandlingMinutes: { type: Number, default: 0 },
      throughputPercent: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// Fast lookup for a receptionist's shift on a given date
shiftSchema.index({ receptionist: 1, date: 1, status: 1 });

module.exports = mongoose.model('Shift', shiftSchema);
