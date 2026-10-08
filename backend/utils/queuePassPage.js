function escapeHtml(value) {
  return String(value ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function queuePassPage({ entry, title, message }) {
  const token = entry ? `A-${String(entry.tokenNumber).padStart(3, '0')}` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
    <title>${escapeHtml(title)} · Medi-Queue</title>
    <style>body{font-family:Arial,sans-serif;background:#eef7f7;color:#12343b;padding:24px}
    main{max-width:420px;margin:20px auto;background:white;border-radius:18px;padding:24px;overflow-wrap:anywhere;
    box-shadow:0 4px 18px #12343b22}h1{color:#006b78;margin-top:0}strong{font-size:42px;
    display:block;margin:12px 0;color:#006b78}p{margin:10px 0}button{padding:12px;border:0;border-radius:12px;background:#006b78;color:white}</style>
    </head><body><main><h1>Medi-Queue</h1><h2>${escapeHtml(title)}</h2>
    ${entry ? `<strong>${escapeHtml(token)}</strong><p><b>Department:</b> ${escapeHtml(entry.department)}</p>
      <p><b>Doctor:</b> ${escapeHtml(entry.doctorName)}</p><p><b>Room:</b> ${escapeHtml(entry.room)}</p>
      <p><b>Date:</b> ${escapeHtml(entry.queueDate)}</p><p><b>Status:</b> ${escapeHtml(entry.status)}</p>` : ''}
    <p>${escapeHtml(message)}</p><button type="button" onclick="location.reload()">Refresh pass</button></main></body></html>`;
}

module.exports = { queuePassPage };
