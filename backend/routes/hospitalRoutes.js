const express = require('express');
const router = express.Router();
const hospitalController = require('../controllers/hospitalController');

router.post('/add', hospitalController.addHospital);
router.get('/', hospitalController.getAllHospitals);
router.put('/:id', hospitalController.updateHospital);
router.delete('/:id', hospitalController.deleteHospital);
router.patch('/:id/toggle-status', hospitalController.toggleHospitalStatus);
router.get('/:id/dashboard', hospitalController.getHospitalDashboardStats);

module.exports = router;
