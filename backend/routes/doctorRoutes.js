const express = require('express');
const router = express.Router();
const {
  getDoctorDashboard,
  updateDoctorStatus,
  callNextPatient,
} = require('../controllers/doctorController');

// Doctor Dashboard Endpoints
router.get('/dashboard', getDoctorDashboard);
router.patch('/status', updateDoctorStatus);
router.post('/call-next', callNextPatient);

module.exports = router;
