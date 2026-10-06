const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { getReceptionDashboard } = require('../controllers/dashboardController');

// All dashboard routes require auth + receptionist role
router.use(protect, authorizeRoles('receptionist'));

// GET /api/reception/dashboard -> reception dashboard for a single day
router.get('/dashboard', getReceptionDashboard);

module.exports = router;
