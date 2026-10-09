const mongoose = require('mongoose');
const dns = require('node:dns');

const isTemporaryDnsError = error =>
  ['ECONNREFUSED', 'ETIMEOUT', 'ESERVFAIL', 'EAI_AGAIN'].includes(error.code) &&
  /querySrv|queryTxt/.test(error.message);

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not configured in backend/.env');
    process.exit(1);
    return;
  }

  // Use the network's DNS first. Public DNS can be blocked on some networks.
  const fallbackServers = [['1.1.1.1'], ['8.8.8.8']];
  for (let attempt = 0; attempt <= fallbackServers.length; attempt++) {
    try {
      if (attempt > 0) dns.setServers(fallbackServers[attempt - 1]);
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000,
      });
      console.log('MongoDB Connected: ' + conn.connection.host);
      return conn;
    } catch (error) {
      if (isTemporaryDnsError(error) && attempt < fallbackServers.length) {
        console.warn('MongoDB DNS lookup failed. Retrying with a fallback DNS server...');
        continue;
      }
      const message = String(error.message).replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g, '[redacted MongoDB URI]');
      console.error('MongoDB connection failed: ' + message);
      process.exit(1);
      return;
    }
  }
};

module.exports = connectDB;
