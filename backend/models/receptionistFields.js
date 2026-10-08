const mongoose = require('mongoose');

const options = { timestamps: true, strict: 'throw' };
const ref = (model, required = true) => ({ type: mongoose.Schema.Types.ObjectId, ref: model, required });
const text = (maxlength = 100) => ({ type: String, trim: true, required: true, maxlength });
const positiveInteger = (max = Number.MAX_SAFE_INTEGER) => ({
  type: Number, required: true, min: 1, max,
  validate: { validator: Number.isSafeInteger, message: '{PATH} must be a whole number.' },
});
function isDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
const dateKey = () => ({ type: String, required: true, validate: { validator: isDateKey, message: '{PATH} must be a real YYYY-MM-DD date.' } });
function localDate(value) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) throw new Error('Could not determine the hospital date');
  return `${year}-${month}-${day}`;
}
function endAfterStart(value) { return this.startsAt instanceof Date && value > this.startsAt; }
module.exports = { options, ref, text, positiveInteger, dateKey, localDate, endAfterStart };
