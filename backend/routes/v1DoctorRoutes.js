const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const optionalAuth = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      req.user = await User.findById(decoded.id).select('-password');
    } catch (e) {
      // Ignore token failure for optional routes
    }
  }
  next();
};

router.use(optionalAuth);
const {
  getDoctorDashboard,
  updateDoctorStatus,
  updateDoctorHospital,
  getDoctorHospitals,
  callNextPatient,
  undoPatientConsultation,
  ringChime,
  callSpecificPatient,
  getDoctorSchedule,
  addWalkInSlot,
  toggleDoctorBreak,
  getPrescriptionDetails,
  savePrescription,
  referPatient,
  getPatientRecords,
  updatePatientVitals,
  generatePrescriptionPdfApi,
} = require('../controllers/doctorController');

router.get('/dashboard', getDoctorDashboard);
router.patch('/status', updateDoctorStatus);
router.patch('/hospital', updateDoctorHospital);
router.get('/hospitals', getDoctorHospitals);
router.post('/call-next', callNextPatient);
router.post('/undo-patient', undoPatientConsultation);
router.post('/chime', ringChime);
router.post('/call-token', callSpecificPatient);
router.get('/schedule', getDoctorSchedule);
router.post('/walkin-slot', addWalkInSlot);
router.post('/break', toggleDoctorBreak);
router.get('/prescription', getPrescriptionDetails);
router.post('/prescription', savePrescription);
router.post('/prescription/pdf', generatePrescriptionPdfApi);
router.post('/referral', referPatient);
router.get('/records', getPatientRecords);
router.post('/vitals', updatePatientVitals);

module.exports = router;