const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const optionalAuth = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      req.user = await User.findById(decoded.id).select('-password');
    } catch (e) {
      // Ignore token failure for optional routes
    }
  }
  next();
};

const Policy = require('../models/Policy');

const maskSensitiveData = async (req, res, next) => {
  try {
    let policy = await Policy.findOne().catch(() => null);
    if (!policy || policy.dataMasking) {
      const originalJson = res.json;
      res.json = function (data) {
        const maskObject = (obj) => {
          if (!obj) return obj;
          if (Array.isArray(obj)) {
            obj.forEach(maskObject);
          } else if (typeof obj === 'object') {
            for (const key in obj) {
              if (Object.prototype.hasOwnProperty.call(obj, key)) {
                if (key === 'nic' && typeof obj[key] === 'string' && obj[key].length > 4 && obj[key] !== 'N/A') {
                  obj[key] = obj[key].replace(/^(.{4})(.*)(.{2})$/, '$1****$3');
                } else if ((key === 'phone' || key === 'contactNumber') && typeof obj[key] === 'string' && obj[key].length > 4) {
                  obj[key] = obj[key].replace(/^(.{3})(.*)(.{2})$/, '$1****$3');
                } else if (key === 'fileRecord' && typeof obj[key] === 'string' && obj[key].startsWith('NIC: ')) {
                  obj[key] = obj[key].replace(/^NIC: (.{4})(.*)(.{2})$/, 'NIC: $1****$3');
                } else {
                  maskObject(obj[key]);
                }
              }
            }
          }
          return obj;
        };

        if (data && typeof data === 'object') {
          // Clone data so we don't mutate DB instances unexpectedly if they are referenced
          try {
            data = JSON.parse(JSON.stringify(data));
          } catch(e){}
          maskObject(data);
        }
        
        return originalJson.call(this, data);
      };
    }
  } catch (err) {
    console.error('Masking error:', err);
  }
  next();
};

router.use(optionalAuth);
router.use(maskSensitiveData);
const {
  getDoctorDashboard,
  updateDoctorStatus,
  updateDoctorHospital,
  getDoctorHospitals,
  callNextPatient,
  undoPatientConsultation,
  ringChime,
  callSpecificPatient,
  getDoctorSchedule,
  addWalkInSlot,
  toggleDoctorBreak,
  getPrescriptionDetails,
  savePrescription,
  referPatient,
  getPatientRecords,
  updatePatientVitals,
  generatePrescriptionPdfApi,
  removeScheduleAppointment,
  getDoctorReportFile,
} = require('../controllers/doctorController');

router.get('/dashboard', getDoctorDashboard);
router.patch('/status', updateDoctorStatus);
router.patch('/hospital', updateDoctorHospital);
router.get('/hospitals', getDoctorHospitals);
router.post('/call-next', callNextPatient);
router.post('/undo-patient', undoPatientConsultation);
router.post('/chime', ringChime);
router.post('/call-token', callSpecificPatient);
router.get('/schedule', getDoctorSchedule);
router.post('/walkin-slot', addWalkInSlot);
router.delete('/schedule/appointment/:id', removeScheduleAppointment);
router.delete('/appointment/:id', removeScheduleAppointment);
router.post('/schedule/remove', removeScheduleAppointment);
router.post('/break', toggleDoctorBreak);
router.get('/prescription', getPrescriptionDetails);
router.post('/prescription', savePrescription);
router.post('/prescription/pdf', generatePrescriptionPdfApi);
router.post('/referral', referPatient);
router.get('/records', getPatientRecords);
router.get('/reports/:id/file', getDoctorReportFile);
router.post('/vitals', updatePatientVitals);

module.exports = router;