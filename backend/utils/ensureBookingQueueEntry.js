const OpdQueueEntry = require('../models/OpdQueueEntry');
const OpdAppointment = require('../models/OpdAppointment');
const Policy = require('../models/Policy');
const { nextTokenNumber } = require('../models/OpdQueueCounter');
const { generatePassCode } = require('./queuePass');

async function ensureBookingQueueEntry(appointment) {
  // Historical bookings must never be put back into the live queue by a read.
  if (!OpdAppointment.ACTIVE_STATUSES.includes(appointment.status)) return null;
  let existing = await OpdQueueEntry.findOne({ appointment: appointment._id });
  if (existing && existing.queueDate === appointment.date
    && existing.department === appointment.department
    && !['cancelled', 'completed', 'no_show'].includes(existing.status)) {
    await OpdAppointment.updateOne(
      { _id: appointment._id },
      { $set: { queueEntry: existing._id, tokenNumber: existing.tokenNumber } },
    );
    return existing;
  }

  const policy = await Policy.findOne().lean();
  let tokenNumber = !existing && appointment.tokenNumber;
  const doctor = appointment.doctor && typeof appointment.doctor === 'object'
    ? appointment.doctor
    : null;

  // Recover legacy duplicate token numbers and simultaneous list/pass reads.
  // The appointment and token indexes remain the final concurrency guards.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (!tokenNumber) tokenNumber = await nextTokenNumber(appointment.department, appointment.date);
    const values = {
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
    };
    let entry;
    try {
      entry = existing
        ? await OpdQueueEntry.findOneAndUpdate({ _id: existing._id }, { $set: values }, { new: true, runValidators: true })
        : await OpdQueueEntry.create(values);
    } catch (error) {
      if (error.code !== 11000) throw error;
      const winner = await OpdQueueEntry.findOne({ appointment: appointment._id });
      if (winner && winner.queueDate === appointment.date && winner.department === appointment.department
        && !['cancelled', 'completed', 'no_show'].includes(winner.status)) {
        await OpdAppointment.updateOne({ _id: appointment._id }, { $set: { queueEntry: winner._id, tokenNumber: winner.tokenNumber } });
        return winner;
      }
      existing = winner;
      tokenNumber = null;
      if (attempt === 4) throw error;
      continue;
    }

    await OpdAppointment.updateOne(
      { _id: appointment._id },
      { $set: { queueEntry: entry._id, tokenNumber } },
    );
    return entry;
  }
}

module.exports = { ensureBookingQueueEntry };
