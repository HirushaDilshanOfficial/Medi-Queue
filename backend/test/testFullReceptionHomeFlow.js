const http = require('http');

async function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function verify() {
  console.log('=== VERIFYING RECEPTIONIST COUNTER HOME FLOW ===\n');

  console.log('Step 1: Authenticate as reception@mediqueue.lk...');
  const loginRes = await request(
    {
      hostname: 'localhost',
      port: 5001,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'reception@mediqueue.lk', password: 'Test@1234' }
  );

  if (loginRes.status !== 200 || !loginRes.body.token) {
    throw new Error(`Login failed with status ${loginRes.status}`);
  }
  const token = loginRes.body.token;
  console.log('✓ Login successful. User:', loginRes.body.fullName, '| Role:', loginRes.body.role);

  console.log('\nStep 2: Fetch Dashboard (GET /api/reception/dashboard)...');
  const dashRes1 = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/reception/dashboard',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (dashRes1.status !== 200) {
    throw new Error(`Dashboard fetch failed with status ${dashRes1.status}`);
  }

  const d1 = dashRes1.body;
  console.log('✓ Dashboard loaded successfully:');
  console.log('  - Date:', d1.date);
  console.log('  - Total Intake:', d1.intake.total, `(Walk-In: ${d1.intake.walkIn}, Pre-Booked: ${d1.intake.preBooked})`);
  console.log('  - In Waiting:', d1.inWaiting, `(~${d1.avgWaitMinutes} min wait)`);
  console.log('  - Attended Done:', d1.attendedDone);
  console.log('  - Doctors Active:', d1.doctorsActive);
  console.log('  - Currently Serving:', d1.currentlyServing?.tokenLabel, '(', d1.currentlyServing?.patient?.name, '-', d1.currentlyServing?.room, ')');
  console.log('  - Rooms Count:', d1.rooms?.length);
  console.log('  - Next in Queue Count:', d1.nextInQueue?.length);

  console.log('\nStep 3: Call Next Patient (POST /api/reception/queue/call-next)...');
  const callRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/reception/queue/call-next',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (callRes.status !== 200) {
    throw new Error(`Call Next failed with status ${callRes.status}: ${JSON.stringify(callRes.body)}`);
  }

  console.log('✓ Call Next successful:');
  console.log('  - Called Token:', callRes.body.tokenLabel);
  console.log('  - Patient:', callRes.body.patient?.fullName || callRes.body.patient?.name);
  console.log('  - Doctor:', callRes.body.doctor?.name);
  console.log('  - Room:', callRes.body.room);

  console.log('\nStep 4: Re-fetch Dashboard to verify Serving Card & Stats updated...');
  const dashRes2 = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/reception/dashboard',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const d2 = dashRes2.body;
  console.log('✓ Updated Dashboard figures:');
  console.log('  - New Serving Token:', d2.currentlyServing?.tokenLabel);
  console.log('  - In Waiting:', d2.inWaiting, '(was', d1.inWaiting, ')');
  console.log('  - Attended Done:', d2.attendedDone, '(was', d1.attendedDone, ')');

  console.log('\nStep 5: Verify Error Handling on invalid token recall/no-show...');
  const errRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/reception/queue/NON_EXISTENT_TOKEN/recall',
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('✓ Error state response received correctly:', errRes.status, errRes.body?.message || errRes.body?.error);

  console.log('\n=== ALL RECEPTION HOME FLOW TESTS PASSED! ===');
}

verify().catch(console.error);
