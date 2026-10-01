# Patient Module — Implementation Progress

Branch: `heshani-dev`

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
- `OpdAppointment`, `OpdQueueEntry`, `OpdQueueCounter` — see Part 2 below for why the
  shared `Appointment` model cannot be used.
- `OpdMedicalReport` — a report the patient lodged; see Part 4 for why it stores
  metadata only.

Existing `Doctor`, `Patient`, `Schedule`, `Slot`, `Appointment` and `QueueEntry` are
read only by this module. All `Doctor` field assumptions are isolated in
`backend/utils/mapDoctor.js`.

Routes (all require `protect` + role `Patient`):

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/patients/me` | Signed-in patient profile |
| PATCH | `/api/v1/patients/me` | Edit own profile (Part 4) |
| GET | `/api/v1/patients/me/dashboard` | Dashboard aggregate |
| GET | `/api/v1/patients/me/history` | Past visits (Part 4) |
| GET/POST | `/api/v1/patients/me/reports` | Medical reports (Part 4) |
| DELETE | `/api/v1/patients/me/reports/:id` | Remove a report (Part 4) |
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

### Part 2 — doctor directory, booking, token, reschedule/cancel  ✅

#### Why the shared `Appointment` model is not used

`Appointment.patient` is a required `ref: 'Patient'`, and `Patient` is the receptionist-side
record. The shared database has 0 `Patient` rows, because app patients are provisioned
against `User` / `OpdPatientProfile` and most never get a receptionist record. Writing to it
would fail for exactly the patients the app serves. Three additive models were added
instead; no existing model is modified.

- `OpdAppointment` — booking, keyed on `OpdPatientProfile`. Snapshots the doctor name and
  department so a pass survives a later rename. Unique partial index on
  `{ profile, doctor, date, slotTime } where isActive` is the double-booking guard, and
  `isActive` is kept in sync from `status` by pre-hooks.
- `OpdQueueEntry` — one row per appointment. Unique on `passCode` and on
  `{ department, queueDate, tokenNumber }`.
- `OpdQueueCounter` — one row per department per day. Tokens are issued by a single atomic
  `findOneAndUpdate($inc)`, so two simultaneous check-ins cannot collide.

Booking rules:

- Bookable days are derived from `Slot` rows, never from `Schedule`, so a day with no
  generated slots is never offered.
- `Slot.capacity` is honoured (the model defines it, default 1, and no existing code used
  it). Availability compares live booking count against the slot's own capacity.
- Booking horizon is 14 days, inclusive.
- One live booking per patient per doctor per day.
- Rescheduling to the same day keeps the queue token; moving to a new day releases the old
  token and the patient re-checks-in. A token is only released if it is the most recent one
  issued, so a number already shown to a later patient is never handed out twice.
- Cancelling releases a still-waiting token. A token the doctor has already called is kept.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/bookings/summary` | Dashboard counts + next appointment |
| GET | `/api/v1/bookings?scope=upcoming\|past\|all` | My bookings, with live queue state |
| POST | `/api/v1/bookings` | Create a booking |
| PATCH | `/api/v1/bookings/:id/cancel` | Cancel |
| PATCH | `/api/v1/bookings/:id/reschedule` | Move to another date/time |
| GET | `/api/v1/bookings/doctors/:id/days` | Days with free capacity |
| GET | `/api/v1/bookings/doctors/:id/slots?date=` | Times for one day |

Frontend: `src/services/bookingApi.ts`, `src/screens/Patient/Doctors/DoctorDirectoryScreen.tsx`
(directory + a "My bookings" tab), `src/screens/Patient/Doctors/DoctorBookingScreen.tsx`
(also the reschedule flow via a `rescheduleId` param), and the `DoctorCard`, `DayStrip`,
`SlotGrid`, `AppointmentCard`, `ScreenHeader`, `ScreenStates` components.
`/(patient)/doctor/[id]` is registered as a tab screen with `href: null`, so the four-tab
bar is unchanged.

### Part 3 — live queue, stable pass, QR, alerts  ✅

- `GET /api/v1/queue/my-pass` — current pass; returns `pass: null` when there is none, which
  is the normal state rather than an error.
