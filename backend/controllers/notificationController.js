const Notification = require('../models/Notification');
const User = require('../models/User');
const mongoose = require('mongoose');

const ROLES = ['All', 'Patient', 'Doctor', 'Receptionist', 'MOH'];
const canonicalRole = role => ROLES.find(value => value.toLowerCase() === String(role).toLowerCase()) || role;

// @desc    Create a new notification
// @route   POST /api/v1/notifications
// @access  Private (MOH only)
const createNotification = async (req, res) => {
  try {
    const { title, message, targetRole, recipient, kind, isEmergency } = req.body;

    if (typeof title !== 'string' || !title.trim() || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    // Ensure only MOH can send
    if (canonicalRole(req.user.role) !== 'MOH') {
      return res.status(403).json({ message: 'Not authorized to send notifications' });
    }

    if ((kind && !['personal', 'announcement'].includes(kind)) || (kind === 'personal' && !recipient)) {
      return res.status(400).json({ message: 'A personal notification requires a patient recipient.' });
    }
    let audience = canonicalRole(targetRole || 'All');
    if (recipient) {
      if (!mongoose.isValidObjectId(recipient)) {
        return res.status(400).json({ message: 'Invalid patient recipient.' });
      }
      const patient = await User.findById(recipient).select('role');
      if (!patient || canonicalRole(patient.role) !== 'Patient') {
        return res.status(400).json({ message: 'The recipient must be a registered patient.' });
      }
      audience = 'Patient';
    }
    if (!ROLES.includes(audience)) {
      return res.status(400).json({ message: 'Invalid notification audience.' });
    }

    const notification = new Notification({
      title: title.trim(),
      message: message.trim(),
      targetRole: audience,
      recipient: recipient || null,
      kind: recipient ? 'personal' : 'announcement',
      isEmergency: isEmergency || false,
      sender: req.user._id,
    });

    const createdNotification = await notification.save();
    res.status(201).json(createdNotification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get notifications for a user
// @route   GET /api/v1/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.set('X-Notification-User', String(req.user._id));
    res.set('Access-Control-Expose-Headers', 'X-Notification-User');
    const userRole = canonicalRole(req.user.role);
    // Null also matches legacy broadcasts where recipient was never stored.
    // A role or client-supplied patient id must never override private ownership.
    const announcements = {
      recipient: null,
      kind: { $ne: 'personal' },
      targetRole: { $in: ['All', userRole] },
    };
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    let query = { createdAt: { $gte: thirtyDaysAgo } };

    if (userRole === 'MOH') {
      // MOH sees all notifications they sent, plus any targeted at 'All' or 'MOH'
      query = {
        ...query,
        $or: [
          { sender: req.user._id },
          announcements,
        ]
      };
    } else {
      query = { ...query, $or: [{ recipient: req.user._id }, announcements] };
    }

    const notifications = await Notification.find(query).sort({ createdAt: -1 });

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createNotification,
  getNotifications,
};
