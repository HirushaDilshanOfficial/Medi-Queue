const Alert = require('../models/Alert');

// Get all active alerts
exports.getAllAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find({ status: 'Active' }).sort({ createdAt: -1 });
    res.status(200).json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ message: 'Failed to fetch alerts', error: error.message });
  }
};

// Create a new alert (Triggered by system/engine)
exports.createAlert = async (req, res) => {
  try {
    const { 
      hospitalId, hospitalName, location, priority, title, 
      description, metrics, aiRecommendation, category 
    } = req.body;

    const newAlert = new Alert({
      hospitalId,
      hospitalName,
      location,
      priority,
      title,
      description,
      metrics,
      aiRecommendation,
      category
    });

    await newAlert.save();
    res.status(201).json({ message: 'Alert generated successfully', alert: newAlert });
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({ message: 'Failed to generate alert', error: error.message });
  }
};

// Update alert status (Acknowledge / Resolve)
exports.updateAlertStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const alert = await Alert.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    res.status(200).json({ message: `Alert marked as ${status}`, alert });
  } catch (error) {
    console.error('Error updating alert:', error);
    res.status(500).json({ message: 'Failed to update alert status', error: error.message });
  }
};

// Get monthly analytics (Aggregations)
exports.getAnalytics = async (req, res) => {
  try {
    // 1. Total Alerts by Category
    const categoryStats = await Alert.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    // 2. Total Alerts by Hospital (Top 5)
    const hospitalStats = await Alert.aggregate([
      { $group: { _id: '$hospitalName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // 3. Status Breakdown
    const statusStats = await Alert.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      categoryStats,
      hospitalStats,
      statusStats
    });
  } catch (error) {
    console.error('Error generating analytics:', error);
    res.status(500).json({ message: 'Failed to generate analytics', error: error.message });
  }
};
