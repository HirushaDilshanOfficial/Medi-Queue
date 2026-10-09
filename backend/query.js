require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://hirusha:123@cluster0.ibgfrtb.mongodb.net/mediqueue?retryWrites=true&w=majority')
  .then(async () => {
    const qt = mongoose.connection.collection('queuetokens');
    const tokens = await qt.find({ status: 'waiting' }).toArray();
    console.log("Tokens in queue:");
    tokens.forEach(t => console.log("ID:", t._id.toString(), "Appt:", t.appointment ? t.appointment.toString() : 'null', "TokenNo:", t.tokenNumber, "Status:", t.status));
    process.exit(0);
  });
