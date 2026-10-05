const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getPatients,
  getPatientById,
  searchPatients,
  updatePatientProfile,
  verifyPatientNIC,
} = require('../controllers/patientController');

// All reception patient routes require auth + receptionist role
router.use(protect, authorizeRoles('receptionist'));

// /patients/search MUST be registered BEFORE /patients/:id
router.get('/patients/search', searchPatients);

// GET /patients?filter=visited_today|recent|all
router.get('/patients', getPatients);

// POST /patients/:id/verify-nic
router.post('/patients/:id/verify-nic', verifyPatientNIC);

// GET /patients/:id
router.get('/patients/:id', getPatientById);

// PATCH /patients/:id
router.patch('/patients/:id', updatePatientProfile);

module.exports = router;
