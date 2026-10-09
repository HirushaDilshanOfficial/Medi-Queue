import { Platform, Share } from 'react-native';
import { API_URL } from '../config';
import { getAuthToken } from '../services/http';
import type { VisitRecord } from '../types/patient';
import { longDayLabel } from './opdDates';

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateClientPdfBlob(items: VisitRecord[], patientName: string, locale: string): Blob {
  const dateStr = new Date().toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Colombo',
  });

  const visitsContent = items
    .map((visit) => {
      const statusLabel = visit.status === 'completed' ? 'Completed' : visit.status.replace(/_/g, ' ');
      const statusBg = visit.status === 'completed' ? '#e6f7ed' : visit.status === 'cancelled' ? '#fce8e8' : '#f0f4f8';
      const statusColor = visit.status === 'completed' ? '#0d7d40' : visit.status === 'cancelled' ? '#c5221f' : '#49606e';

      return `
        <div style="border: 1px solid #d0e4ee; border-radius: 12px; padding: 18px 22px; margin-bottom: 20px; background: #ffffff;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #eef5f9; padding-bottom: 12px; margin-bottom: 14px;">
            <div>
              <h3 style="margin: 0; color: #004c5b; font-size: 18px; font-weight: 700;">${escapeHtml(visit.department || 'General OPD')}</h3>
              <div style="margin-top: 4px; color: #3f484b; font-size: 14px;">Attending Doctor: <strong>${escapeHtml(visit.doctorName || 'Doctor')}</strong></div>
            </div>
            <div style="text-align: right;">
              <span style="display: inline-block; padding: 4px 14px; border-radius: 20px; background: ${statusBg}; color: ${statusColor}; font-size: 12px; font-weight: 700;">
                ${escapeHtml(statusLabel)}
              </span>
              ${
                visit.tokenNumber !== null
                  ? `<div style="margin-top: 6px; color: #00696e; font-size: 13px; font-weight: 700;">Queue Token #${visit.tokenNumber}</div>`
                  : ''
              }
            </div>
          </div>
          <div style="margin-bottom: 14px; font-size: 13px; color: #3f484b;">
            <div><strong>Visit Date & Time:</strong> ${escapeHtml(longDayLabel(visit.date, locale))} at ${escapeHtml(visit.slotTime)}${visit.room ? ` • Room ${escapeHtml(visit.room)}` : ''}</div>
          </div>
          <div style="background: #f8fcff; padding: 12px 16px; border-radius: 8px; border-left: 4px solid #00696e;">
            <div style="font-size: 11px; font-weight: 700; color: #6f797c; text-transform: uppercase; margin-bottom: 4px;">Visit Reason / Notes</div>
            <div style="font-size: 13px; color: #0e1e23; line-height: 1.5;">${escapeHtml(visit.reason || 'No specific visit reason recorded.')}</div>
          </div>
        </div>
      `;
    })
    .join('');

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Medi-Queue Visit Summary - ${escapeHtml(patientName)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0e1e23; background: #fff; margin: 0; padding: 24px; }
    .header { border-bottom: 3px solid #004c5b; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; }
    .logo { font-size: 26px; font-weight: 800; color: #004c5b; }
    .patient-bar { background: #e0f0f9; border-radius: 12px; padding: 14px 20px; margin-bottom: 22px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Medi-Queue Hospital</div>
      <div style="font-size: 13px; color: #6f797c;">Official OPD Visit & Medical Encounters Summary</div>
    </div>
    <div style="text-align: right; font-size: 12px; color: #3f484b;">
      <div>Generated: ${dateStr}</div>
      <div>Total Records: ${items.length}</div>
    </div>
  </div>
  <div class="patient-bar">
    <div style="font-size: 11px; font-weight: 700; color: #004c5b; text-transform: uppercase;">Patient Profile</div>
    <div style="font-size: 17px; font-weight: 700; color: #0e1e23; margin-top: 2px;">${escapeHtml(patientName)}</div>
  </div>
  ${visitsContent}
</body>
</html>`;

  return new Blob([htmlContent], { type: 'application/pdf' });
}

export async function exportVisitsAsPdf(
  items: VisitRecord[],
  patientName: string = 'Patient',
  locale: string = 'en-GB'
) {
  if (!items || !items.length) return;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const token = await getAuthToken();
      const visitId = items.length === 1 ? items[0].id : '';
      const query = visitId ? `?visitId=${encodeURIComponent(visitId)}` : '';
      const endpoint = `${API_URL}/patients/me/history/pdf${query}`;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      let blobUrl: string;
      const filename = items.length === 1
        ? `MediQueue_Visit_${(items[0].department || 'OPD').replace(/[^a-zA-Z0-9_-]/g, '_')}_${items[0].date}.pdf`
        : `MediQueue_Visit_Summary.pdf`;

      if (response.ok) {
        const blob = await response.blob();
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        blobUrl = window.URL.createObjectURL(pdfBlob);
      } else {
        const fallbackBlob = generateClientPdfBlob(items, patientName, locale);
        blobUrl = window.URL.createObjectURL(fallbackBlob);
      }

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 3000);
    } catch (error) {
      console.warn('Backend PDF stream failed, creating client PDF Blob:', error);
      const fallbackBlob = generateClientPdfBlob(items, patientName, locale);
      const blobUrl = window.URL.createObjectURL(fallbackBlob);
      const filename = items.length === 1
        ? `MediQueue_Visit_${(items[0].department || 'OPD').replace(/[^a-zA-Z0-9_-]/g, '_')}_${items[0].date}.pdf`
        : `MediQueue_Visit_Summary.pdf`;

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 3000);
    }
  } else {
    const text = [
      `Medi-Queue OPD Visit Summary`,
      `Patient: ${patientName}`,
      ...items.map(
        (visit) =>
          `• ${visit.department} - Dr. ${visit.doctorName}\n  ${visit.date} at ${visit.slotTime}\n  Status: ${visit.status}\n  Reason: ${visit.reason || 'None'}`
      ),
    ].join('\n\n');
    await Share.share({ title: 'OPD Visit Summary', message: text });
  }
}
