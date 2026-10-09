require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://hirusha:123@cluster0.ibgfrtb.mongodb.net/mediqueue?retryWrites=true&w=majority')
  .then(async () => {
    const Appointment = require('./models/Appointment');
    const QueueToken = require('./models/QueueToken');
    
    const urgentEntries = await QueueToken.find({ priority: 'urgent' });
    for (const entry of urgentEntries) {
      if (entry.appointment) {
        await Appointment.findByIdAndUpdate(entry.appointment, { priority: 'urgent' });
      }
    }
    console.log('Synced Appointment priorities.');
    process.exit(0);
  });
