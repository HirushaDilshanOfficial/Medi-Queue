const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// @desc    Auth user & get token (Login)
// @route   POST /api/v1/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Register a new Patient (Self-registration)
// @route   POST /api/v1/auth/patient/register
// @access  Public
const registerPatient = async (req, res) => {
  try {
    const { fullName, email, password, nic, birthday, gender, phone, bloodGroup } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      fullName,
      email,
      password,
      role: 'Patient', // Fixed role for self-registration
      nic,
      birthday,
      gender,
      phone,
      bloodGroup,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Register a Doctor or Receptionist (MOH only)
// @route   POST /api/v1/auth/staff/register
// @access  Private/MOH
const registerStaff = async (req, res) => {
  try {
    const { fullName, email, password, role, phone } = req.body;

    // Ensure they only create Doctors or Receptionists
    if (role !== 'Doctor' && role !== 'Receptionist') {
      return res.status(400).json({ message: 'Invalid role assignment' });
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'Staff member already exists' });
    }

    const user = await User.create({
      fullName,
      email,
      password,
      role, // Passed from request ('Doctor' or 'Receptionist')
      phone,
    });

    if (user) {
      res.status(201).json({
        message: `${role} registered successfully!`,
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      });
    } else {
      res.status(400).json({ message: 'Invalid staff data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  loginUser,
  registerPatient,
  registerStaff,
};
