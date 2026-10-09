const crypto = require('crypto');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generatePassCode() {
  const bytes = crypto.randomBytes(24);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

// Always point at the unauthenticated HTML route mounted by the backend.
// PUBLIC_WEB_URL is retained as a legacy backend-base setting; /pass is not
// an Expo route and must not be generated as the default scan destination.
function passQrValue(entry, req) {
  const configured = process.env.PUBLIC_API_URL || process.env.PUBLIC_WEB_URL;
  const origin = configured || (req?.get?.('host') ? `${req.protocol || 'http'}://${req.get('host')}` : null);
  if (!origin) throw new Error('Set PUBLIC_API_URL to the browser-reachable backend URL for queue QR codes.');
  const base = new URL(origin);
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('PUBLIC_API_URL must use http or https.');
  base.search = '';
  base.hash = '';
  base.pathname = `${base.pathname.replace(/\/+$/, '').replace(/\/api(?:\/v1)?$/, '')}/api/v1/public/queue-pass/${encodeURIComponent(entry.passCode)}`;
  return base.toString();
}

module.exports = { generatePassCode, passQrValue };
