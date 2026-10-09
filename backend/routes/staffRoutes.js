const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');

router.post('/add', staffController.addStaff);
router.get('/', staffController.getAllStaff);
router.get('/hospital/:hospitalId/summary', staffController.getHospitalStaffSummary);
router.put('/:id', staffController.updateStaff);
router.delete('/:id', staffController.deleteStaff);
router.patch('/:id/toggle-status', staffController.toggleStaffStatus);

module.exports = router;
