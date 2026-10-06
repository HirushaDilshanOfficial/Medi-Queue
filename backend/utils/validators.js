/**
 * Input validators and normalizers for Sri Lankan data formats.
 */

// Old format: 9 digits + V or X (e.g. 912345678V)
// New format: exactly 12 digits (e.g. 200012345678)
const NIC_OLD = /^\d{9}[VXvx]$/;
const NIC_NEW = /^\d{12}$/;

const isValidNIC = (nic) => {
  if (typeof nic !== 'string') return false;
  const trimmed = nic.trim();
  return NIC_OLD.test(trimmed) || NIC_NEW.test(trimmed);
};

// Accepts: 0771234567, +94771234567, 94771234567
const SL_PHONE = /^(?:0|(?:\+?94))([1-9]\d{8})$/;

const isValidSLPhone = (phone) => {
  if (typeof phone !== 'string') return false;
  return SL_PHONE.test(phone.trim());
};

// Converts any valid SL phone to 0XXXXXXXXX format
const normalizePhone = (phone) => {
  if (typeof phone !== 'string') return null;
  const match = phone.trim().match(SL_PHONE);
  if (!match) return null;
  return '0' + match[1]; // captured group is the 9 digits after the prefix
};

const normalizeNIC = (nic) => {
  if (typeof nic !== 'string') return null;
  return nic.trim().toUpperCase();
};

// Validates YYYY-MM-DD and checks the date is real (e.g. rejects 2026-02-30)
const isValidDate = (str) => {
  if (typeof str !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const date = new Date(str + 'T00:00:00Z');
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === str;
};

// Validates HH:mm (00:00 – 23:59)
const isValidSlot = (str) => {
  if (typeof str !== 'string') return false;
  if (!/^\d{2}:\d{2}$/.test(str)) return false;
  const [h, m] = str.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
};

module.exports = {
  isValidNIC,
  isValidSLPhone,
  normalizePhone,
  normalizeNIC,
  isValidDate,
  isValidSlot,
};
