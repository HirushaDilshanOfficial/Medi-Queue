# Walk-In API Smoke Test Documentation

This document describes the end-to-end smoke test sequence for the Reception Walk-In module (`POST /api/reception/walk-in`), patient search, slot lookup, and role authorization.

---

## Prerequisites

1. **Server Running**:
   ```bash
   cd backend
   node server.js
   # Running on http://localhost:5001
   ```

2. **Test Accounts & Records**:
   - **Receptionist User**: `receptionist@mediqueue.lk` (password: `password123`, role: `receptionist`)
   - **Patient User**: `patient.test@mediqueue.lk` (password: `password123`, role: `patient`)
   - **Active Doctor**: `Dr. Palitha Perera` (`_id: 6ac23080644bc01bd3a5c19a`, department: `General OPD`, status: `active`)

---

## Smoke Test Steps & Results

### 1. Login as a Receptionist and Save Token

#### Request:
```bash
curl -i -X POST http://localhost:5001/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"receptionist@mediqueue.lk","password":"password123"}'
```

#### Response:
- **HTTP Status**: `200 OK`
- **Body**:
```json
{
  "_id": "6ac2307f644bc01bd3a5c190",
  "name": "Receptionist User",
  "email": "receptionist@mediqueue.lk",
  "role": "receptionist",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 2. Search an Unknown NIC (`found: false`)

#### Request:
```bash
curl -i -X GET "http://localhost:5001/api/reception/patients/search?q=200012345678" \
  -H "Authorization: Bearer <RECEPTIONIST_TOKEN>"
```

#### Response:
- **HTTP Status**: `200 OK`
- **Body**:
```json
{
  "found": false,
  "patients": []
}
```

---

### 3. GET Slots for a Doctor (Note `earliestAvailable`)

#### Request:
```bash
curl -i -X GET "http://localhost:5001/api/reception/slots?doctorId=6ac23080644bc01bd3a5c19a&date=2026-10-04" \
  -H "Authorization: Bearer <RECEPTIONIST_TOKEN>"
```

#### Response:
- **HTTP Status**: `200 OK`
- **Body**:
```json
{
  "doctor": {
    "name": "Dr. Palitha Perera",
    "room": "Room 101",
    "status": "active"
  },
  "date": "2026-10-04",
  "slots": [
    { "time": "18:45", "status": "past" },
    { "time": "19:00", "status": "available" },
    { "time": "19:15", "status": "available" },
    { "time": "19:30", "status": "available" }
  ],
  "earliestAvailable": "19:00"
}
```
*Note: `earliestAvailable` identified as `19:00`.*

---

### 4. POST Walk-In with that NIC (`201 Created`, token `OPD-001`, `isNewPatient: true`)

#### Request:
```bash
curl -i -X POST http://localhost:5001/api/reception/walk-in \
  -H "Authorization: Bearer <RECEPTIONIST_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "patient": {
      "nic": "200012345678",
      "fullName": "Kasun Perera",
      "phone": "0771234567",
      "age": 26,
      "gender": "male"
    },
    "department": "General OPD",
    "doctorId": "6ac23080644bc01bd3a5c19a",
    "date": "2026-10-04",
    "slotTime": "19:00",
    "priority": "normal"
  }'
```

#### Response:
- **HTTP Status**: `201 Created`
- **Body**:
```json
{
  "isNewPatient": true,
  "patient": {
    "_id": "6ac255121b8ad2e12cc76fd2",
    "fullName": "Kasun Perera",
    "nic": "200012345678",
    "phone": "0771234567",
    "age": 26,
    "gender": "male"
  },
  "appointment": {
    "_id": "6ac255121b8ad2e12cc76fd4",
    "date": "2026-10-04",
    "slotTime": "19:00",
    "status": "checked_in",
    "type": "walk_in",
    "department": "General OPD"
  },
  "token": {
    "tokenLabel": "OPD-001",
    "tokenNumber": 1
  },
  "doctor": {
    "name": "Dr. Palitha Perera",
    "room": "Room 101"
  },
  "estimatedWaitMinutes": 10,
  "patientsAhead": 1
}
```

---

### 5. POST Walk-In for Same Doctor & Same Slot (`409 Conflict`)

#### Request:
```bash
curl -i -X POST http://localhost:5001/api/reception/walk-in \
  -H "Authorization: Bearer <RECEPTIONIST_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "patient": {
      "nic": "991234567V",
      "fullName": "Nimal Silva",
      "phone": "0719876543",
      "age": 27,
      "gender": "male"
    },
    "department": "General OPD",
    "doctorId": "6ac23080644bc01bd3a5c19a",
    "date": "2026-10-04",
    "slotTime": "19:00",
    "priority": "normal"
  }'
```

#### Response:
- **HTTP Status**: `409 Conflict`
- **Body**:
```json
{
  "success": false,
  "message": "Slot was just taken, please choose the next slot",
  "code": 409,
  "requestedSlot": "19:00",
  "nextAvailableSlot": "19:15"
}
```

---

### 6. Search the Same NIC (`found: true`)

#### Request:
```bash
curl -i -X GET "http://localhost:5001/api/reception/patients/search?q=200012345678" \
  -H "Authorization: Bearer <RECEPTIONIST_TOKEN>"
