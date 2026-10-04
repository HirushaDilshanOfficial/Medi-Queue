const Policy = require('../models/Policy');

// @desc    Get global policy settings
// @route   GET /api/policies
// @access  Private (MOH)
const getPolicy = async (req, res) => {
  try {
    let policy = await Policy.findOne();
    
    // If no policy document exists yet, create one with defaults
    if (!policy) {
      policy = await Policy.create({});
    }

    res.status(200).json(policy);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching policies', error: error.message });
  }
};

// @desc    Update global policy settings
// @route   PUT /api/policies
// @access  Private (MOH)
const updatePolicy = async (req, res) => {
  try {
    const { targetWaitTime, priorityQueue, tokenAutoExpiry, dataMasking } = req.body;
    
    let policy = await Policy.findOne();

    if (!policy) {
      policy = new Policy();
    }

    // Update fields if provided in request
    if (targetWaitTime !== undefined) policy.targetWaitTime = targetWaitTime;
    if (priorityQueue !== undefined) policy.priorityQueue = priorityQueue;
    if (tokenAutoExpiry !== undefined) policy.tokenAutoExpiry = tokenAutoExpiry;
    if (dataMasking !== undefined) policy.dataMasking = dataMasking;

    const updatedPolicy = await policy.save();

    res.status(200).json({ message: 'Policies updated successfully', policy: updatedPolicy });
  } catch (error) {
    res.status(500).json({ message: 'Server error updating policies', error: error.message });
  }
};

module.exports = {
  getPolicy,
  updatePolicy
};
