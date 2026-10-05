const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getQueue,
  getNextInQueue,
  callNext,
} = require('../controllers/queueController');

// All queue routes require auth + receptionist (or doctor) role
router.use(protect, authorizeRoles('receptionist', 'doctor'));

// POST /api/reception/queue/call-next -> call next waiting patient
router.post('/call-next', callNext);

// GET /api/reception/queue/next -> first waiting token in order, or null
router.get('/next', getNextInQueue);

// GET /api/reception/queue/ -> ordered queue with totals and timestamp
router.get('/', getQueue);

module.exports = router;
