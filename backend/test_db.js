require('dotenv').config();
const mongoose = require('mongoose');
const Alert = require('./models/Alert');

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const alerts = await Alert.find();
    console.log(alerts.map(a => a.hospitalName));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
