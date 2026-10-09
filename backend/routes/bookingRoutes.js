const express = require('express');
const router = express.Router();
const {
  createBooking,
  listMyBookings,
  cancelBooking,
  rescheduleBooking,
  bookingSummary,
} = require('../controllers/bookingController');
const { listDoctorDays, listDoctorSlots } = require('../controllers/slotController');
const { protect } = require('../middleware/authMiddleware');
const { loadPatientProfile, patientOnly } = require('../middleware/patientMiddleware');

router.use(protect, patientOnly, loadPatientProfile);

// Static segments are declared before the ":id" routes so `/summary` is never
// captured as an appointment id.
router.get('/summary', bookingSummary);

router.get('/doctors/:id/days', listDoctorDays);
router.get('/doctors/:id/slots', listDoctorSlots);

router.route('/').get(listMyBookings).post(createBooking);
router.patch('/:id/cancel', cancelBooking);
router.patch('/:id/reschedule', rescheduleBooking);

module.exports = router;
