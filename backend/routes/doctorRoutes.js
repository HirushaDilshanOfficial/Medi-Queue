const express = require('express');
const router = express.Router();
const {
  getDoctorDashboard,
  updateDoctorStatus,
  callNextPatient,
  ringChime,
  callSpecificPatient,
  getDoctorSchedule,
  addWalkInSlot,
  toggleDoctorBreak,
} = require('../controllers/doctorController');

// Doctor Dashboard Endpoints
router.get('/dashboard', getDoctorDashboard);
router.patch('/status', updateDoctorStatus);
router.post('/call-next', callNextPatient);
router.post('/chime', ringChime);
router.post('/call-token', callSpecificPatient);

// Doctor Schedule Endpoints
router.get('/schedule', getDoctorSchedule);
router.post('/walkin-slot', addWalkInSlot);
router.post('/break', toggleDoctorBreak);

module.exports = router;
