const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    targetRole: {
      type: String,
      enum: ['All', 'Patient', 'Doctor', 'Receptionist', 'MOH'],
      required: true,
      default: 'All',
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      required: function () { return this.kind === 'personal'; },
    },
    kind: {
      type: String,
      enum: ['personal', 'announcement'],
      default: function () { return this.recipient ? 'personal' : 'announcement'; },
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ targetRole: 1, recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
