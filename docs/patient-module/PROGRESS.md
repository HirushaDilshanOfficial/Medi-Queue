# Patient Module — Implementation Progress

Branch: `patient-module` (based on `heshani-dev`)

Scope: the patient-facing Expo app only. Existing MOH, receptionist, doctor-management
and staff-queue code is not modified. Authentication is owned by another team.

## Design source of truth

The five Figma exports in `HighFedilityUI/` are the UI reference. Colours were extracted
directly from the PDF content streams (`scn` operators) rather than guessed, and they
**differ from the provisional palette** in the original written plan:

| Role | Hex |
| --- | --- |
| Page background | `#F3FAFF` |
| Card / surface | `#FFFFFF` |
| Brand deep | `#004C5B` |
| Brand | `#00696E` |
| Brand mid / raised | `#1A6779` / `#176577` |
| Accent (bright cyan) | `#84F4FB` |
| Accent soft | `#B6EBFB` |
| Surface tints | `#E6F6FF`, `#E0F0F9` |
| Borders | `#DAEBF3`, `#CAD0D5` |
| Text primary | `#0E1E23` |
| Text secondary | `#6F797C` |

All of these live in `frontend/src/constants/PatientTheme.ts`. The shared
`Colors.ts` is untouched.

Gradients and shadows are baked into the PDF rasters, so they are re-created in
`PatientTheme` as `gradientQueue` / `gradientHeader` / `gradientCard` plus two
elevation presets. Exact font families could not be recovered (the PDF text uses
subset font encodings), so system fonts with the extracted weight scale are used.

## Login handoff contract (owned by the auth team)

- Persist the JWT in AsyncStorage under the key `mediqueue_token`.
- `setAuthToken(userData.token)` is exported from `frontend/src/services/http.ts`.
- After a successful patient login, route to `/(patient)`.

### Status: implemented by agreement (asked the auth team to add it)

`src/app/(auth)/login.tsx` previously only routed the `MOH` role; a patient login hit
an `else` branch that raised an alert and stayed on the login screen, so `(patient)`
was unreachable through the UI. Two lines were added at the team's request:

- `await setAuthToken(userData.token)` after a successful login.
- `else if (userData.role === 'Patient') router.replace('/(patient)')`.

No other login-screen behaviour was changed.

## Backend contract

New models (no existing model is modified):

- `OpdPatientProfile` — patient-facing profile, one per `User`, optionally linked to
  a receptionist-side `Patient` record by NIC.
- `OpdDoctorProfile` — presentation-only extras keyed by the shared `Doctor` id
  (avatar, qualifications, rating, fee, languages).

Existing `Doctor`, `Patient`, `Schedule`, `Slot`, `Appointment` and `QueueEntry` are
read only by this module. All `Doctor` field assumptions are isolated in
`backend/utils/mapDoctor.js`.

Routes (all require `protect` + role `Patient`):

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/patients/me` | Signed-in patient profile |
| GET | `/api/v1/patients/me/dashboard` | Dashboard aggregate |
| GET | `/api/v1/doctors` | Directory; `department`, `search`, `available`, `sort` |
| GET | `/api/v1/doctors/departments` | Filter chips |
| GET | `/api/v1/doctors/:id` | Single doctor |

`OpdPatientProfile` rows are auto-provisioned on first authenticated request, so no
seed or migration is required for the profile.

## Part status

### Part 1 — theme, http client, patient/doctor API, dashboard, tabs  ✅

- `frontend/src/constants/PatientTheme.ts` — extracted palette, gradients, type scale.
- `frontend/src/services/http.ts` — token-aware client, `HttpError`, timeout handling,
  `setAuthToken` / `getAuthToken` / `clearAuthToken`.
- `frontend/src/services/patientApi.ts`, `frontend/src/services/doctorApi.ts`.
- `frontend/src/types/patient.ts`.
- `frontend/src/components/patient/` — `GradientCard`, `Card`, `Badge`, `StatCard`,
  `QuickAction`.
- `frontend/src/screens/Patient/Dashboard/PatientDashboardScreen.tsx` — greeting header,
  next-appointment pass card, quick actions, stat row, profile summary, pull to refresh.
- `frontend/src/app/(patient)/_layout.tsx` — 4-tab navigator (Home, Doctors, Queue, Profile).
- `frontend/src/app/(patient)/{index,doctors,queue,profile}.tsx` — dashboard route plus
  placeholders for Parts 2–4.
- Shared edits: `backend/server.js` (two additive mounts), `backend/.env.example` (new),
  `frontend/src/config.ts` (port 5001 → 5000, `EXPO_PUBLIC_API_URL` override),
  `frontend/src/app/_layout.tsx` (registers `(patient)`).
- New deps: `@react-native-async-storage/async-storage`, `expo-linear-gradient`,
  `@react-navigation/bottom-tabs`.

Dashboard response shape reserves `nextAppointment`, `upcomingAppointments`,
`completedVisits` and `activePass`; they are `null` until Parts 2–3 add the appointment
and queue models.

### Part 2 — doctor directory, booking, token, reschedule/cancel  ⬜
### Part 3 — live queue, stable pass, QR, alerts  ⬜
### Part 4 — profile, history, reports, uploads, editing  ⬜

## Verification

- `npx tsc --noEmit` — clean for all Part 1 files. Three pre-existing implicit-`any`
  errors remain in `src/services/authService.ts` (untouched teammate file, fails on
  `heshani-dev` too).
- `npx expo lint` — clean.
- Backend `require` check on all new modules — loads OK; `server.js` syntax OK.
- `node --test test/receptionistValidation.test.js` — 29 pass / 31 fail, unchanged
  pre-existing baseline (failures are schema-contract mismatches in teammate tests).

### End-to-end check against the shared Atlas database

Run with `backend/.env` populated from the team's `MONGO_URI` (kept out of git; the
hardcoded fallback in `config/db.js` is a credential leak and should be removed at
some point by whoever owns that file).

| Check | Result |
| --- | --- |
| Mongo connection | Connected to `mediqueue` shard cluster |
| `POST /auth/patient/register` | 201, role `Patient` |
| `POST /auth/login` (patient) | 200, JWT issued |
| `GET /patients/me` | 200, profile returned, `OpdPatientProfile` auto-provisioned |
| `GET /patients/me/dashboard` | 200, stats computed, `nextAppointment` null |
| `GET /doctors` | 200, empty list (no doctors seeded in the shared DB yet) |
| `GET /doctors/departments` | 200, empty list |
| `GET /doctors/not-an-id` | 400 |
| `GET /patients/me` without token | 401 |

Note: the shared database currently has 4 users, 0 doctors and 0 `Patient` rows, so
the doctor directory and the receptionist-side `Patient` link have nothing to show yet.
The temporary test account used for this check was deleted afterwards.
