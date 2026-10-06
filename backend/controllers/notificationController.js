const Notification = require('../models/Notification');

// @desc    Create a new notification
// @route   POST /api/v1/notifications
// @access  Private (MOH only)
const createNotification = async (req, res) => {
  try {
    const { title, message, targetRole } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    // Ensure only MOH can send
    if (req.user.role !== 'MOH') {
      return res.status(403).json({ message: 'Not authorized to send notifications' });
    }

    const notification = new Notification({
      title,
      message,
      targetRole: targetRole || 'All',
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
    const userRole = req.user.role;
    let query = {};

    if (userRole === 'MOH') {
      // MOH sees all notifications they sent, plus any targeted at 'All' or 'MOH'
      query = {
        $or: [
          { sender: req.user._id },
          { targetRole: { $in: ['All', 'MOH'] } }
        ]
      };
    } else {
      // Others see notifications targeted to 'All' or their specific role
      query = { targetRole: { $in: ['All', userRole] } };
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
