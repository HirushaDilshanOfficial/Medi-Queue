const Clinic = require('../models/Clinic');
const Hospital = require('../models/Hospital');
const { clinicDocuments } = require('../utils/clinicCatalogue');
const { asyncHandler } = require('../utils/errorHandler');

const listClinics = asyncHandler(async (req, res) => {
  const filter = { status: 'active' };
  if (req.query.hospitalId) filter.hospital = req.query.hospitalId;
  let clinics = await Clinic.find(filter).populate('hospital', 'name location').sort({ priority: 1, name: 1 }).lean();
  if (!clinics.length && !req.query.hospitalId) {
    const hospitals = await Hospital.find({ isDeleted: false }).select('_id').lean();
    await Promise.all(hospitals.map((hospital) => provisionHospitalClinics(hospital._id)));
    clinics = await Clinic.find(filter).populate('hospital', 'name location').sort({ priority: 1, name: 1 }).lean();
  }
  res.json({ clinics });
});

const listHospitalClinics = asyncHandler(async (req, res) => {
  const hospital = await Hospital.findById(req.params.hospitalId).select('name location status');
  if (!hospital || hospital.isDeleted) return res.status(404).json({ message: 'Hospital not found' });
  let clinics = await Clinic.find({ hospital: hospital._id }).sort({ priority: 1, name: 1 }).lean();
  if (!clinics.length) {
    await provisionHospitalClinics(hospital._id);
    clinics = await Clinic.find({ hospital: hospital._id }).sort({ priority: 1, name: 1 }).lean();
  }
  res.json({ hospital, clinics });
});

const updateClinic = asyncHandler(async (req, res) => {
  const allowed = ['description', 'clinicDays', 'startTime', 'endTime', 'maxPatients', 'status', 'priority'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  const clinic = await Clinic.findOneAndUpdate(
    { _id: req.params.id },
    updates,
    { new: true, runValidators: true },
  );
  if (!clinic) return res.status(404).json({ message: 'Clinic not found' });
  res.json({ clinic });
});

async function provisionHospitalClinics(hospitalId) {
  await Clinic.bulkWrite(
    clinicDocuments(hospitalId).map((document) => ({
      updateOne: {
        filter: { hospital: hospitalId, name: document.name },
        update: { $setOnInsert: document },
        upsert: true,
      },
    })),
  );
}

module.exports = { listClinics, listHospitalClinics, updateClinic, provisionHospitalClinics };
