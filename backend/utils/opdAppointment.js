const mongoose = require('mongoose');
const OpdAppointment = require('../models/OpdAppointment');
const { mapDoctor } = require('../utils/mapDoctor');

const ACTIVE_STATUSES = OpdAppointment.ACTIVE_STATUSES;

function clockLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// Full form, used for the line under "Today" on the pass. The options match the
// frontend's `longDayLabel` so a date never renders two different ways.
function humanDate(dateKey) {
  return toDate(dateKey, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Compact form, used when a date is far enough away that "Today" does not apply
// and a full month name would crowd out the token number.
function shortDate(dateKey) {
  return toDate(dateKey, { weekday: 'short', day: 'numeric', month: 'short' });
}

function toDate(dateKey, options) {
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey;
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    ...options,
    timeZone: 'UTC',
  });
}

// Relative wording the pass card uses: Today / Tomorrow / a real date.
function relativeDate(dateKey, todayKey) {
  if (dateKey === todayKey) return 'Today';
  const next = new Date(`${todayKey}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  if (dateKey === next.toISOString().slice(0, 10)) return 'Tomorrow';
  return shortDate(dateKey);
}

function mapAppointment(appointment, { todayKey, live } = {}) {
  if (!appointment) return null;

  return {
    id: String(appointment._id),
    doctorId: appointment.doctor ? String(appointment.doctor) : null,
    doctorName: appointment.doctorName,
    department: appointment.department,
    room: appointment.room || null,
    date: appointment.date,
    dateLabel: appointment.date ? relativeDate(appointment.date, todayKey) : null,
    dateLong: humanDate(appointment.date),
    slotTime: appointment.slotTime,
    endsAt: appointment.endsAt ? appointment.endsAt.toISOString() : null,
    type: appointment.type,
    status: appointment.status,
    isActive: appointment.isActive,
    tokenNumber: appointment.tokenNumber ?? null,
    queueEntryId: appointment.queueEntry ? String(appointment.queueEntry) : null,
    reason: appointment.reason || null,
    canReschedule: ACTIVE_STATUSES.includes(appointment.status),
    canCancel: ACTIVE_STATUSES.includes(appointment.status),
    live: live || null,
    createdAt: appointment.createdAt ? appointment.createdAt.toISOString() : null,
  };
}

module.exports = {
  mapAppointment,
  mapDoctor,
  clockLabel,
  humanDate,
  shortDate,
  relativeDate,
  isValidObjectId: (id) => mongoose.Types.ObjectId.isValid(id),
};
