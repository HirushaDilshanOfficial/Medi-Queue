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
 
const { authorizeRoles } = require('../middleware/authMiddleware');
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
} = require('../controllers/queueController');

// All queue routes require auth + receptionist (or doctor) role
router.use(protect, authorizeRoles('receptionist', 'doctor'));

// GET /api/reception/queue/auto-advance -> read auto-advance setting
router.get('/auto-advance', getAutoAdvance);

// PATCH /api/reception/queue/auto-advance -> update auto-advance setting
router.patch('/auto-advance', updateAutoAdvance);

// POST /api/reception/queue/call-next -> call next waiting patient
router.post('/call-next', callNext);

// PATCH /api/reception/queue/:id/assign-doctor -> assign doctor to token and appointment
router.patch('/:id/assign-doctor', assignDoctor);

// POST /api/reception/queue/:id/recall -> recall a called token
router.post('/:id/recall', recallToken);

// POST /api/reception/queue/:id/no-show -> mark token & appointment as no_show
router.post('/:id/no-show', markNoShow);

// POST /api/reception/queue/:id/move-back -> move waiting token 3 positions back
router.post('/:id/move-back', moveBackToken);

// GET /api/reception/queue/next -> first waiting token in order, or null
router.get('/next', getNextInQueue);

// GET /api/reception/queue/ -> ordered queue with totals and timestamp
router.get('/', getQueue);

module.exports = router;
