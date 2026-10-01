const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { searchPatients } = require('../controllers/walkInController');

// All routes below require auth + receptionist role
router.use(protect, authorizeRoles('receptionist'));

// GET /api/reception/patients/search?q=
router.get('/patients/search', searchPatients);

module.exports = router;
