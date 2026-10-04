const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { asyncHandler, createError } = require('../utils/errorHandler');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    throw createError('Please provide name, email and password', 400);
  }

  const userExists = await User.findOne({ email });

  if (userExists) {
    throw createError('User already exists', 400);
  }

  const user = await User.create({
    name,
    email,
    password,
    role: role ? role.toLowerCase() : 'patient',
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } else {
    throw createError('Invalid user data', 400);
  }
});

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw createError('Please provide email and password', 400);
  }

  const user = await User.findOne({ email });

  if (user && user.password === password) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } else {
    throw createError('Invalid email or password', 401);
  }
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } else {
    throw createError('User not found', 404);
  }
});

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
};

