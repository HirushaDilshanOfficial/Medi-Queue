const express = require('express');
const router = express.Router();
const {
  getMyProfile,
  updateMyProfile,
  getMyHistory,
  getMyReports,
  getMyReport,
  createMyReport,
  updateMyReport,
  deleteMyReport,
  getMyReportFile,
  getDashboard,
} = require('../controllers/patientController');
const { protect } = require('../middleware/authMiddleware');
const { loadPatientProfile, patientOnly } = require('../middleware/patientMiddleware');
const { reportUpload } = require('../middleware/reportUpload');

router.use(protect, patientOnly, loadPatientProfile);

router.get('/me', getMyProfile);
router.patch('/me', updateMyProfile);
router.get('/me/dashboard', getDashboard);
router.get('/me/history', getMyHistory);
router.get('/me/reports', getMyReports);
router.get('/me/reports/:id', getMyReport);
router.post('/me/reports', reportUpload.single('file'), createMyReport);
router.patch('/me/reports/:id', reportUpload.single('file'), updateMyReport);
router.delete('/me/reports/:id', deleteMyReport);
router.get('/me/reports/:id/file', getMyReportFile);
 
const { authorizeRoles } = require('../middleware/authMiddleware');
const {
  getPatients,
  getPatientById,
  searchPatients,
  updatePatientProfile,
  verifyPatientNIC,
} = require('../controllers/patientController');

// All reception patient routes require auth + receptionist role
router.use(protect, authorizeRoles('receptionist'));

// /patients/search MUST be registered BEFORE /patients/:id
router.get('/patients/search', searchPatients);

// GET /patients?filter=visited_today|recent|all
router.get('/patients', getPatients);

// POST /patients/:id/verify-nic
router.post('/patients/:id/verify-nic', verifyPatientNIC);

// GET /patients/:id
router.get('/patients/:id', getPatientById);

// PATCH /patients/:id
router.patch('/patients/:id', updatePatientProfile);

module.exports = router;
