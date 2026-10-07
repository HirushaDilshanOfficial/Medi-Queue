const express = require('express');
const router = express.Router();
const { createNotification, getNotifications } = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, createNotification)
  .get(protect, getNotifications);

module.exports = router;
