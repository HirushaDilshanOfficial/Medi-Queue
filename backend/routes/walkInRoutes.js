const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { searchPatients, getSlots, walkInBooking } = require('../controllers/walkInController');
const { callNext, recallToken, markNoShow } = require('../controllers/queueController');

// All routes below require auth + receptionist role
router.use(protect, authorizeRoles('receptionist', 'doctor'));

// GET /api/reception/patients/search?q=
router.get('/patients/search', searchPatients);

// GET /api/reception/slots?doctorId=&date=
router.get('/slots', getSlots);

// POST /api/reception/walk-in
router.post('/walk-in', walkInBooking);

// POST /api/reception/call-next
router.post('/call-next', callNext);

// POST /api/reception/:id/recall
router.post('/:id/recall', recallToken);

// POST /api/reception/:id/no-show
router.post('/:id/no-show', markNoShow);

module.exports = router;
