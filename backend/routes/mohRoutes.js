const express = require('express');
const router = express.Router();
const { getMohDashboard } = require('../controllers/mohController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.use(protect, authorizeRoles('moh', 'admin'));
router.get('/dashboard', getMohDashboard);

module.exports = router;
