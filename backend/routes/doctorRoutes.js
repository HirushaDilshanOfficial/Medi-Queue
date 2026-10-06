const express = require('express');
const router = express.Router();
const {
  listDoctors,
  listDepartments,
  getDoctor,
} = require('../controllers/doctorController');
const { patientOnly } = require('../middleware/patientMiddleware');

const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// Keep the literal path above the /:id route so it is not swallowed by the param.
router.get('/departments', protect, patientOnly, listDepartments);
router.get('/', protect, patientOnly, listDoctors);
// Reception mounts this router at /api/reception, so expose /doctors there.
router.get('/doctors', protect, authorizeRoles('receptionist'), listDoctors);
router.get('/:id', protect, patientOnly, getDoctor);

module.exports = router;
