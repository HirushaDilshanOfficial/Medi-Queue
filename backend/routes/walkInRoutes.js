const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { searchPatients, getSlots } = require('../controllers/walkInController');

// All routes below require auth + receptionist role
router.use(protect, authorizeRoles('receptionist'));

// GET /api/reception/patients/search?q=
router.get('/patients/search', searchPatients);

// GET /api/reception/slots?doctorId=&date=
router.get('/slots', getSlots);

module.exports = router;
