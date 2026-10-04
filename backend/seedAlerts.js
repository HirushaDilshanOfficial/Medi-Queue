const mongoose = require('mongoose');
require('dotenv').config();
const Alert = require('./models/Alert');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mediqueue').then(async () => {
  await Alert.deleteMany({});
  
  await Alert.create({
    hospitalName: 'Colombo National Hospital',
    location: 'Colombo District',
    priority: 'HIGH PRIORITY',
    title: 'Orthopedic OPD queue exceeded safety limit',
    description: 'Estimated patient wait time: >48 mins (threshold: 35 mins)',
    metrics: {
      'Active Queue': '128 Patients',
      'Physician Ratio': '32:1 (4 Docs)'
    },
    aiRecommendation: 'Open 2 auxiliary consultation chambers & divert triage category 4 cases to Ward 3B.',
    category: 'Overcrowding'
  });

  await Alert.create({
    hospitalName: 'Ragama Teaching Hospital',
    location: 'Gampaha District',
    priority: 'MEDIUM PRIORITY',
    title: 'Sudden walk-in registration spike detected',
    description: 'Rate is +45% above historical normal between 10:00 - 10:30 AM.',
    metrics: {
      'Estimated Wait Degradation': '+18 Mins'
    },
    category: 'Overcrowding'
  });

  await Alert.create({
    hospitalName: 'Kalutara General Hospital',
    location: 'Western Province',
    priority: 'STAFFING NOTICE',
    title: '2 Pediatric physicians on emergency leave',
    description: 'Active roster assigned to 1 on-call backup specialist. Clinic running at 60% capacity.',
    category: 'Doctor Shortage'
  });

  console.log('Alerts seeded successfully!');
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
