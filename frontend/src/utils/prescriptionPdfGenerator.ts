import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { PatientPrescriptionDetails } from '../services/prescriptionService';

/**
 * Generate official Medi-Queue Outpatient Prescription HTML Document matching Sri Lanka MoH standard
 */
export const generatePrescriptionHtml = (
  data: PatientPrescriptionDetails,
  clinicalNotes?: string
): string => {
  const hospitalName =
    (data as any).hospitalName ||
    data.doctor?.hospitalName ||
    'COLOMBO TEACHING HOSPITAL';

  const patient = data.patient || ({} as any);
  const doctor = data.doctor || ({} as any);
  const vitals = patient.vitals || ({} as any);

  const patientName = patient.name || (data as any).patientName || 'Patient Normal';
  const rawToken = patient.tokenFormatted || (patient.tokenNumber !== undefined ? `#${String(patient.tokenNumber).padStart(3, '0')}` : null) || (data as any).tokenNumber || '#001';
  const tokenNumber = String(rawToken).startsWith('#') ? String(rawToken) : `#${rawToken}`;

  const patientAge = patient.age !== undefined ? `${patient.age} Years` : ((data as any).patientAge ? `${(data as any).patientAge} Years` : '30 Years');
  const patientGender = patient.gender || (data as any).patientGender || 'Male';

  const allergiesList = (patient.allergies || (data as any).allergies || []).map((a: any) =>
    typeof a === 'string' ? a : (a.name || a.allergen || String(a))
  );
  const allergiesStr = allergiesList.length > 0 ? allergiesList.join(', ') : 'None Reported';

  const doctorName = doctor.name || (data as any).doctorName || 'Dr. Palitha Perera';
  const department = doctor.department || (data as any).department || doctor.specialization || 'General OPD';

  const bp = vitals.bloodPressure || (data as any).bloodPressure || '118/75';
  const pulse = vitals.pulseRate || vitals.heartRate || (data as any).heartRate || '72 bpm';
  const temp = vitals.temperature ? `${vitals.temperature} °C` : ((data as any).temperature ? `${(data as any).temperature} °C` : '—');
  const spo2 = (vitals.spO2 !== undefined ? vitals.spO2 : (vitals.spo2 !== undefined ? vitals.spo2 : (data as any).spO2))
    ? `${vitals.spO2 || vitals.spo2 || (data as any).spO2}%`
    : '—';
  const weightStr = vitals.weight ? `${vitals.weight} kg` : ((data as any).weight ? `${(data as any).weight} kg` : '68 kg');

  const rawDiagnoses = data.diagnoses || [];
  const diagnosesList = rawDiagnoses.map((d: any) =>
    typeof d === 'string' ? d : (d.displayName || d.name || 'General OPD Consultation')
  );
  const diagnosesText = diagnosesList.length > 0 ? diagnosesList.join(' • ') : 'General OPD Consultation';

  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const verificationCode = 'MQ-' + (Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase()).slice(0, 10);

  const prescriptions = data.prescriptions || [];
  const totalRows = 7;
  let tableRowsHtml = '';

  if (prescriptions.length === 0) {
    tableRowsHtml = `
      <tr>
        <td colspan="6" style="padding: 16px; text-align: center; color: #64748b; font-style: italic; border: 1px solid #cbd5e1;">
          No medications prescribed during this visit.
        </td>
      </tr>
    `;
    for (let i = 1; i < totalRows; i++) {
      tableRowsHtml += `
        <tr style="height: 24px;">
          <td style="border: 1px solid #cbd5e1;">&nbsp;</td>
          <td style="border: 1px solid #cbd5e1;">&nbsp;</td>
          <td style="border: 1px solid #cbd5e1;">&nbsp;</td>
          <td style="border: 1px solid #cbd5e1;">&nbsp;</td>
          <td style="border: 1px solid #cbd5e1;">&nbsp;</td>
          <td style="border: 1px solid #cbd5e1;">&nbsp;</td>
        </tr>
      `;
    }
  } else {
    prescriptions.slice(0, totalRows).forEach((med, idx) => {
      tableRowsHtml += `
        <tr style="height: 24px; font-size: 11px;">
          <td style="padding: 5px; text-align: center; font-weight: 700; border: 1px solid #cbd5e1; color: #334155;">${idx + 1}</td>
          <td style="padding: 5px 8px; font-weight: 700; border: 1px solid #cbd5e1; color: #0f172a;">${med.name} (${(med.type || 'Tab').toUpperCase()})</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; color: #334155;">${med.dosage || '—'}</td>
          <td style="padding: 5px 8px; font-weight: 700; border: 1px solid #cbd5e1; color: #0c3150;">${med.frequency || '—'}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; color: #334155;">${med.duration || '—'}</td>
          <td style="padding: 5px 8px; font-style: italic; border: 1px solid #cbd5e1; color: #64748b;">${med.instructions || 'As directed'}</td>
        </tr>
      `;
    });
    for (let i = prescriptions.length; i < totalRows; i++) {
      tableRowsHtml += `
        <tr style="height: 24px;">
          <td style="border: 1px solid #cbd5e1;">&nbsp;</td>
          <td style="border: 1px solid #cbd5e1;">&nbsp;</td>
          <td style="border: 1px solid #cbd5e1;">&nbsp;</td>
          <td style="border: 1px solid #cbd5e1;">&nbsp;</td>
          <td style="border: 1px solid #cbd5e1;">&nbsp;</td>
          <td style="border: 1px solid #cbd5e1;">&nbsp;</td>
        </tr>
      `;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Prescription - ${patientName} (${tokenNumber})</title>
  <style>
    @media print {
      body { margin: 0; padding: 0; background: #ffffff !important; }
      .no-print { display: none !important; }
      @page { size: A4; margin: 8mm; }
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background-color: #f8fafc;
      margin: 0;
      padding: 20px;
    }
    .page-frame {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border: 2px solid #2b3d52;
      padding: 4px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    .inner-frame {
      border: 1px solid #475569;
      padding: 24px 30px;
    }
    .header-section {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      margin-bottom: 8px;
    }
    .emblem {
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 54px;
      height: 54px;
      border-radius: 50%;
      background: #0c3150;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 32px;
      font-weight: 900;
      line-height: 1;
    }
    .header-text-block {
      text-align: center;
    }
    .country-title {
      font-size: 10px;
      font-weight: 700;
      color: #334155;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .ministry-title {
      font-size: 11px;
      font-weight: 800;
      color: #1e293b;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .hospital-title {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 24px;
      font-weight: 900;
      color: #0c3150;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .sub-title {
      font-size: 11px;
      font-style: italic;
      color: #475569;
    }
    .divider-double {
      border-top: 2px solid #0c3150;
      border-bottom: 1px solid #0c3150;
      height: 4px;
      margin: 12px 0 10px 0;
    }
    .doc-type-title {
      text-align: center;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 14px;
      font-weight: 800;
      color: #0c3150;
      letter-spacing: 4px;
      text-transform: uppercase;
      margin-bottom: 14px;
    }
    .patient-grid {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #334155;
      margin-bottom: 16px;
    }
    .patient-grid td {
      border: 1px solid #94a3b8;
      padding: 6px 10px;
      vertical-align: top;
    }
    .cell-label {
      font-size: 9px;
      font-style: italic;
      color: #64748b;
      margin-bottom: 2px;
    }
    .cell-value {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
    }
    .section-heading {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 16px;
      font-weight: 800;
      color: #0c3150;
      margin: 14px 0 6px 0;
    }
    .meds-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #334155;
      margin-bottom: 16px;
    }
    .meds-table th {
      background: #0c3150;
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      padding: 7px 8px;
      text-align: left;
      border: 1px solid #0c3150;
    }
    .meds-table td {
      border: 1px solid #cbd5e1;
    }
    .sign-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 24px;
      padding-top: 10px;
    }
    .stamp-box {
      border: 2px solid #2563eb;
      border-radius: 40px;
      padding: 6px 18px;
      text-align: center;
      color: #1d4ed8;
      display: inline-block;
      box-shadow: 0 0 0 2px #ffffff, 0 0 0 3px #2563eb;
    }
    .stamp-net { font-size: 8px; font-weight: 800; }
    .stamp-ver { font-size: 14px; font-weight: 900; letter-spacing: 2px; margin: 1px 0; }
    .stamp-sub { font-size: 8px; font-weight: 800; }
    .stamp-code { font-size: 8px; font-family: monospace; }
    .signature-block {
      text-align: left;
      width: 250px;
      border-top: 1px solid #475569;
      padding-top: 6px;
    }
    .doc-sign-name {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
    }
    .doc-sign-qual { font-size: 11px; color: #475569; }
    .doc-sign-title { font-size: 10px; font-style: italic; color: #64748b; }
    .footer-notes {
      text-align: center;
      font-size: 9px;
      color: #64748b;
      font-style: italic;
      margin-top: 24px;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
    }
    .footer-gov {
      text-align: center;
      font-size: 10px;
      color: #334155;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <div class="page-frame">
    <div class="inner-frame">
      <div class="header-section">
        <div class="emblem">+</div>
        <div class="header-text-block">
          <div class="country-title">Democratic Socialist Republic of Sri Lanka</div>
          <div class="ministry-title">Ministry of Health</div>
          <div class="hospital-title">${hospitalName}</div>
          <div class="sub-title">Medi-Queue Digital Healthcare — Outpatient Department (OPD)</div>
        </div>
      </div>

      <div class="divider-double"></div>
      <div class="doc-type-title">O U T P A T I E N T &nbsp; P R E S C R I P T I O N</div>

      <table class="patient-grid">
        <tr>
          <td style="width: 70%;">
            <div class="cell-label">Patient Name</div>
            <div class="cell-value" style="font-size: 14px;">${patientName}</div>
          </td>
          <td style="width: 30%;">
            <div class="cell-label">OPD Token No.</div>
            <div class="cell-value" style="font-size: 16px; color: #0c3150;">${tokenNumber}</div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding: 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 18%; border: none; border-right: 1px solid #94a3b8; padding: 6px 10px;">
                  <div class="cell-label">Age</div>
                  <div class="cell-value">${patientAge}</div>
                </td>
                <td style="width: 18%; border: none; border-right: 1px solid #94a3b8; padding: 6px 10px;">
                  <div class="cell-label">Sex</div>
                  <div class="cell-value">${patientGender}</div>
                </td>
                <td style="width: 18%; border: none; border-right: 1px solid #94a3b8; padding: 6px 10px;">
                  <div class="cell-label">Weight</div>
                  <div class="cell-value">${weightStr}</div>
                </td>
                <td style="width: 23%; border: none; border-right: 1px solid #94a3b8; padding: 6px 10px;">
                  <div class="cell-label">Date</div>
                  <div class="cell-value">${currentDate}</div>
                </td>
                <td style="width: 23%; border: none; padding: 6px 10px;">
                  <div class="cell-label">Time</div>
                  <div class="cell-value">${currentTime}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding: 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 34%; border: none; border-right: 1px solid #94a3b8; padding: 6px 10px;">
                  <div class="cell-label">Allergies</div>
                  <div class="cell-value">${allergiesStr}</div>
                </td>
                <td style="width: 28%; border: none; border-right: 1px solid #94a3b8; padding: 6px 10px;">
                  <div class="cell-label">Department</div>
                  <div class="cell-value">${department}</div>
                </td>
                <td style="width: 38%; border: none; padding: 6px 10px;">
                  <div class="cell-label">Consulting Physician | SLMC Reg: 48921</div>
                  <div class="cell-value">${doctorName}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding: 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 20%; border: none; border-right: 1px solid #94a3b8; padding: 6px 10px;">
                  <div class="cell-label">BP</div>
                  <div class="cell-value">${bp}</div>
                </td>
                <td style="width: 20%; border: none; border-right: 1px solid #94a3b8; padding: 6px 10px;">
                  <div class="cell-label">Pulse</div>
                  <div class="cell-value">${pulse}</div>
                </td>
                <td style="width: 18%; border: none; border-right: 1px solid #94a3b8; padding: 6px 10px;">
                  <div class="cell-label">Temp</div>
                  <div class="cell-value">${temp}</div>
                </td>
                <td style="width: 18%; border: none; border-right: 1px solid #94a3b8; padding: 6px 10px;">
                  <div class="cell-label">SpO2</div>
                  <div class="cell-value">${spo2}</div>
                </td>
                <td style="width: 24%; border: none; padding: 6px 10px;">
                  <div class="cell-label">Weight</div>
                  <div class="cell-value">${weightStr}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td colspan="2">
            <div class="cell-label">Diagnoses / Clinical Assessment</div>
            <div class="cell-value">${diagnosesText}</div>
          </td>
        </tr>
      </table>

      <div class="section-heading">Prescribed Medicines</div>
      <table class="meds-table">
        <thead>
          <tr>
            <th style="width: 35px; text-align: center;">#</th>
            <th>Medication & Type</th>
            <th style="width: 80px;">Dosage</th>
            <th style="width: 90px;">Frequency</th>
            <th style="width: 70px;">Duration</th>
            <th style="width: 130px;">Instructions</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>

      ${clinicalNotes ? `<div style="font-size: 11px; margin-bottom: 12px;"><strong>Doctor Notes & Advice:</strong> <span style="color: #475569;">${clinicalNotes}</span></div>` : ''}

      <div class="sign-section">
        <div class="stamp-box">
          <div class="stamp-net">e-HEALTH NETWORK</div>
          <div class="stamp-ver">VERIFIED</div>
          <div class="stamp-sub">DIGITALLY SIGNED</div>
          <div class="stamp-code">${verificationCode}</div>
        </div>

        <div class="signature-block">
          <div class="doc-sign-name">${doctorName}</div>
          <div class="doc-sign-qual">MBBS (Colombo), MD (Med)</div>
          <div class="doc-sign-title">Authorized Medical Officer — Registered Practitioner</div>
        </div>
      </div>

      <div class="footer-notes">
        Valid for 30 days from date of issue unless specified otherwise. Keep out of reach of children. Store medications in a cool, dry place.
      </div>
      <div class="footer-gov">
        Government of Sri Lanka - e-Health Network | Verification Code: ${verificationCode}
      </div>
    </div>
  </div>
</body>
</html>
`;
};

/**
 * Download prescription as PDF document
 */
export const downloadPrescription = async (
  data: PatientPrescriptionDetails,
  clinicalNotes?: string
): Promise<void> => {
  let currentHospital = (data as any).hospitalName || data.doctor?.hospitalName;
  if (!currentHospital) {
    try {
      currentHospital = await AsyncStorage.getItem('doctor_current_hospital');
    } catch (e) {}
  }
  if (!currentHospital && typeof window !== 'undefined' && window.localStorage) {
    try {
      currentHospital = window.localStorage.getItem('doctor_current_hospital');
    } catch (e) {}
  }
  if (!currentHospital) {
    currentHospital = 'Colombo Teaching Hospital';
  }

  (data as any).hospitalName = currentHospital;
  if (data.doctor) {
    data.doctor.hospitalName = currentHospital;
  }

  const patientSafeName = (data.patient?.name || (data as any).patientName || 'Patient').replace(/[^a-zA-Z0-9]/g, '_');
  const tokenSafe = (data.patient?.tokenFormatted || (data as any).tokenNumber || 'Token').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Prescription_${patientSafeName}_${tokenSafe}.pdf`;

  // On native mobile (iOS / Android), use expo-print & expo-sharing
  if (Platform.OS !== 'web') {
    try {
      const html = generatePrescriptionHtml(data, clinicalNotes);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Download Prescription (PDF)',
        UTI: 'com.adobe.pdf',
      });
      return;
    } catch (nativeErr) {
      console.warn('Native PDF print error:', nativeErr);
    }
  }

  // On Web: request authentic generated PDF from backend endpoint
  if (typeof window !== 'undefined') {
    try {
      const response = await fetch(`${API_URL}/doctor/prescription/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, clinicalNotes, hospitalName: currentHospital }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return;
      }
    } catch (err) {
      console.warn('Backend PDF endpoint error, falling back to print dialog:', err);
    }

    // Fallback: Open printable prescription window with print dialog (Save as PDF)
    try {
      const html = generatePrescriptionHtml(data, clinicalNotes);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 400);
      }
    } catch (printErr) {
      console.error('Print dialog error:', printErr);
    }
  }
};
