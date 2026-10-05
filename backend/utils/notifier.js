/**
 * Notification stub — logs to console instead of sending real SMS.
 * Swap the implementation when an SMS provider (e.g. Twilio, Dialog) is integrated.
 */

const sendSmsConfirmation = async (patient, token) => {
  console.log(
    `SMS queued to ${patient.phone}: Your token is ${token.tokenLabel}`
  );
};

module.exports = { sendSmsConfirmation };
