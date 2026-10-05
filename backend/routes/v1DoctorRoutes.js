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
  getPrescriptionDetails,
  savePrescription,
  referPatient,
  getPatientRecords,
} = require('../controllers/doctorController');

router.get('/dashboard', getDoctorDashboard);
router.patch('/status', updateDoctorStatus);
router.post('/call-next', callNextPatient);
router.post('/chime', ringChime);
router.post('/call-token', callSpecificPatient);
router.get('/schedule', getDoctorSchedule);
router.post('/walkin-slot', addWalkInSlot);
router.post('/break', toggleDoctorBreak);
router.get('/prescription', getPrescriptionDetails);
router.post('/prescription', savePrescription);
router.post('/referral', referPatient);
router.get('/records', getPatientRecords);

module.exports = router;