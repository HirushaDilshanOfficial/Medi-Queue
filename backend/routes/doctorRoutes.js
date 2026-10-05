const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { getDoctors } = require('../controllers/doctorController');

// All doctor routes in reception require auth + receptionist role
router.get('/doctors', protect, authorizeRoles('receptionist'), getDoctors);

module.exports = router;
