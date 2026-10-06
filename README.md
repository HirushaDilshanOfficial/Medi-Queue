# Medi-Queue — Smart Outpatient Queue Management System

Medi-Queue is an intelligent real-time outpatient queue management system designed for public and private healthcare facilities. It streamlines patient registration, priority triage, doctor consultation queues, and daily shift reconciliation.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, MongoDB (Mongoose), JWT Authentication, bcryptjs
- **Frontend**: React Native, Expo SDK 57, Expo Router / React Navigation, TypeScript
- **State & Storage**: React Context API, `@react-native-async-storage/async-storage`
- **Export & Sharing**: `expo-file-system`, `expo-sharing`

---

## 📋 Prerequisites

- **Node.js**: v18.0 or higher
- **npm**: v9.0 or higher
- **MongoDB**: MongoDB Atlas connection string or local MongoDB instance (v6.0+)
- **Mobile Environment**: [Expo Go app](https://expo.dev/go) (iOS/Android) or Android Studio / Xcode simulator

---

## ⚙️ Environment Configuration

### 1. Backend (`backend/.env`)

Create a `.env` file inside the `backend/` directory:

```env
PORT=5001
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/mediqueue?retryWrites=true&w=majority
JWT_SECRET=super_secret_jwt_key_medi_queue
```

- `PORT`: Port for the Express server (default: `5001`).
- `MONGO_URI`: MongoDB connection string.
- `JWT_SECRET`: Secret key used for signing and verifying JWT tokens.

### 2. Frontend (`frontend/.env`)

Create a `.env` file inside the `frontend/` directory (or update `src/config.ts`):

```env
EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_IP>:5001/api
```

> **Note for Physical Devices**: When testing with Expo Go on a mobile phone, replace `localhost` with your machine's LAN IP address (e.g., `http://192.168.1.100:5001/api`).

---

## 🚀 Setup & Run Instructions

### Step 1: Install & Seed Backend

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Seed initial database (Receptionist, Doctors, Patients, Appointments & Tokens)
npm run seed

# Start backend server
npm start
# Or for auto-reload during development:
npm run dev
```

Backend will run on: `http://localhost:5001` (Health check: `GET http://localhost:5001/api/health`)

---

### Step 2: Install & Run Frontend

```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start the Expo development server
npx expo start
```

Press `w` in terminal for Web, `a` for Android emulator, `i` for iOS simulator, or scan the QR code with **Expo Go**.

---

## 🔑 Seeded Login Credentials

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Receptionist** | `reception@mediqueue.lk` | `Test@1234` | Full access to Receptionist desk, patient registration, live queue & daily reports |
| **Doctor (Orthopedic)** | `doctor.aruna@mediqueue.lk` | `Test@1234` | Doctor Room 3B |
| **Doctor (General OPD)** | `doctor.chathura@mediqueue.lk` | `Test@1234` | Doctor Room 2A |
| **Doctor (Pediatrics)** | `doctor.dilani@mediqueue.lk` | `Test@1234` | Doctor Room 1C |
| **MOH Officer** | `moh@mediqueue.lk` | `Test@1234` | Hospital dashboard and queue analytics |

---

## 🏥 Receptionist Module Walkthrough

1. **Sign In**: Log in using `reception@mediqueue.lk` / `Test@1234`.
2. **Walk-in Booking / Registration**:
   - Go to the **Register** tab.
   - Enter Patient NIC (`handleNicBlur` automatically checks for existing records).
   - If a record exists, a visible **"Existing record found"** banner appears and pre-fills the data to prevent duplicates.
   - Select Department, Priority (Normal, Senior 60+, Urgent/Child), and Doctor to generate a live token (e.g. `OPD-001`).
3. **Serving & Live Queue**:
   - Go to **Live Queue** or **Home** tab.
   - View next-in-line patient, current serving token, and upcoming queue.
   - Helper text confirms: *"Patient display and doctor queue update automatically."*
   - Click **Call Next** to advance the queue, **Move Back (n)** to delay a patient, or **Mark No-Show** if the patient is absent.
4. **End-of-Day Reports & Shift Closing**:
   - Open the **Reports** tab to see real-time statistics (Attended, Throughput %, Doctor Roster).
   - Click **Generate & Export Daily Report** to create a CSV summary and open the device share sheet.
   - Click **Close Counter 01 Shift** to finalize the counter shift.
   - Once closed, intake actions (*New Intake*, *Register*, *Call Next*) are disabled and display a clear *Shift Closed* status.

---

## 🧪 Running Automated Tests

```bash
# Backend unit/endpoint tests
cd backend
node test/shiftEndpoints.test.js
node test/reportEndpoints.test.js

# Frontend TypeScript check
cd frontend
npx tsc --noEmit
```