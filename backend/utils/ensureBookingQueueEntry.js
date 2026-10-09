const OpdQueueEntry = require('../models/OpdQueueEntry');
const OpdAppointment = require('../models/OpdAppointment');
const Policy = require('../models/Policy');
const { nextTokenNumber } = require('../models/OpdQueueCounter');
const { generatePassCode } = require('./queuePass');

async function ensureBookingQueueEntry(appointment) {
  if (appointment.queueEntry) {
    const existing = await OpdQueueEntry.findById(appointment.queueEntry);
    if (existing) return existing;
  }

  const existing = await OpdQueueEntry.findOne({ appointment: appointment._id });
  if (existing) {
    await OpdAppointment.updateOne(
      { _id: appointment._id },
      { $set: { queueEntry: existing._id, tokenNumber: existing.tokenNumber } },
    );
    return existing;
  }

  const policy = await Policy.findOne().lean();
  const tokenNumber = appointment.tokenNumber || await nextTokenNumber(
    appointment.department,
    appointment.date,
  );
  const doctor = appointment.doctor && typeof appointment.doctor === 'object'
    ? appointment.doctor
    : null;

  const entry = await OpdQueueEntry.create({
    appointment: appointment._id,
    profile: appointment.profile,
    department: appointment.department,
    queueDate: appointment.date,
    tokenNumber,
    passCode: generatePassCode(),
    doctor: doctor?._id || appointment.doctor,
    doctorName: appointment.doctorName,
    room: appointment.room || doctor?.room || null,
    avgConsultMinutes: Number(doctor?.avgConsultMinutes) || Number(policy?.targetWaitTime) || 10,
    priority: 'normal',
    status: 'waiting',
  });

  await OpdAppointment.updateOne(
    { _id: appointment._id },
    { $set: { queueEntry: entry._id, tokenNumber } },
  );
  return entry;
}

module.exports = { ensureBookingQueueEntry };
