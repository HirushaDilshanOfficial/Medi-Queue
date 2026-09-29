const express = require('express');
const router = express.Router();
const { registerUser, getUserProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// Route definitions
router.post('/register', registerUser);
router.get('/profile', protect, getUserProfile);

module.exports = router;
