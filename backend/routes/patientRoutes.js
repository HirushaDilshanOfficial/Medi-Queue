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
const { protect } = require('../middleware/authMiddleware');
const { loadPatientProfile, patientOnly } = require('../middleware/patientMiddleware');

router.use(protect, patientOnly, loadPatientProfile);

router.get('/me', getMyProfile);
router.patch('/me', updateMyProfile);
router.get('/me/dashboard', getDashboard);
router.get('/me/history', getMyHistory);
router.get('/me/reports', getMyReports);
router.post('/me/reports', createMyReport);
router.delete('/me/reports/:id', deleteMyReport);

module.exports = router;
