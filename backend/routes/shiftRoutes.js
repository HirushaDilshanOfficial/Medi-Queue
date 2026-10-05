const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getShiftSummary,
  closeShift,
} = require('../controllers/shiftController');

// All shift routes require auth + receptionist role
router.use(protect, authorizeRoles('receptionist'));

// GET /api/reception/shift/summary
router.get(['/shift/summary', '/summary'], getShiftSummary);

// POST /api/reception/shift/close
router.post(['/shift/close', '/close'], closeShift);

module.exports = router;
