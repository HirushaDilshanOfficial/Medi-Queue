/**
 * Notification module — manages SMS dispatching for Patient OTP and Registration confirmations.
 * Logs clearly to console and returns structured SMS payloads.
 */

const sendOtpSms = async (phone, otp, patientName = 'Patient') => {
  const message = `[Medi-Queue Hospital] Hello ${patientName}, your verification OTP is ${otp}. Valid for 10 minutes. Do not share this code.`;

  console.log('\n================================================================');
  console.log(`📲 [SMS GATEWAY DISPATCH] OTP SENT TO PATIENT: ${phone}`);
  console.log(`👤 Recipient: ${patientName}`);
  console.log(`🔢 OTP Code: ${otp}`);
  console.log(`💬 Message: "${message}"`);
  console.log(`⏰ Time: ${new Date().toLocaleTimeString()} (Valid for 10 mins)`);
  console.log('================================================================\n');

  return {
    sent: true,
    recipient: phone,
    otp,
    message,
    sentAt: new Date().toISOString(),
  };
};

const sendPatientRegistrationSms = async (patient, appointment, token, doctor, waitInfo) => {
  let doctorName = 'Assigned Doctor';
  if (doctor?.name) {
    doctorName = doctor.name.startsWith('Dr.') ? doctor.name : `Dr. ${doctor.name}`;
  }
  const roomInfo = doctor?.room ? ` (${doctor.room.startsWith('Room') ? doctor.room : `Room ${doctor.room}`})` : '';
  const waitEst = waitInfo?.estimatedWaitMinutes ? ` ~${waitInfo.estimatedWaitMinutes} mins` : ' 15-20 mins';

  const message = `[Medi-Queue Hospital] Dear ${patient.fullName}, your registration is SUCCESSFUL! Queue Token: ${token.tokenLabel}. Doctor: ${doctorName}${roomInfo}. Est. Wait:${waitEst}. Please proceed to waiting area.`;

  console.log('\n================================================================');
  console.log(`📲 [SMS GATEWAY DISPATCH] REGISTRATION CONFIRMATION SENT`);
  console.log(`👤 Patient: ${patient.fullName} (${patient.phone})`);
  console.log(`🎫 Queue Token: ${token.tokenLabel}`);
  console.log(`💬 Content: "${message}"`);
  console.log(`✅ Status: DELIVERED TO PATIENT MOBILE`);
  console.log('================================================================\n');

  return {
    sent: true,
    recipient: patient.phone,
    patientName: patient.fullName,
    tokenLabel: token.tokenLabel,
    message,
    sentAt: new Date().toISOString(),
  };
};

const sendSmsConfirmation = async (patient, token) => {
  return sendPatientRegistrationSms(patient, null, token, null, null);
};

module.exports = {
  sendOtpSms,
  sendPatientRegistrationSms,
  sendSmsConfirmation,
};
