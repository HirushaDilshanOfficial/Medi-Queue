const express = require('express');
const router = express.Router();
const {
  loginUser,
  registerPatient,
  registerStaff,
  forgotPassword,
  verifyOTP,
  resetPassword,
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public Routes
router.post('/login', loginUser);
router.post('/patient/register', registerPatient);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);

// Protected Routes (Only MOH can register staff)
router.post('/staff/register', protect, authorize('MOH'), registerStaff);

module.exports = router;
