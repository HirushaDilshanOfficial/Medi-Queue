require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://hirusha:123@cluster0.ibgfrtb.mongodb.net/mediqueue?retryWrites=true&w=majority')
  .then(async () => {
    const OpdAppointment = require('./models/OpdAppointment');
    const OpdQueueEntry = require('./models/OpdQueueEntry');
    
    const urgentEntries = await OpdQueueEntry.find({ priority: 'urgent' });
    for (const entry of urgentEntries) {
      if (entry.appointment) {
        await OpdAppointment.findByIdAndUpdate(entry.appointment, { priority: 'urgent' });
      }
    }
    console.log('Synced OpdAppointment priorities.');
    process.exit(0);
  });
