const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { getDailyReport } = require('../controllers/reportController');

// All report routes require auth + receptionist role
router.use(protect, authorizeRoles('receptionist'));

// GET /api/reception/reports/daily?format=csv
router.get(['/reports/daily', '/daily'], getDailyReport);

module.exports = router;
