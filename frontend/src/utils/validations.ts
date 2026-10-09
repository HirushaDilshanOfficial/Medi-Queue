// Utility functions for input validation and normalization

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};

// ─────────────────────────────────────────────────────────
// Sri Lankan NIC & Phone Validation (Matching Backend Rules)
// ─────────────────────────────────────────────────────────

// Old format: 9 digits + V or X (e.g. 912345678V, 912345678X)
// New format: exactly 12 digits (e.g. 199418201234)
const NIC_OLD = /^\d{9}[VXvx]$/;
const NIC_NEW = /^\d{12}$/;

/**
 * Validates Sri Lankan National Identity Card (NIC).
 * Accepts old 9-digit+V/X format or new 12-digit format.
 */
export const isValidNIC = (nic: string): boolean => {
  if (typeof nic !== 'string') return false;
  const trimmed = nic.trim();
  return NIC_OLD.test(trimmed) || NIC_NEW.test(trimmed);
};

// Accepts: 0771234567, +94771234567, 94771234567
const SL_PHONE = /^(?:0|(?:\+?94))([1-9]\d{8})$/;

/**
 * Validates Sri Lankan mobile/landline phone number formats.
 */
export const isValidSLPhone = (phone: string): boolean => {
  if (typeof phone !== 'string') return false;
  return SL_PHONE.test(phone.trim());
};

/**
 * Normalizes any valid Sri Lankan phone number to standard 0XXXXXXXXX (10 digits) format.
 * Returns null if the phone number is invalid.
 */
export const normalizePhone = (phone: string): string | null => {
  if (typeof phone !== 'string') return null;
  const match = phone.trim().match(SL_PHONE);
  if (!match) return null;
  return '0' + match[1]; // 9 digits after the prefix prefixed with 0
};

/**
 * Normalizes NIC to uppercase trimmed format.
 */
export const normalizeNIC = (nic: string): string | null => {
  if (typeof nic !== 'string') return null;
  return nic.trim().toUpperCase();
};
