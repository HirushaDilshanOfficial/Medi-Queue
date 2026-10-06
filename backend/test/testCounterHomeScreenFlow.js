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

async function run() {
  console.log('1. Login as reception@mediqueue.lk...');
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
  console.log('Login status:', loginRes.status);
  const token = loginRes.body.token;

  console.log('\n2. Fetch Reception Dashboard (GET /api/reception/dashboard)...');
  const dashRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/reception/dashboard',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Dashboard status:', dashRes.status);
  console.log('Dashboard Summary:', {
    date: dashRes.body.date,
    intake: dashRes.body.intake,
    inWaiting: dashRes.body.inWaiting,
    avgWaitMinutes: dashRes.body.avgWaitMinutes,
    attendedDone: dashRes.body.attendedDone,
    doctorsActive: dashRes.body.doctorsActive,
    currentlyServing: dashRes.body.currentlyServing,
    roomsCount: dashRes.body.rooms?.length,
    nextInQueue: dashRes.body.nextInQueue?.map((t) => ({
      tokenLabel: t.tokenLabel,
      priority: t.priority,
      status: t.status,
    })),
  });

  console.log('\n3. Call Next in Queue (POST /api/reception/queue/call-next)...');
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
  console.log('Call Next status:', callRes.status);
  console.log('Called Token:', {
    tokenLabel: callRes.body.tokenLabel,
    patient: callRes.body.patient?.fullName || callRes.body.patient?.name,
    doctor: callRes.body.doctor?.name,
    room: callRes.body.room,
  });

  console.log('\n4. Re-fetch Reception Dashboard...');
  const dashRes2 = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/reception/dashboard',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Updated Currently Serving:', dashRes2.body.currentlyServing);
  console.log('Updated In Waiting:', dashRes2.body.inWaiting);
  console.log('Updated Attended/Done:', dashRes2.body.attendedDone);
}

run().catch(console.error);
