const express = require('express');
const router = express.Router();
const {
  listDoctors,
  listDepartments,
  getDoctor,
} = require('../controllers/doctorController');
const { protect } = require('../middleware/authMiddleware');
const { patientOnly } = require('../middleware/patientMiddleware');

router.use(protect, patientOnly);

// Keep the literal path above the /:id route so it is not swallowed by the param.
router.get('/departments', listDepartments);
router.get('/', listDoctors);
router.get('/:id', getDoctor);

module.exports = router;
