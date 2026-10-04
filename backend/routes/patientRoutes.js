const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');

// @route   GET /api/v1/patients
// @desc    Get all patients
// @access  Public (Should be private in production)
router.get('/', patientController.getAllPatients);

// @route   PUT /api/v1/patients/:id
// @desc    Update a patient
// @access  Public
router.put('/:id', patientController.updatePatient);

// @route   PATCH /api/v1/patients/:id/toggle-status
// @desc    Toggle patient active/inactive status
// @access  Public
router.patch('/:id/toggle-status', patientController.togglePatientStatus);

// @route   DELETE /api/v1/patients/:id
// @desc    Soft delete a patient
// @access  Public
router.delete('/:id', patientController.deletePatient);

module.exports = router;
