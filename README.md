# Medi-Queue — Smart Outpatient Queue Management System

![Medi-Queue Banner](https://img.shields.io/badge/Medi--Queue-Healthcare%20Innovation-0a6e7e?style=for-the-badge)
![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)

Medi-Queue is an intelligent, real-time outpatient queue management system designed for public and private healthcare facilities. It streamlines patient registration, priority triage, doctor consultation queues, and daily shift reconciliation to ensure optimal patient experience and seamless hospital operations.

---

## 🌟 Key Features

### 🏥 Multi-Role Dashboards
- **MOH / Administrator**: Real-time hospital analytics, staff roster views, wait-time tracking, and dynamic hospital policy configurations.
- **Doctor**: Integrated Digital EHR, real-time consultation queue, and historical patient medical records.
- **Receptionist**: Lightning-fast patient onboarding, walk-in vs. pre-booked appointment reconciliation, and shift-closing report generation.
- **Patient (Mobile)**: Real-time queue position tracking, live estimated wait times (EWT), and booking management.

### ⚡ Smart Triage & Queueing
- **Dynamic Priority Engine**: Automatically flags and prioritizes *Urgent*, *Emergency*, and *Senior Citizens* based on configurable hospital policies.
- **Real-Time Synchronization**: Live WebSocket/Polling updates ensure the patient display and doctor queue are always in perfect sync.
- **Shift Management**: Strict controls for opening/closing reception counters with automated daily CSV report generation.

### 🎨 Modern Aesthetics & Localization
- **Premium UI/UX**: Built with modern, clean aesthetics utilizing the industry-standard `Inter` font.
- **Trilingual Support**: Fully localized in English, Sinhala, and Tamil with seamless runtime switching.

---

## 🛠️ Technology Stack & Architecture

### Frontend (Mobile App)
- **Framework**: React Native with Expo SDK 57 & Expo Router (File-based routing)
- **Language**: TypeScript
- **State Management**: React Context API
- **Storage**: `@react-native-async-storage/async-storage`
- **Typography & UI**: `@expo-google-fonts/inter`, Vector Icons

### Backend (REST API)
- **Runtime Environment**: Node.js & Express.js
- **Database**: MongoDB (Object modeling via Mongoose)
- **Authentication**: JWT (JSON Web Tokens) & bcryptjs for secure password hashing
- **Architecture**: MVC (Model-View-Controller) pattern with decoupled routes, controllers, and models.

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
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

### 2. Frontend (`frontend/.env`)
Create a `.env` file inside the `frontend/` directory (or update `src/config.ts`):

```env
EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_IP>:5001/api
```

> **⚠️ Note for Physical Devices**: When testing with Expo Go on a mobile phone, ensure you replace `localhost` with your computer's LAN IP address (e.g., `http://192.168.1.100:5001/api`) so the phone can reach the local server.

---

## 🚀 Setup & Run Instructions

### Step 1: Start the Backend

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Seed the initial database (Receptionist, Doctors, Patients, Appointments & Tokens)
npm run seed

# Start backend server for development (auto-reloads)
npm run dev
```
*Backend will run on: `http://localhost:5001` (Health check: `GET http://localhost:5001/api/health`)*

### Step 2: Start the Frontend

```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start the Expo development server
npx expo start -c
```
*Press `w` in terminal for Web, `a` for Android emulator, `i` for iOS simulator, or scan the QR code with **Expo Go**.*

---

## 🔑 Seeded Login Credentials

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Receptionist** | `dinusha@gmail.lk` | `Admin@123` | Patient registration, live queue & daily reports |
| **Doctor (Orthopedic)** | `doctor.aruna@mediqueue.lk` | `Test@1234` | Doctor Room 3B |
| **Doctor (General OPD)** | `doctor.chathura@mediqueue.lk` | `Test@1234` | Doctor Room 2A |
| **Doctor (Pediatrics)** | `doctor.dilani@mediqueue.lk` | `Test@1234` | Doctor Room 1C |
| **MOH Officer** | `moh@mediqueue.lk` | `Test@1234` | Hospital dashboard and queue analytics |

---

## 🏥 Module Walkthroughs

### 1. Receptionist Workflow
- **Registration**: Enter Patient NIC to auto-fetch existing records. Select Department, Priority, and Doctor to generate a live token.
- **Triage Intervention**: Use the "Make Urgent" action (validated against Hospital Policy) to bypass normal queues for critical patients.
- **Queue Control**: Use `Call Next`, `Move Back`, or `Mark No-Show` to manage the physical crowd.
- **Shift Closing**: Generate end-of-day CSV reports and "Close Counter" to lock the system and prevent overnight queue bleed.

### 2. MOH / Admin Workflow
- **Real-Time Dashboard**: View live statistics on "Patients Today", "Consultation Progress", and Average Wait Times.
- **Staff On Duty**: Click to expand a modal showing all actively assigned doctors and nurses along with their current patient load.
- **Historical Analytics**: View comprehensive Weekly, Monthly, and 6-Month Patient Volume trend charts automatically aggregated from actual appointment data.

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
