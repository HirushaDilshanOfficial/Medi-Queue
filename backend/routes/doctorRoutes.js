const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { getDoctors } = require('../controllers/doctorController');

// All doctor routes in reception require auth + receptionist role
router.use(protect, authorizeRoles('receptionist'));

// GET /api/reception/doctors?department=
router.get('/doctors', getDoctors);

module.exports = router;
