const express = require('express');
const router = express.Router();
const {
  getMyProfile,
  updateMyProfile,
  getMyHistory,
  getMyReports,
  createMyReport,
  deleteMyReport,
  getDashboard,
} = require('../controllers/patientController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { loadPatientProfile, patientOnly } = require('../middleware/patientMiddleware');

// Patient portal routes (/api/v1/patients/me*) -> Patient role only
const patientAuth = [protect, patientOnly, loadPatientProfile];
router.get('/me', ...patientAuth, getMyProfile);
router.patch('/me', ...patientAuth, updateMyProfile);
router.get('/me/dashboard', ...patientAuth, getDashboard);
router.get('/me/history', ...patientAuth, getMyHistory);
router.get('/me/reports', ...patientAuth, getMyReports);
router.post('/me/reports', ...patientAuth, createMyReport);
router.delete('/me/reports/:id', ...patientAuth, deleteMyReport);

const {
  getPatients,
  getPatientById,
  searchPatients,
  updatePatientProfile,
  verifyPatientNIC,
} = require('../controllers/patientController');

// Reception patient routes (/api/reception/patients*) -> Receptionist/Admin/Doctor
const receptionAuth = [protect, authorizeRoles('receptionist', 'admin', 'doctor')];

// /patients/search MUST be registered BEFORE /patients/:id
router.get('/patients/search', ...receptionAuth, searchPatients);

// GET /patients?filter=visited_today|recent|all
router.get('/patients', ...receptionAuth, getPatients);

// POST /patients/:id/verify-nic
router.post('/patients/:id/verify-nic', ...receptionAuth, verifyPatientNIC);

// GET /patients/:id
router.get('/patients/:id', ...receptionAuth, getPatientById);

// PATCH /patients/:id
router.patch('/patients/:id', ...receptionAuth, updatePatientProfile);

module.exports = router;
