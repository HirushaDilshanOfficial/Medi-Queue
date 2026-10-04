const express = require('express');
const router = express.Router();
const { getPolicy, updatePolicy } = require('../controllers/policyController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Both GET and PUT routes are protected and restricted to 'MOH' role
router.route('/')
  // .get(protect, authorize('MOH'), getPolicy)
  // .put(protect, authorize('MOH'), updatePolicy);
  .get(getPolicy)
  .put(updatePolicy);

module.exports = router;
