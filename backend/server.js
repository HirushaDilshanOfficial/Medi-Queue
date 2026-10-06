require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const queueRoutes = require('./routes/queueRoutes');
const walkInRoutes = require('./routes/walkInRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const authRoutes = require('./routes/authRoutes');
const hospitalRoutes = require('./routes/hospitalRoutes');
const staffRoutes = require('./routes/staffRoutes');
const alertRoutes = require('./routes/alertRoutes');
const patientRoutes = require('./routes/patientRoutes');
const v1PatientRoutes = require('./routes/v1PatientRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const shiftRoutes = require('./routes/shiftRoutes');
const reportRoutes = require('./routes/reportRoutes');
const policyRoutes = require('./routes/policyRoutes');
const publicRoutes = require('./routes/publicRoutes');
const v1DoctorRoutes = require('./routes/v1DoctorRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const { errorHandler } = require('./utils/errorHandler');

const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Health Check Route
app.get(['/health', '/api/health'], (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.status(isConnected ? 200 : 503).json({
    status: isConnected ? 'OK' : 'DEGRADED',
    message: isConnected
      ? 'Server is healthy and connected to database'
      : 'Database disconnected',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      status: isConnected ? 'connected' : 'disconnected',
      readyState: mongoose.connection.readyState,
    },
  });
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/reception/queue', queueRoutes);
app.use('/api/reception', dashboardRoutes);
app.use('/api/reception', patientRoutes);
app.use('/api/reception', doctorRoutes);
app.use('/api/reception', shiftRoutes);
app.use('/api/reception', reportRoutes);
app.use('/api/reception', walkInRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/hospitals', hospitalRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/alerts', alertRoutes);
app.use('/api/v1/patients', v1PatientRoutes);
app.use('/api/v1/policies', policyRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/doctor', v1DoctorRoutes);

// Patient module
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/queue', queueRoutes);

// Error Handling Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
});
