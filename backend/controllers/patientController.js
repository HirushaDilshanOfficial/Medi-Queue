const User = require('../models/User');

// Get all patients (excluding deleted, though User model doesn't have isDeleted by default)
exports.getAllPatients = async (req, res) => {
  try {
    const patients = await User.find({ role: 'Patient' }).sort({ createdAt: -1 });
    
    // Map phone to mobile for the frontend compatibility if needed
    const mappedPatients = patients.map(p => {
      const patientObj = p.toObject();
      return {
        ...patientObj,
        mobile: patientObj.phone, // The frontend uses `mobile`
        status: patientObj.status || 'Active', // Fallback status if not present
        patientNo: patientObj._id.toString().substring(0, 8).toUpperCase(), // Generate dummy patientNo if not present
      };
    });

    res.status(200).json(mappedPatients);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Update a patient
exports.updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Convert mobile to phone before saving
    const updateData = { ...req.body };
    if (updateData.mobile) {
      updateData.phone = updateData.mobile;
      delete updateData.mobile;
    }

    const updatedPatient = await User.findByIdAndUpdate(id, updateData, { new: true });

    if (!updatedPatient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    res.status(200).json({ message: 'Patient updated successfully', patient: updatedPatient });
  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Toggle patient status (Active/Inactive)
exports.togglePatientStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await User.findById(id);

    if (!patient || patient.role !== 'Patient') {
      return res.status(404).json({ message: 'Patient not found' });
    }

    patient.status = patient.status === 'Active' ? 'Inactive' : 'Active';
    await patient.save();

    res.status(200).json({ message: `Patient marked as ${patient.status}`, patient });
  } catch (error) {
    console.error('Error toggling patient status:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Soft delete a patient
exports.deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    // We do a hard delete or add isDeleted to User model
    const deletedPatient = await User.findByIdAndDelete(id);

    if (!deletedPatient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    res.status(200).json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};
