const Hospital = require('../models/Hospital');

// Add a new hospital
exports.addHospital = async (req, res) => {
  try {
    const { name, code, type, contact, location, departments } = req.body;

    // Check if hospital code already exists
    const existingHospital = await Hospital.findOne({ code });
    if (existingHospital) {
      return res.status(400).json({ message: 'Hospital code already exists' });
    }

    // Convert comma-separated departments to array if it's a string
    let deptArray = [];
    if (typeof departments === 'string') {
      deptArray = departments.split(',').map(d => d.trim()).filter(d => d);
    } else if (Array.isArray(departments)) {
      deptArray = departments;
    }

    const hospital = new Hospital({
      name,
      code,
      type,
      contact,
      location,
      departments: deptArray,
      status: 'Active'
    });

    await hospital.save();
    res.status(201).json({ message: 'Hospital added successfully', hospital });

  } catch (error) {
    console.error('Error adding hospital:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Get all hospitals
exports.getAllHospitals = async (req, res) => {
  try {
    const hospitals = await Hospital.find({ isDeleted: false }).sort({ createdAt: -1 });
    res.status(200).json(hospitals);
  } catch (error) {
    console.error('Error fetching hospitals:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Update a hospital
exports.updateHospital = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, type, contact, location, departments } = req.body;

    let deptArray = [];
    if (typeof departments === 'string') {
      deptArray = departments.split(',').map(d => d.trim()).filter(d => d);
    } else if (Array.isArray(departments)) {
      deptArray = departments;
    }

    const updatedHospital = await Hospital.findByIdAndUpdate(
      id,
      { name, code, type, contact, location, departments: deptArray },
      { new: true }
    );

    if (!updatedHospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    res.status(200).json({ message: 'Hospital updated successfully', hospital: updatedHospital });
  } catch (error) {
    console.error('Error updating hospital:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Delete a hospital (Soft Delete)
exports.deleteHospital = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedHospital = await Hospital.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );

    if (!deletedHospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    res.status(200).json({ message: 'Hospital deleted successfully' });
  } catch (error) {
    console.error('Error deleting hospital:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Toggle hospital status (Active/Inactive)
exports.toggleHospitalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const hospital = await Hospital.findById(id);

    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    hospital.status = hospital.status === 'Active' ? 'Inactive' : 'Active';
    await hospital.save();

    res.status(200).json({ message: `Hospital marked as ${hospital.status}`, hospital });
  } catch (error) {
    console.error('Error toggling hospital status:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};
