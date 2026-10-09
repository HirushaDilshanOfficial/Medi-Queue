const express = require('express');
const router = express.Router();
const Hospital = require('../models/Hospital');
const User = require('../models/User');
const { publicPass } = require('../controllers/queueController');

router.get('/queue-pass/:passCode', publicPass);

router.get('/stats', async (req, res) => {
  try {
    const hospitals = await Hospital.countDocuments();
    const doctors = await User.countDocuments({ role: 'Doctor' });
    const patients = await User.countDocuments({ role: 'Patient' });
    res.json({ hospitals, doctors, patients });
  } catch (error) {
    console.error('Error fetching public stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
