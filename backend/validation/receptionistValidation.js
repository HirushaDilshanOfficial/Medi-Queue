const mongoose = require('mongoose');
const { localDate } = require('../models/receptionistFields');
const defaultModels = {
  User: require('../models/User'),
  Patient: require('../models/Patient'),
  Doctor: require('../models/Doctor'),
  Schedule: require('../models/Schedule'),
  Slot: require('../models/Slot'),
  Appointment: require('../models/Appointment'),
  QueueEntry: require('../models/QueueEntry'),
};
const sameId = (a, b) => a != null && b != null && String(a._id || a) === String(b._id || b);

/**
 * Validate a complete new or loaded document before saving.
 * Dependencies may be injected for database-free relationship tests.
 * No records are written here.
 */
async function validateReceptionistDocument(document, models = defaultModels) {
  await document.validate();
  const invalid = (path, message) => {
    const error = new mongoose.Error.ValidationError(document);
    error.addError(path, new mongoose.Error.ValidatorError({ path, message }));
    throw error;
  };
  async function get(model, id, path) {
    if (id == null) return null;
    const result = await models[model].findById(id._id || id);
    if (!result) invalid(path, model + ' record does not exist.');
    return result;
  }
  switch (document.constructor.modelName) {
    case 'Patient': {
      const user = await get('User', document.user, 'user');
      if (user && user.role !== 'patient') invalid('user', 'A patient profile must reference a patient user.');
      break;
    }
    case 'Doctor': {
      const user = await get('User', document.user, 'user');
      if (user.role !== 'doctor') invalid('user', 'A doctor profile must reference a doctor user.');
      break;
    }
    case 'Schedule':
      await get('Doctor', document.doctor, 'doctor');
      break;
    case 'Slot': {
      const schedule = await get('Schedule', document.schedule, 'schedule');
      if (document.startsAt < schedule.startsAt || document.endsAt > schedule.endsAt) invalid('startsAt', 'Slot must fit inside its schedule.');
      break;
    }
    case 'Appointment': {
      const patient = await get('Patient', document.patient, 'patient');
      const creator = await get('User', document.createdBy, 'createdBy');
      if (document.source === 'walk_in' && !['receptionist', 'admin'].includes(creator.role)) invalid('createdBy', 'Walk-ins must be registered by reception staff or an administrator.');
      if (document.source === 'online' && !['patient', 'receptionist', 'admin'].includes(creator.role)) invalid('createdBy', 'This user cannot create an online appointment.');
      if (creator.role === 'patient' && !sameId(patient.user, creator._id)) invalid('patient', 'A patient user can book only their own patient profile.');
      const doctor = await get('Doctor', document.doctor, 'doctor');
      if (document.isNew && doctor && !doctor.isActive) invalid('doctor', 'Cannot book an inactive doctor.');
      const slot = await get('Slot', document.slot, 'slot');
      if (slot) {
        const schedule = await get('Schedule', slot.schedule, 'slot');
        if (!sameId(document.doctor, schedule.doctor)) invalid('doctor', 'Appointment doctor must match the slot schedule.');
        if (document.visitDate !== localDate(slot.startsAt)) invalid('visitDate', 'Visit date must match the slot date in Asia/Colombo.');
        if (document.isNew && (slot.status !== 'available' || schedule.status !== 'scheduled')) invalid('slot', 'The selected slot is not available for booking.');
      }
      break;
    }
    case 'QueueEntry': {
      const appointment = await get('Appointment', document.appointment, 'appointment');
      if (document.queueDate !== appointment.visitDate) invalid('queueDate', 'Queue date must match the appointment visit date.');
      if (document.queueDate !== localDate(document.checkedInAt)) invalid('checkedInAt', 'Check-in date must match the queue date in Asia/Colombo.');
      if (document.isNew && !['booked', 'checked_in'].includes(appointment.status)) invalid('appointment', 'Only booked or checked-in appointments can enter the queue.');
      await get('Doctor', document.assignedDoctor, 'assignedDoctor');
      if (document.assignedDoctor && appointment.doctor && !sameId(document.assignedDoctor, appointment.doctor)) invalid('assignedDoctor', 'Queue doctor must match the appointment doctor.');
      break;
    }
    default:
      throw new TypeError('Unsupported receptionist document model.');
  }
  return document;
}

/** Pass errors to the unchanged Express errorHandler via next(error). */
function forwardReceptionistError(error, res, next) {
  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError || error instanceof mongoose.Error.StrictModeError) {
    res.status(400);
    // Do not put rejected patient field values into the HTTP response.
    const fields = error.errors ? Object.keys(error.errors).join(', ') : error.path || 'document';
    return next(new Error('Invalid receptionist data. Check: ' + fields + '.'));
  }
  if (error.code === 11000) {
    res.status(409);
    return next(new Error('A record with this identifier or queue token already exists.'));
  }
  return next(error);
}
module.exports = { validateReceptionistDocument, forwardReceptionistError };