- `GET /api/v1/queue/my-pass/live` — lightweight polling endpoint returning position, ETA
  and who is in the room.
- `POST /api/v1/queue/check-in` — collect a token. Same-day only.
- `DELETE /api/v1/queue/my-pass` — leave the queue and release the token.
- `GET /api/v1/queue/board?department=` and `GET /api/v1/queue/departments` — "now serving".

Position is derived server-side: it counts every active entry ahead of this one, ordered
urgent-before-normal then by token, so calling a patient moves everyone behind them forward.
ETA uses the serving pace captured at check-in and discounts the part-served consultation
already in the room, and is deliberately not recomputed on read so it does not jump around.

The pass QR encodes only the opaque `passCode`, never the token or any patient detail, so a
screenshot cannot be used to guess someone's place in the queue. A pass that cannot be
scanned is still usable: the code is printed under it.

Frontend: `src/services/queueApi.ts`, `src/screens/Patient/Queue/LiveQueueScreen.tsx`,
`QueuePassCard`, `PassQr`, `src/hooks/usePolling.ts` (15s, pauses on blur and in the
background, backs off on failure), `src/hooks/useAsyncResource.ts` (stale-response guard),
`src/utils/opdDates.ts` (Colombo calendar keys, matching the backend).

New deps: `react-native-svg` 15.15.4 and `react-native-qrcode-svg` 6.3.26. `react-native-svg`
is in Expo Go for SDK 57 (`inExpoGo: true`), so no development build is required.

The dashboard now reads the real `activePass` / `nextAppointment` from
`GET /patients/me/dashboard`, which previously returned `null` for both. `QueueCard` gained
a `hasPass` state: with no live pass the design's token number would have been a fabrication,
so the card becomes a check-in prompt instead.

### Part 4 — profile, history, reports, uploads, editing  ✅

#### Why reports store metadata and not the file

There is no doctor-side upload flow in the codebase for reports to reference, so
the two available readings of "uploads" were: doctor-issued reports (which need
a write path owned by another team, leaving the patient app reading from an
always-empty table) or patient-lodged reports. **The patient lodges them** — a
lab result, an outside referral, a discharge summary — and the file itself is
never uploaded here.

Storing the binary was rejected deliberately. Accepting a file would mean a
binary store, an upload size limit, virus scanning and a retention policy, none
of which this module owns or can be operated by the app. So `OpdMedicalReport`
records what the document *is* (`title`, `category`, `reportDate`, `performedOn`,
`notes`, `fileName`) and the document stays in the hospital's records system.
`fileName` is what lets staff match the row to a document they already hold.

This also means Part 4 needs no new dependency and no new infrastructure.

#### The profile edit boundary

`PATCH /patients/me` accepts only: `phone`, `email`, `birthday`, `gender`,
`address`, `district`, `bloodGroup`, `allergies`, `favouriteDepartment`,
`remindersEnabled`, `emergencyContact`. Anything else is a 400.

Four fields are refused even though the patient can see them:

- `user`, `patient` — link columns owned by `loadPatientProfile`.
- `nic` — the key used to attach this profile to a receptionist `Patient` row.
  Allowing it to be edited would let a patient re-point their identity at
  someone else's record.
- `fullName` — belongs to registration, not a self-service form.

`fullName` and `nic` are still returned by `GET /patients/me`; they are just not
editable, and the edit screen says so rather than silently omitting them.

Two normalisations happen server-side so a value cannot be stored two ways:
email is lower-cased, blood group upper-cased (`"o+"` → `"O+"`).

`buildProfilePatch` returns **only the keys the client sent**. A PATCH on a
partially filled profile must not blank out the fields it left out, so "absent"
and "set to null" have to stay distinguishable. That distinction is why
`cleanText` returns `null` for "clear this" and `undefined` for "reject this
input" — conflating the two makes a field impossible to clear, which was a real
bug the tests caught.

#### Report status is not the patient's to set

`status` (`pending` → `reviewed`) is excluded from the accepted body. A patient
must not be able to mark their own report as already seen by a doctor. Deleting
a report is scoped by `profile` in the query, so one patient cannot remove
another's row by guessing an id, and the optional `appointmentId` is checked for
ownership after a shape check — a well-formed id belonging to someone else is
rejected.

