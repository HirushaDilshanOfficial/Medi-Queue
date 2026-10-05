import { PatientPrescriptionDetails } from '../services/prescriptionService';

/**
 * Generate official Medi-Queue Medical Prescription HTML Document
 */
export const generatePrescriptionHtml = (
  data: PatientPrescriptionDetails,
  clinicalNotes?: string
): string => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const rxRows = (data.prescriptions || [])
    .map(
      (med, index) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #334155; text-align: center;">${index + 1}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0;">
          <strong style="color: #0f172a; font-size: 14px;">${med.name}</strong>
          <span style="display: inline-block; background-color: #f1f5f9; color: #475569; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-left: 6px; text-transform: uppercase;">${med.type}</span>
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 13px;">${med.dosage}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #0d6371; font-weight: 600; font-size: 13px;">${med.frequency}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 13px;">${med.duration}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-style: italic;">${med.instructions || 'As directed'}</td>
      </tr>
    `
    )
    .join('');

  const diagnosesHtml = (data.diagnoses || [])
    .map(
      (d) => `
      <span style="display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 14px; font-size: 12px; font-weight: 600; margin-right: 6px; margin-bottom: 6px;">
        ${d.displayName || d.name}
      </span>
    `
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Prescription - ${data.patient?.name || 'Patient'} (${data.patient?.tokenFormatted || ''})</title>
  <style>
    @media print {
      body { margin: 0; padding: 10mm; background: #ffffff !important; }
      .no-print { display: none !important; }
      @page { size: A4; margin: 10mm; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background-color: #f1f5f9;
      margin: 0;
      padding: 24px;
    }
    .prescription-container {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 36px 40px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #064e59;
      padding-bottom: 18px;
      margin-bottom: 20px;
    }
    .brand-name {
      font-size: 24px;
      font-weight: 800;
      color: #064e59;
      letter-spacing: -0.5px;
    }
    .hospital-sub {
      font-size: 13px;
      color: #64748b;
      margin-top: 3px;
      font-weight: 500;
    }
    .rx-badge {
      background: #0d7685;
      color: #ffffff;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 800;
      font-size: 14px;
      letter-spacing: 1px;
      text-align: center;
    }
    .doctor-patient-grid {
      display: flex;
      justify-content: space-between;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 18px 22px;
      margin-bottom: 20px;
      gap: 20px;
    }
    .grid-col {
      flex: 1;
    }
    .col-title {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 4px;
    }
    .person-name {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
    }
    .person-detail {
      font-size: 13px;
      color: #475569;
      margin-top: 3px;
    }
    .token-badge {
      display: inline-block;
      background: #064e59;
      color: #ffffff;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      margin-left: 6px;
    }
    .vitals-bar {
      display: flex;
      gap: 24px;
      background: #e0f2fe;
      border-left: 4px solid #0284c7;
      padding: 10px 16px;
      border-radius: 6px;
      font-size: 13px;
      color: #0369a1;
      margin-bottom: 22px;
    }
    .vitals-bar strong {
      color: #0c4a6e;
    }
    .section-heading {
      font-size: 13px;
      font-weight: 700;
      color: #064e59;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 20px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      margin-bottom: 26px;
    }
    th {
      background: #f1f5f9;
      color: #475569;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 11px 12px;
      text-align: left;
      border-bottom: 2px solid #cbd5e1;
    }
    .notes-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 14px 18px;
      font-size: 13px;
      color: #78350f;
      margin-bottom: 22px;
      line-height: 1.6;
    }
    .footer-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 40px;
      padding-top: 22px;
      border-top: 1px dashed #cbd5e1;
    }
    .sig-line {
      width: 220px;
      border-top: 1px solid #334155;
      text-align: center;
      padding-top: 8px;
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
    }
    .print-actions {
      max-width: 820px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
    .print-btn {
      background: #064e59;
      color: #ffffff;
      border: none;
      padding: 10px 22px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 2px 8px rgba(6, 78, 89, 0.25);
    }
    .print-btn:hover {
      background: #0d6371;
    }
  </style>
</head>
<body>
  <div class="no-print print-actions">
    <button class="print-btn" onclick="window.print()">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
      </svg>
      Print / Save as PDF
    </button>
  </div>

  <div class="prescription-container">
    <div class="header-bar">
      <div>
        <div class="brand-name">MEDI-QUEUE HEALTH CLINICAL PORTAL</div>
        <div class="hospital-sub">Department of Orthopedic Outpatient Care (OPD) • General Hospital</div>
      </div>
      <div class="rx-badge">Rx PRESCRIPTION</div>
    </div>

    <div class="doctor-patient-grid">
      <div class="grid-col">
        <div class="col-title">Consulting Medical Officer</div>
        <div class="person-name">${data.doctor?.name || 'Medical Doctor'}</div>
        <div class="person-detail">${data.doctor?.specialization || 'Medical Specialist'}</div>
        <div class="person-detail">${data.doctor?.department || 'OPD'} • ${data.doctor?.room || 'Room 3B'}</div>
      </div>
      <div class="grid-col" style="border-left: 1px solid #e2e8f0; padding-left: 20px;">
        <div class="col-title">Patient Profile</div>
        <div class="person-name">
          ${data.patient?.name || 'Patient'}
          <span class="token-badge">${data.patient?.tokenFormatted || 'Token #029'}</span>
        </div>
        <div class="person-detail">${data.patient?.gender || 'N/A'}, ${data.patient?.age || 'N/A'} yrs • ${data.patient?.opdId || 'ID #OPD'}</div>
        <div class="person-detail" style="color: #64748b; font-size: 12px; margin-top: 4px;">Date: ${currentDate} • ${currentTime}</div>
      </div>
    </div>

    <div class="vitals-bar">
      <div>Blood Pressure: <strong>${data.patient?.vitals?.bloodPressure || 'N/A'}</strong></div>
      <div>Pulse Rate: <strong>${data.patient?.vitals?.pulseRate || 'N/A'}</strong></div>
      <div>Weight: <strong>${data.patient?.vitals?.weight || 'N/A'}</strong></div>
    </div>

    ${
      data.diagnoses && data.diagnoses.length > 0
        ? `
      <div class="section-heading">Clinical Diagnosis</div>
      <div style="margin-bottom: 12px;">${diagnosesHtml}</div>
    `
        : ''
    }

    ${
      clinicalNotes || data.clinicalNotes
        ? `
      <div class="section-heading">Clinical Observation & Notes</div>
      <div class="notes-box">${clinicalNotes || data.clinicalNotes}</div>
    `
        : ''
    }

    <div class="section-heading" style="gap: 8px;">
      <span style="font-size: 22px; font-family: serif; font-weight: bold; color: #064e59;">℞</span>
      Prescribed Medications (${data.prescriptions?.length || 0})
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 30px; text-align: center;">#</th>
          <th>Medicine Name & Type</th>
          <th>Dosage</th>
          <th>Frequency</th>
          <th>Duration</th>
          <th>Instructions</th>
        </tr>
      </thead>
      <tbody>
        ${rxRows || '<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8;">No medications prescribed.</td></tr>'}
      </tbody>
    </table>

    <div class="footer-section">
      <div>
        <div style="font-size: 11px; color: #64748b; font-weight: 500;">Digitally generated & authenticated via Medi-Queue E-Health Portal.</div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 3px;">Document ID: RX-${Date.now().toString(36).toUpperCase()} • Pharmacy Verification Stamp</div>
      </div>
      <div class="sig-line">
        ${data.doctor?.name || 'Dr. Emilia Emelson'}<br />
        <span style="font-size: 11px; color: #64748b; font-weight: 400;">Consultant Physician / Surgeon</span>
      </div>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Download prescription as printable HTML / PDF document
 */
export const downloadPrescription = (
  data: PatientPrescriptionDetails,
  clinicalNotes?: string
): void => {
  const html = generatePrescriptionHtml(data, clinicalNotes);
  const patientSafeName = (data.patient?.name || 'Patient').replace(/[^a-zA-Z0-9]/g, '_');
  const tokenSafe = (data.patient?.tokenFormatted || 'Token').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Prescription_${patientSafeName}_${tokenSafe}.html`;

  if (typeof window !== 'undefined') {
    // 1. Direct file download as HTML/Printable Document
    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.log('Blob download error:', err);
    }

    // 2. Open printable view with print/save-to-PDF dialog
    try {
      const printWindow = window.open('', '_blank', 'width=900,height=800');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          try {
            printWindow.print();
          } catch (e) {
            console.log('Print dialog error:', e);
          }
        }, 500);
      }
    } catch (e) {
      console.log('Window print error:', e);
    }
  }
};
