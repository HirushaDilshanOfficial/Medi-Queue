const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { asyncHandler, createError } = require('../utils/errorHandler');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '30d',
  });
};

const registerUser = asyncHandler(async (req, res) => {
  const {
    name,
    fullName,
    email,
    password,
    role,
    nic,
    birthday,
    gender,
    phone,
    bloodGroup,
  } = req.body;
  const normalizedName = String(fullName || name || '').trim();
  const roleNames = {
    moh: 'MOH',
    doctor: 'Doctor',
    nurse: 'Nurse',
    receptionist: 'Receptionist',
    pharmacist: 'Pharmacist',
    'lab technician': 'Lab Technician',
    other: 'Other',
    patient: 'Patient',
  };
  const normalizedRole = roleNames[String(role || 'patient').toLowerCase()];

  if (!normalizedName || !email || !password) {
    throw createError('Please provide name, email and password', 400);
  }
  if (!normalizedRole) {
    throw createError('Invalid user role', 400);
  }
  if (normalizedRole === 'Patient' && !nic) {
    throw createError('NIC is required for patient registration', 400);
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    throw createError('User already exists', 400);
  }

  const user = await User.create({
    fullName: normalizedName,
    email,
    password,
    role: normalizedRole,
    nic,
    birthday,
    gender: gender
      ? `${gender[0].toUpperCase()}${gender.slice(1).toLowerCase()}`
      : undefined,
    phone,
    bloodGroup,
  });

  res.status(201).json({
    _id: user._id,
    name: user.fullName,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    token: generateToken(user._id),
  });
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw createError('Please provide email and password', 400);
  }

  const user = await User.findOne({ email });
  if (!user || !(await user.matchPassword(password))) {
    throw createError('Invalid email or password', 401);
  }

  res.json({
    _id: user._id,
    name: user.fullName,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    token: generateToken(user._id),
  });
});

const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw createError('User not found', 404);
  }

  res.json({
    _id: user._id,
    name: user.fullName,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
  });
});

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
};

