const express = require('express');
const router = express.Router();
const {
  checkIn,
  myPass,
  liveState,
  board,
  liveDepartments,
  leaveQueue,
} = require('../controllers/queueController');
const { protect } = require('../middleware/authMiddleware');
const { loadPatientProfile, patientOnly } = require('../middleware/patientMiddleware');

router.use(protect, patientOnly, loadPatientProfile);

router.get('/departments', liveDepartments);
router.get('/board', board);
router.post('/check-in', checkIn);
router.get('/my-pass', myPass);
router.get('/my-pass/live', liveState);
router.delete('/my-pass', leaveQueue);

module.exports = router;
