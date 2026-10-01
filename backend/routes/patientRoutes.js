const express = require('express');
const router = express.Router();
const { getMyProfile, getDashboard } = require('../controllers/patientController');
const { protect } = require('../middleware/authMiddleware');
const { loadPatientProfile, patientOnly } = require('../middleware/patientMiddleware');

router.use(protect, patientOnly, loadPatientProfile);

router.get('/me', getMyProfile);
router.get('/me/dashboard', getDashboard);

module.exports = router;
