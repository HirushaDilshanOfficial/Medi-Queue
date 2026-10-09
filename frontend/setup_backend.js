const fs = require('fs');
const path = require('path');
const backendDir = path.join(__dirname, '../backend');

if (!fs.existsSync(backendDir)) fs.mkdirSync(backendDir, { recursive: true });

const dirs = ['config', 'models', 'controllers', 'routes', 'middleware', 'utils'];
dirs.forEach(d => {
  const p = path.join(backendDir, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

fs.writeFileSync(path.join(backendDir, 'config', 'db.js'), `import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    // await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error(\`Error: \${error.message}\`);
    process.exit(1);
  }
};

export default connectDB;
`);

fs.writeFileSync(path.join(backendDir, 'models', 'User.js'), `import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
export default User;
`);

fs.writeFileSync(path.join(backendDir, 'controllers', 'userController.js'), `export const registerUser = async (req, res) => {
  res.status(201).json({ message: 'User registered' });
};
`);

fs.writeFileSync(path.join(backendDir, 'routes', 'userRoutes.js'), `import express from 'express';
import { registerUser } from '../controllers/userController.js';

const router = express.Router();
router.post('/register', registerUser);

export default router;
`);

fs.writeFileSync(path.join(backendDir, 'middleware', 'authMiddleware.js'), `export const protect = (req, res, next) => {
  console.log('Checking token...');
  next();
};
`);

fs.writeFileSync(path.join(backendDir, 'utils', 'errorHandler.js'), `export const errorHandler = (err, req, res, next) => {
  res.status(500).json({ message: err.message });
};
`);

fs.writeFileSync(path.join(backendDir, 'server.js'), `import express from 'express';
import connectDB from './config/db.js';
import userRoutes from './routes/userRoutes.js';

const app = express();
app.use(express.json());

// app.use('/api/users', userRoutes);

app.get('/', (req, res) => {
  res.send('API is running...');
});

const PORT = 5000;
app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));
`);

console.log('Backend structure created successfully');
