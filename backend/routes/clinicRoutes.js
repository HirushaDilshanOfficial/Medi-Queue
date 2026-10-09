const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { patientOnly } = require('../middleware/patientMiddleware');
const {
  listClinics,
  listHospitalClinics,
  updateClinic,
} = require('../controllers/clinicController');

router.get('/', protect, patientOnly, listClinics);
router.get('/hospital/:hospitalId', protect, authorizeRoles('moh'), listHospitalClinics);
router.patch('/:id', protect, authorizeRoles('moh'), updateClinic);

module.exports = router;
