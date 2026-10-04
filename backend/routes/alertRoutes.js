const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');

// Get analytics data
router.get('/analytics', alertController.getAnalytics);

// Get all active alerts
router.get('/', alertController.getAllAlerts);

// Create a new alert (e.g. from threshold engine)
router.post('/', alertController.createAlert);

// Update alert status (Acknowledge / Resolve)
router.patch('/:id/status', alertController.updateAlertStatus);

module.exports = router;
