const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  searchPatients,
  getSlots,
  walkInBooking,
  getPreBookedAppointments,
} = require('../controllers/walkInController');
const {
  callNext,
  recallToken,
  markNoShow,
  moveBackToken,
  assignDoctor,
  updateAutoAdvance,
  getAutoAdvance,
} = require('../controllers/queueController');

// All routes below require auth + receptionist role
router.use(protect, authorizeRoles('receptionist', 'admin', 'doctor'));

// GET /api/reception/pre-booked?date=&q=
router.get('/pre-booked', getPreBookedAppointments);

// GET /api/reception/patients/search?q=
router.get('/patients/search', searchPatients);

// GET /api/reception/slots?doctorId=&date=
router.get('/slots', getSlots);

// POST /api/reception/walk-in
router.post('/walk-in', walkInBooking);

// GET /api/reception/auto-advance
router.get('/auto-advance', getAutoAdvance);

// PATCH /api/reception/auto-advance
router.patch('/auto-advance', updateAutoAdvance);

// POST /api/reception/call-next
router.post('/call-next', callNext);

// PATCH /api/reception/:id/assign-doctor
router.patch('/:id/assign-doctor', assignDoctor);

// POST /api/reception/:id/recall
router.post('/:id/recall', recallToken);

// POST /api/reception/:id/no-show
router.post('/:id/no-show', markNoShow);

// POST /api/reception/:id/move-back
router.post('/:id/move-back', moveBackToken);

module.exports = router;
