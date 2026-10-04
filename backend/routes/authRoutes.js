const express = require('express');
const router = express.Router();
const {
  loginUser,
  registerPatient,
  registerStaff,
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public Routes
router.post('/login', loginUser);
router.post('/patient/register', registerPatient);

// Protected Routes (Only MOH can register staff)
router.post('/staff/register', protect, authorize('MOH'), registerStaff);

module.exports = router;
