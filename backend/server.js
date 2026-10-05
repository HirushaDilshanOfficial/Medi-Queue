require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const queueRoutes = require('./routes/queueRoutes');
const walkInRoutes = require('./routes/walkInRoutes');
const authRoutes = require('./routes/authRoutes');
const hospitalRoutes = require('./routes/hospitalRoutes');
const staffRoutes = require('./routes/staffRoutes');
const alertRoutes = require('./routes/alertRoutes');
const patientRoutes = require('./routes/patientRoutes');
const policyRoutes = require('./routes/policyRoutes');
const { errorHandler } = require('./utils/errorHandler');

const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/reception/queue', queueRoutes);
app.use('/api/reception', walkInRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/hospitals', hospitalRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/alerts', alertRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/policies', policyRoutes);

// Error Handling Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
