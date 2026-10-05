const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getPatients,
  getPatientById,
  searchPatients,
} = require('../controllers/patientController');

// All reception patient routes require auth + receptionist role
router.use(protect, authorizeRoles('receptionist'));

// /patients/search MUST be registered BEFORE /patients/:id
router.get(['/patients/search', '/search'], searchPatients);

// GET /patients?filter=visited_today|recent|all
router.get(['/patients', '/'], getPatients);

// GET /patients/:id
router.get(['/patients/:id', '/:id'], getPatientById);

module.exports = router;
