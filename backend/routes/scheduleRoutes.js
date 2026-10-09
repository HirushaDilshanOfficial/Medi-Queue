const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  createSchedule,
  getSchedules,
  updateSchedule,
  deleteSchedule,
} = require('../controllers/scheduleController');

// All schedule routes require auth + receptionist role
router.use(protect, authorizeRoles('receptionist'));

router.route(['/', '/schedules'])
  .post(createSchedule)
  .get(getSchedules);

router.route(['/:id', '/schedules/:id'])
  .put(updateSchedule)
  .delete(deleteSchedule);

module.exports = router;
