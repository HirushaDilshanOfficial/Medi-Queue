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
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { loadPatientProfile, patientOnly } = require('../middleware/patientMiddleware');

// Patient queue routes (/api/v1/queue/*)
const patientAuth = [protect, patientOnly, loadPatientProfile];
router.get('/departments', protect, patientOnly, liveDepartments);
router.get('/board', protect, patientOnly, board);
router.post('/check-in', ...patientAuth, checkIn);
router.get('/my-pass', ...patientAuth, myPass);
router.get('/my-pass/live', ...patientAuth, liveState);
router.delete('/my-pass', ...patientAuth, leaveQueue);
 
const {
  getQueue,
  getNextInQueue,
  callNext,
  recallToken,
  markNoShow,
  moveBackToken,
  assignDoctor,
  updateAutoAdvance,
  getAutoAdvance,
  validatePass,
} = require('../controllers/queueController');

// All reception queue routes require auth + receptionist, admin, or doctor role
const receptionAuth = [protect, authorizeRoles('receptionist', 'admin', 'doctor')];

// Validate patient queue QR passes at an administration terminal.
router.get('/pass/:passCode', ...receptionAuth, validatePass);

// GET /api/reception/queue/auto-advance -> read auto-advance setting
router.get('/auto-advance', ...receptionAuth, getAutoAdvance);

// PATCH /api/reception/queue/auto-advance -> update auto-advance setting
router.patch('/auto-advance', ...receptionAuth, updateAutoAdvance);

// POST /api/reception/queue/call-next -> call next waiting patient
router.post('/call-next', ...receptionAuth, callNext);

// PATCH /api/reception/queue/:id/assign-doctor -> assign doctor to token and appointment
router.patch('/:id/assign-doctor', ...receptionAuth, assignDoctor);

// POST /api/reception/queue/:id/recall -> recall a called token
router.post('/:id/recall', ...receptionAuth, recallToken);

// POST /api/reception/queue/:id/no-show -> mark token & appointment as no_show
router.post('/:id/no-show', ...receptionAuth, markNoShow);

// POST /api/reception/queue/:id/move-back -> move waiting token 3 positions back
router.post('/:id/move-back', ...receptionAuth, moveBackToken);

// GET /api/reception/queue/next -> first waiting token in order, or null
router.get('/next', ...receptionAuth, getNextInQueue);

// GET /api/reception/queue/ -> ordered queue with totals and timestamp
router.get('/', ...receptionAuth, getQueue);

module.exports = router;