| Method | Path | Purpose |
| --- | --- | --- |
| PATCH | `/api/v1/patients/me` | Edit own profile |
| GET | `/api/v1/patients/me/history` | Past visits + summary counts |
| GET | `/api/v1/patients/me/reports` | Reports the patient lodged |
| POST | `/api/v1/patients/me/reports` | Lodge a report |
| DELETE | `/api/v1/patients/me/reports/:id` | Remove a report |

A visit becomes "history" once its date has passed, and history deliberately
includes `cancelled` and `no_show` — a patient looking back wants the record of
what they booked, not a flattering version of it.

The dashboard's `recentActivity`, previously a hardcoded `[]`, is now derived:
appointments and reports merged, sorted by time, windowed to 90 days and capped
at 6, so a patient with years of history is not served hundreds of rows the
dashboard cannot show.

Frontend: `PatientProfileScreen` (replaces the Part 4 placeholder), with
`EditProfileScreen`, `VisitHistoryScreen`, `MedicalReportsScreen` and
`AddReportScreen` behind hidden tab routes, plus `FormField` (`FormField`,
`ChipGroup`, `SwitchRow`) and `ReportRow`. `src/types/patient.ts` gains
`MedicalReport`, `ReportDraft`, `ProfileDraft`, `VisitRecord`, `HistoryPayload`,
`HistorySummary` and `RecentActivityItem`.

`ChipGroup`'s generic excludes `null` even though every field it edits allows
it, because "not set" is represented by a null value rather than by an option.

## Verification

- `npx tsc --noEmit` — clean for all Part 1–3 files. Three pre-existing implicit-`any`
  errors remain in `src/services/authService.ts` (untouched teammate file, fails on
  `heshani-dev` too).
- `npx expo lint` — clean, including the React Compiler `react-hooks` rules.
- `npx expo export --platform web` — 28 static routes build, including `/doctor/[id]`
  and the four Part 4 profile routes.
- `node --test test/opdBookingAndQueue.test.js` — 12 pass / 0 fail. Hermetic: no database
  needed, since Mongoose `validateSync` and index definitions work offline.
- `node --test test/opdProfileAndReports.test.js` — 19 pass / 0 fail, same hermetic
  approach. Covers the edit boundary, the absent-vs-null distinction, enum and length
  validation, the `status` refusal, and agreement between the validators and the schemas.
- `node --test test/receptionistValidation.test.js` — 29 pass / 31 fail, unchanged
  pre-existing baseline (failures are schema-contract mismatches in teammate tests).
- Backend `require` check on all new modules — loads OK; `server.js` boots.

Five real defects were found and fixed while writing the tests, rather than being caught
later:

1. `generatePassCode()` returned 16 characters while the schema requires `minlength: 24`,
   so **every** check-in would have failed validation.
2. Slot availability treated any booking as filling the slot, ignoring `Slot.capacity`.
3. The room was read from `Doctor.room`, but the room for a given clinic session lives on
   `Schedule.room`.
4. `cleanText` used one return value for both "clear this field" and "invalid input", which
   made every optional field impossible to clear once you tried.
5. `emergencyContact: { name: '', phone: '' }` stored a half-empty object instead of
   clearing the contact.

### Still to verify

The end-to-end API run in the table below only covers Part 1. Parts 2–4 have not been run
against a live database, because the shared Atlas database has 0 doctors, so the directory
has nothing to show and a booking cannot be created. `backend/scripts/seedDemoClinic.js`
exists to fix that and is guarded by `DEMO_SEED=1` so it cannot write by accident:

```bash
DEMO_SEED=1 node scripts/seedDemoClinic.js          # upsert 6 demo doctors + 14 days of slots
DEMO_SEED=1 node scripts/seedDemoClinic.js --reset  # remove only those 6 doctors
```

It upserts by doctor name, so running it twice is a no-op, and `--reset` only ever deletes
the six doctors it creates. It has **not** been run against the shared database, because
that is a team database and the write should be agreed first.


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