```

#### Response:
- **HTTP Status**: `200 OK`
- **Body**:
```json
{
  "found": true,
  "patients": [
    {
      "_id": "6ac255121b8ad2e12cc76fd2",
      "fullName": "Kasun Perera",
      "nic": "200012345678",
      "nicVerified": false,
      "phone": "0771234567",
      "age": 26,
      "gender": "male"
    }
  ]
}
```

---

### 7. POST Walk-In with Same NIC and New Slot (`201 Created`, token `OPD-002`, `isNewPatient: false`)

#### Request:
```bash
curl -i -X POST http://localhost:5001/api/reception/walk-in \
  -H "Authorization: Bearer <RECEPTIONIST_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "patient": {
      "nic": "200012345678",
      "fullName": "Kasun Perera",
      "phone": "0771234567"
    },
    "department": "General OPD",
    "doctorId": "6ac23080644bc01bd3a5c19a",
    "date": "2026-10-04",
    "slotTime": "19:15",
    "priority": "normal"
  }'
```

#### Response:
- **HTTP Status**: `201 Created`
- **Body**:
```json
{
  "isNewPatient": false,
  "patient": {
    "_id": "6ac255121b8ad2e12cc76fd2",
    "fullName": "Kasun Perera",
    "nic": "200012345678",
    "phone": "0771234567",
    "age": 26,
    "gender": "male"
  },
  "appointment": {
    "_id": "6ac255361b8ad2e12cc76fea",
    "date": "2026-10-04",
    "slotTime": "19:15",
    "status": "checked_in",
    "type": "walk_in",
    "department": "General OPD"
  },
  "token": {
    "tokenLabel": "OPD-002",
    "tokenNumber": 2
  },
  "doctor": {
    "name": "Dr. Palitha Perera",
    "room": "Room 101"
  },
  "estimatedWaitMinutes": 20,
  "patientsAhead": 2
}
```

---

### 8. POST Walk-In with Invalid NIC (`400 Bad Request`)

#### Request:
```bash
curl -i -X POST http://localhost:5001/api/reception/walk-in \
  -H "Authorization: Bearer <RECEPTIONIST_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "patient": {
      "nic": "12345",
      "fullName": "Invalid NIC Patient",
      "phone": "0771234567"
    },
    "department": "General OPD",
    "doctorId": "6ac23080644bc01bd3a5c19a",
    "date": "2026-10-04",
    "slotTime": "19:30",
    "priority": "normal"
  }'
```

#### Response:
- **HTTP Status**: `400 Bad Request`
- **Body**:
```json
{
  "success": false,
  "message": "Invalid NIC format. Use 9 digits + V/X or 12 digits.",
  "code": 400
}
```

---

### 9. POST Walk-In with a Patient-Role Token (`403 Forbidden`)

#### 9a. Obtain Patient Token:
```bash
curl -i -X POST http://localhost:5001/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"patient.test@mediqueue.lk","password":"password123"}'
```

#### 9b. Request with Patient Token:
```bash
curl -i -X POST http://localhost:5001/api/reception/walk-in \
  -H "Authorization: Bearer <PATIENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "patient": {
      "nic": "200012345678",
      "fullName": "Kasun Perera",
      "phone": "0771234567"
    },
    "department": "General OPD",
    "doctorId": "6ac23080644bc01bd3a5c19a",
    "date": "2026-10-04",
    "slotTime": "19:30",
    "priority": "normal"
  }'
```

#### Response:
- **HTTP Status**: `403 Forbidden`
- **Body**:
```json
{
  "success": false,
  "message": "Access denied. Required role(s): receptionist",
  "code": 403
}
```

---

## Bugs Found and Fixed During Smoke Testing

1. **Missing Backend Login Endpoint (`POST /api/users/login`)**:
   - **Bug**: `userController.js` only had `registerUser` and `getUserProfile`. There was no login route to authenticate staff/patients and receive a JWT.
   - **Fix**: Implemented `loginUser` in [userController.js](file:///c:/Users/Dinusha/Desktop/Medi_Queue/Medi-Queue/backend/controllers/userController.js) and wired `POST /api/users/login` in [userRoutes.js](file:///c:/Users/Dinusha/Desktop/Medi_Queue/Medi-Queue/backend/routes/userRoutes.js).

2. **Validation Order in `patientService.js`**:
   - **Bug**: In [patientService.js](file:///c:/Users/Dinusha/Desktop/Medi_Queue/Medi-Queue/backend/services/patientService.js), NIC/phone format validation was performed *after* checking whether a patient exists by phone number. If an invalid NIC (e.g. `"12345"`) was passed together with an existing patient's phone number, the service matched the existing patient and returned `200/201` without validating the bad NIC format.
   - **Fix**: Moved format validation (`isValidNIC` and `isValidSLPhone`) to run *before* database lookups, ensuring any malformed NIC immediately halts execution and returns HTTP `400`.

3. **Case-Insensitive Role Matching in `authMiddleware.js`**:
   - **Bug**: Existing MongoDB user documents stored roles with capitalized values (`"Patient"`, `"Doctor"`), while routes specify lowercase (`'receptionist'`).
   - **Fix**: Added case-insensitive role matching in [authMiddleware.js](file:///c:/Users/Dinusha/Desktop/Medi_Queue/Medi-Queue/backend/middleware/authMiddleware.js) so roles match predictably regardless of casing.
