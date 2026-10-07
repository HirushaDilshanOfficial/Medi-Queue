const Staff = require('../models/Staff');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const { provisionDoctorBookingSlots } = require('../utils/doctorScheduleProvisioning');

// Add a new staff member
exports.addStaff = async (req, res) => {
  try {
    const { email, password, fullName, role } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Create User document for authentication
    const user = await User.create({
      fullName,
      email,
      password,
      role,
    });

    if (!user) {
      return res.status(400).json({ message: 'Failed to create user account' });
    }

    // Create Staff document
    const staffData = {
      ...req.body,
      userId: user._id,
      hospital: req.body.hospitalId, // Map frontend field to model field
    };

    const newStaff = await Staff.create(staffData);

    if (String(role).toLowerCase() === 'doctor') {
      const doctor = await Doctor.create({
        staffId: newStaff._id,
        name: fullName,
        specialization: req.body.specialization,
        department: req.body.department,
        hospital: newStaff.hospital,
        hospitalName: newStaff.hospitalName,
        status: 'active',
      });
      await provisionDoctorBookingSlots(doctor);
    }

    res.status(201).json({ message: 'Staff created successfully', staff: newStaff });
  } catch (error) {
    console.error('Error adding staff:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Get all staff members (excluding deleted)
exports.getAllStaff = async (req, res) => {
  try {
    const staffMembers = await Staff.find({ isDeleted: false })
      .populate('hospital', 'name code') // Populate hospital details
      .sort({ createdAt: -1 });
    res.status(200).json(staffMembers);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Update a staff member
exports.updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    if (req.body.hospitalId) {
      updateData.hospital = req.body.hospitalId;
    }

    const updatedStaff = await Staff.findByIdAndUpdate(id, updateData, { new: true });

    if (!updatedStaff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    // If email or fullName changed, also update the User document
    if (req.body.email || req.body.fullName || req.body.role) {
      const userUpdates = {};
      if (req.body.email) userUpdates.email = req.body.email;
      if (req.body.fullName) userUpdates.fullName = req.body.fullName;
      if (req.body.role) userUpdates.role = req.body.role;

      await User.findByIdAndUpdate(updatedStaff.userId, userUpdates);
    }

    if (String(updatedStaff.role).toLowerCase() === 'doctor') {
      const doctor = await Doctor.findOneAndUpdate(
        { staffId: updatedStaff._id },
        {
          name: updatedStaff.fullName,
          specialization: updatedStaff.specialization,
          department: updatedStaff.department,
          hospital: updatedStaff.hospital,
          hospitalName: updatedStaff.hospitalName,
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
      await provisionDoctorBookingSlots(doctor);
    }

    res.status(200).json({ message: 'Staff updated successfully', staff: updatedStaff });
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Soft delete a staff member
exports.deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedStaff = await Staff.findByIdAndUpdate(id, { isDeleted: true }, { new: true });

    if (!deletedStaff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    await Doctor.findOneAndUpdate(
      { staffId: deletedStaff._id },
      { status: 'offline' },
    );

    res.status(200).json({ message: 'Staff deleted successfully' });
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Toggle staff status (Active/Inactive)
exports.toggleStaffStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await Staff.findById(id);

    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    staff.status = staff.status === 'Active' ? 'Inactive' : 'Active';
    await staff.save();

    res.status(200).json({ message: `Staff marked as ${staff.status}`, staff });
  } catch (error) {
    console.error('Error toggling staff status:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};
