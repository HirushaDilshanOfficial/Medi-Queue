const User = require('../models/User');
const Staff = require('../models/Staff');
const Doctor = require('../models/Doctor');
const generateToken = require('../utils/generateToken');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');

// @desc    Auth user & get token (Login)
// @route   POST /api/v1/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      let hospital = null;
      let hospitalName = '';
      let doctorId = null;

      try {
        const staff = await Staff.findOne({
          $or: [{ userId: user._id }, { email: user.email }],
        }).populate('hospital');

        if (staff) {
          hospital = staff.hospital?._id || staff.hospital || null;
          hospitalName = staff.hospitalName || staff.hospital?.name || '';
        }

        const cleanName = user.fullName.replace(/^Dr\.\s*/i, '').trim();
        const doc = await Doctor.findOne({
          name: { $regex: cleanName, $options: 'i' },
        }).populate('hospital');

        if (doc) {
          doctorId = doc._id;
          if (!hospitalName) {
            hospitalName = doc.hospitalName || doc.hospital?.name || '';
          }
          if (!hospital) {
            hospital = doc.hospital?._id || doc.hospital || null;
          }
        }
      } catch (err) {
        // Ignore lookup error
      }

      if (!hospitalName && (user.role === 'Doctor' || user.role === 'doctor')) {
        hospitalName = 'Colombo Teaching Hospital 1';
      }

      res.json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        hospital,
        hospitalName,
        doctorId,
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

// @desc    Send OTP to user email
// @route   POST /api/v1/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found with this email' });
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set OTP and expiration (10 minutes)
    user.resetPasswordOTP = otp;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    // Send email using nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Medi-Queue - Password Reset OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
          <h2 style="color: #00796B; text-align: center;">Medi-Queue Password Reset</h2>
          <p style="font-size: 16px; color: #333;">Hello <strong>${user.fullName}</strong>,</p>
          <p style="font-size: 16px; color: #333;">You have requested to reset your password. Use the OTP below to proceed:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #00796B; letter-spacing: 5px; padding: 10px 20px; background: #e0f2f1; border-radius: 8px;">${otp}</span>
          </div>
          <p style="font-size: 14px; color: #666;">This OTP is valid for only 10 minutes. If you did not request a password reset, please ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999; text-align: center;">&copy; ${new Date().getFullYear()} Medi-Queue. All rights reserved.</p>
        </div>
      `,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ message: 'Error sending OTP email' });
      } else {
        return res.status(200).json({ message: 'OTP sent successfully to email' });
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify OTP
// @route   POST /api/v1/auth/verify-otp
// @access  Public
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.resetPasswordOTP !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (user.resetPasswordExpires < Date.now()) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    res.status(200).json({ message: 'OTP verified successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reset Password
// @route   POST /api/v1/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.resetPasswordOTP !== otp || user.resetPasswordExpires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Update password
    user.password = newPassword; // Will be hashed automatically by pre-save hook
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  loginUser,
  registerPatient,
  registerStaff,
  forgotPassword,
  verifyOTP,
  resetPassword,
};
