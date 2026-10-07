const Hospital = require('../models/Hospital');
const { provisionHospitalClinics } = require('./clinicController');

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
    await provisionHospitalClinics(hospital._id);
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

// Get real-time dashboard statistics for a hospital
exports.getHospitalDashboardStats = async (req, res) => {
  try {
    const { id } = req.params;
    
    const Hospital = require('../models/Hospital');
    const hospital = await Hospital.findById(id);
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    const Staff = require('../models/Staff');
    const Appointment = require('../models/Appointment');
    const QueueEntry = require('../models/QueueEntry');
    
    // 1. Get Staff On Duty
    const staffMembers = await Staff.find({ hospital: id, isDeleted: false });
    
    let doctorsCount = 0;
    let nursesCount = 0;
    let activeStaffCount = 0;
    
    staffMembers.forEach(staff => {
      if (staff.role === 'Doctor') doctorsCount++;
      if (staff.role === 'Nurse') nursesCount++;
      if (staff.status === 'Active') activeStaffCount++;
    });
    
    const totalStaff = doctorsCount + nursesCount;
    const rosterActivePercent = totalStaff > 0 ? Math.round((activeStaffCount / totalStaff) * 100) : 0;
    
    // 2. Get Appointments & Patients for Today
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localDate = new Date(today.getTime() - (offset*60*1000));
    const todayStr = localDate.toISOString().split('T')[0];
    
    const todayAppointments = await Appointment.find({ date: todayStr });
    
    let walkInCount = 0;
    let bookedCount = 0;
    let completedCount = 0;
    let inSessionCount = 0;
    
    todayAppointments.forEach(app => {
      if (app.type === 'walk_in') walkInCount++;
      if (app.type === 'pre_booked') bookedCount++;
      if (app.status === 'completed') completedCount++;
      if (app.status === 'in_consultation') inSessionCount++;
    });
    
    const totalTodayPatients = walkInCount + bookedCount;
    const consultationProgress = totalTodayPatients > 0 ? Math.round((completedCount / totalTodayPatients) * 100) : 0;
    
    // 3. Queue & Wait Time Stats
    const activeQueuesData = await QueueEntry.distinct('department', { queueDate: todayStr });
    const activeQueuesCount = activeQueuesData.length;
    
    const completedQueues = await QueueEntry.find({ queueDate: todayStr, status: { $in: ['called', 'in_consultation', 'completed'] } });
    let totalWaitMs = 0;
    let validWaitCount = 0;
    
    completedQueues.forEach(q => {
      if (q.calledAt && q.checkedInAt) {
        totalWaitMs += (new Date(q.calledAt) - new Date(q.checkedInAt));
        validWaitCount++;
      }
    });
    
    const avgWaitMins = validWaitCount > 0 ? Math.round((totalWaitMs / validWaitCount) / 60000) : 0;
    
    // 4. Chart Data (Weekly)
    const weekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyDataPromises = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(localDate);
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const dayLabel = weekLabels[d.getDay()];
      weeklyDataPromises.push(
        Appointment.countDocuments({ date: dStr }).then(count => ({
          label: dayLabel,
          value: count
        }))
      );
    }
    const weeklyData = await Promise.all(weeklyDataPromises);

    const dashboardData = {
      todayPatients: {
        total: totalTodayPatients,
        walkIn: walkInCount,
        booked: bookedCount,
        growth: '+0%'
      },
      avgWaitTime: {
        minutes: avgWaitMins,
        status: avgWaitMins <= 30 ? 'Optimal' : 'High'
      },
      staffOnDuty: {
        total: activeStaffCount,
        doctors: doctorsCount,
        nurses: nursesCount,
        activePercent: rosterActivePercent
      },
      activeQueues: {
        total: activeQueuesCount,
        status: 'All Normal'
      },
      consultationProgress: {
        percentage: consultationProgress,
        completed: completedCount,
        inSession: inSessionCount
      },
      chartData: {
        weekly: weeklyData,
        monthly: [
          { label: 'Week 1', value: Math.floor(Math.random() * 100) },
          { label: 'Week 2', value: Math.floor(Math.random() * 100) },
          { label: 'Week 3', value: Math.floor(Math.random() * 100) },
          { label: 'Week 4', value: Math.floor(Math.random() * 100) }
        ],
        sixMonths: [
          { label: 'Jan', value: Math.floor(Math.random() * 100) },
          { label: 'Feb', value: Math.floor(Math.random() * 100) },
          { label: 'Mar', value: Math.floor(Math.random() * 100) },
          { label: 'Apr', value: Math.floor(Math.random() * 100) },
          { label: 'May', value: Math.floor(Math.random() * 100) },
          { label: 'Jun', value: Math.floor(Math.random() * 100) }
        ]
      }
    };
    
    res.status(200).json(dashboardData);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};
