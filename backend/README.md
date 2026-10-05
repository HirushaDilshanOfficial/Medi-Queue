# Medi-Queue Backend

Backend API for the Medi-Queue hospital outpatient queue management system.

## Setup & Running

```bash
# Install dependencies
npm install

# Seed the database (Receptionist, Doctors, Patients, Appointments & Tokens)
npm run seed

# Start development server
npm run dev
```

Default Base URL: `http://localhost:5001` (or `http://localhost:5000`)

---

## Receptionist API

All `/api/reception` endpoints require an `Authorization: Bearer $TOKEN` header with a user having the `receptionist` role.

### Placeholders
- `$BASE_URL`: e.g. `http://localhost:5001`
- `$TOKEN`: Receptionist JWT token

---

### Authentication (Get Token)

**Seeded Credentials:**
- Email: `reception@mediqueue.lk`
- Password: `Test@1234`

```bash
# Login and acquire receptionist token
curl -s -X POST "$BASE_URL/api/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"reception@mediqueue.lk","password":"Test@1234"}'

# Or export token directly to an environment variable:
TOKEN=$(curl -s -X POST "$BASE_URL/api/users/login" -H "Content-Type: application/json" -d '{"email":"reception@mediqueue.lk","password":"Test@1234"}' | jq -r .token)
```

---

### Dashboard

```bash
# Get live reception dashboard (intake, waiting, serving, rooms, next 3 tokens)
curl -s -X GET "$BASE_URL/api/reception/dashboard" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Search

```bash
# Search patients by NIC or phone number (min 3 characters)
curl -s -X GET "$BASE_URL/api/reception/patients/search?q=199418201234" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Slots

```bash
# Get 15-minute time slots and availability for a doctor on a specific date
curl -s -X GET "$BASE_URL/api/reception/slots?doctorId=$DOCTOR_ID&date=2026-10-06" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Walk-In Registration & Booking

```bash
# Book walk-in appointment and atomically generate next OPD token
curl -s -X POST "$BASE_URL/api/reception/walk-in" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"existingPatientId":"$PATIENT_ID","doctorId":"$DOCTOR_ID","department":"General OPD","date":"2026-10-06","priority":"normal"}'
```

---

### Queue Management

```bash
# View live ordered queue with totals and wait times
curl -s -X GET "$BASE_URL/api/reception/queue" \
  -H "Authorization: Bearer $TOKEN"

# Call next waiting patient in queue
curl -s -X POST "$BASE_URL/api/reception/queue/call-next" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'

# Move waiting token back 3 positions
curl -s -X POST "$BASE_URL/api/reception/queue/$TOKEN_ID/move-back" \
  -H "Authorization: Bearer $TOKEN"

# Mark token & appointment as no-show
curl -s -X POST "$BASE_URL/api/reception/queue/$TOKEN_ID/no-show" \
  -H "Authorization: Bearer $TOKEN"

# Recall previously called token
curl -s -X POST "$BASE_URL/api/reception/queue/$TOKEN_ID/recall" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Patients

```bash
# List patients filtered by visited_today, recent (last 30 days), or all
curl -s -X GET "$BASE_URL/api/reception/patients?filter=visited_today" \
  -H "Authorization: Bearer $TOKEN"

# Get patient profile and appointment visit history
curl -s -X GET "$BASE_URL/api/reception/patients/$PATIENT_ID" \
  -H "Authorization: Bearer $TOKEN"

# Update patient contact, address, or medical details
curl -s -X PATCH "$BASE_URL/api/reception/patients/$PATIENT_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"phone":"0771234567","district":"Colombo","bloodGroup":"O+"}'

# Verify patient's National Identity Card (NIC)
curl -s -X POST "$BASE_URL/api/reception/patients/$PATIENT_ID/verify-nic" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Doctors

```bash
# List doctors with department, room, capacity, and today's active patients
curl -s -X GET "$BASE_URL/api/reception/doctors?department=General+OPD" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Shift

```bash
# Get current shift summary, throughput %, and doctor consultation counts
curl -s -X GET "$BASE_URL/api/reception/shift/summary" \
  -H "Authorization: Bearer $TOKEN"

# Close the receptionist's daily shift and record final summary snapshot
curl -s -X POST "$BASE_URL/api/reception/shift/close" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Reports

```bash
# Export today's appointments and queue tokens as a CSV file
curl -s -X GET "$BASE_URL/api/reception/reports/daily?format=csv" \
  -H "Authorization: Bearer $TOKEN" -o daily-report.csv
```
