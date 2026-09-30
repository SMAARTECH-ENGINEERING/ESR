# ESR Tank Management System

A production-ready real-time IoT monitoring backend for managing multiple ESR (Elevated Storage Reservoir) tanks. Each tank has one dedicated IoT device that streams live flow rate and totalizer readings every minute. The system processes, stores, and broadcasts this data in real time while maintaining optimized historical records for reporting.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Design](#database-design)
- [Authentication & Authorization](#authentication--authorization)
- [API Reference](#api-reference)
- [Real-time System (Socket.IO)](#real-time-system-socketio)
- [IoT Data Pipeline](#iot-data-pipeline)
- [Online / Offline Detection](#online--offline-detection)
- [Reporting Engine](#reporting-engine)
- [Data Retention Strategy](#data-retention-strategy)
- [Cron Jobs](#cron-jobs)
- [Security Implementation](#security-implementation)
- [Performance Optimizations](#performance-optimizations)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Docker Deployment](#docker-deployment)
- [PM2 Production Deployment](#pm2-production-deployment)
- [Postman Testing](#postman-testing)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        IoT Devices                              │
│              (POST /api/iot/data every 1 minute)                │
└────────────────────────────┬────────────────────────────────────┘
                             │ X-Device-Secret header
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Express.js API Server                        │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │   Auth   │  │  Tanks   │  │    IoT    │  │   Reports    │  │
│  │  Module  │  │  Module  │  │  Module   │  │   Module     │  │
│  └──────────┘  └──────────┘  └─────┬─────┘  └──────────────┘  │
│                                    │                            │
│                          ┌─────────▼──────────┐                │
│                          │   Socket.IO Emit   │                │
│                          │  tank:<id> room    │                │
│                          │  dashboard room    │                │
│                          └─────────┬──────────┘                │
└────────────────────────────────────┼────────────────────────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            ▼                        ▼                        ▼
    ┌──────────────┐      ┌──────────────────┐      ┌─────────────────┐
    │  MongoDB     │      │  Dashboard       │      │  Report         │
    │  Atlas       │      │  Clients         │      │  Clients        │
    │              │      │  (WebSocket)     │      │  (WebSocket)    │
    │  live_data   │      └──────────────────┘      └─────────────────┘
    │  report_data │
    │  tanks       │
    │  users       │
    └──────────────┘
```

### Request Flow

```
HTTP Request
     │
     ├─► Helmet (security headers)
     ├─► CORS
     ├─► Rate Limiter
     ├─► Body Parser
     ├─► Morgan (HTTP logging)
     ├─► Route Match
     │       ├─► Auth Middleware (JWT verify)
     │       ├─► Role Middleware (RBAC)
     │       ├─► Joi Validation
     │       └─► Controller → Service → MongoDB
     │
     └─► Error Handler (centralized)
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js 18+ | JavaScript runtime |
| Framework | Express.js 4.x | HTTP server & routing |
| Database | MongoDB Atlas | Primary data store |
| ODM | Mongoose 8.x | Schema modeling, indexing |
| Real-time | Socket.IO 4.x | Bidirectional WebSocket communication |
| Auth | JWT (jsonwebtoken) | Stateless authentication |
| Password | bcryptjs (cost 12) | Secure password hashing |
| Validation | Joi 17.x | Request payload validation |
| Scheduling | node-cron | Recurring background jobs |
| Logging | Winston + DailyRotateFile | Structured, rotating file logs |
| Security | Helmet, express-rate-limit | HTTP hardening, DDoS mitigation |
| Process Mgr | PM2 | Cluster mode, auto-restart |
| Container | Docker + Compose | Portable deployment |

---

## Project Structure

```
ESR-NEW/
│
├── server.js                        # Entry point — HTTP server, Socket.IO init, cron start
├── ecosystem.config.js              # PM2 cluster configuration
├── Dockerfile                       # Multi-stage Docker image
├── docker-compose.yml               # Service orchestration
├── package.json
├── .env.example                     # Environment variable template
│
├── postman/
│   ├── ESR_Tank_Management.postman_collection.json
│   └── ESR_Tank_Management.postman_environment.json
│
├── logs/                            # Auto-created rotating log files
│
└── src/
    │
    ├── app.js                       # Express app — middleware stack, route mounting
    │
    ├── config/
    │   ├── database.js              # Mongoose connection with reconnect logic
    │   ├── logger.js                # Winston logger with daily file rotation
    │   └── socket.js                # Socket.IO server init + event emitters
    │
    ├── modules/                     # Feature modules (controller + service + model + route + validation)
    │   ├── auth/
    │   │   ├── auth.model.js        # User schema (name, email, password, role)
    │   │   ├── auth.validation.js   # Joi schemas for register / login
    │   │   ├── auth.service.js      # Business logic — register, login, profile
    │   │   ├── auth.controller.js   # Request/response handlers
    │   │   └── auth.route.js        # POST /register, POST /login, GET /profile
    │   │
    │   ├── tanks/
    │   │   ├── tank.model.js        # Tank schema (tankName, deviceId, location, status, lastSeen)
    │   │   ├── tank.validation.js   # Joi schemas for create / update
    │   │   ├── tank.service.js      # CRUD, conflict checks, status updates
    │   │   ├── tank.controller.js   # Request/response handlers
    │   │   └── tank.route.js        # GET/POST/PUT/DELETE /api/tanks
    │   │
    │   ├── iot/
    │   │   ├── iot.model.js         # LiveData schema (TTL managed by config/retention.js)
    │   │   ├── iot.validation.js    # Joi schema for device payload
    │   │   ├── iot.service.js       # Data ingestion, Socket.IO emit, tank status update
    │   │   ├── iot.controller.js    # Request/response handlers
    │   │   └── iot.route.js         # POST /data, GET /latest/:id, GET /history/:id
    │   │
    │   ├── dashboard/
    │   │   ├── dashboard.service.js # Aggregates tank list + latest readings in parallel
    │   │   ├── dashboard.controller.js
    │   │   └── dashboard.route.js   # GET /api/dashboard, GET /api/dashboard/:tankId
    │   │
    │   └── reports/
    │       ├── report.model.js      # ReportData schema (TTL managed by config/retention.js)
    │       ├── report.validation.js # Joi schemas for date/month query params
    │       ├── report.service.js    # Aggregation pipelines — daily / weekly / monthly
    │       ├── report.controller.js
    │       └── report.route.js      # GET /daily/:id, /weekly/:id, /monthly/:id
    │
    ├── middleware/
    │   ├── auth.middleware.js       # JWT Bearer token extraction and verification
    │   ├── role.middleware.js       # Role-based access control (RBAC)
    │   ├── error.middleware.js      # Centralized error handler + AppError class
    │   ├── rateLimiter.middleware.js # Global / auth / IoT rate limiters
    │   └── iot.middleware.js        # X-Device-Secret header verification
    │
    ├── config/retention.js          # DATA_RETENTION_DAYS (default 120) → TTL indexes + purge
    │
    ├── integrations/iwcrcm/         # IWCRCM government reporting (see ../IWCRCM_INTEGRATION.md)
    │
    ├── jobs/
    │   ├── cleanup.job.js           # 3 cron jobs (status check, snapshot, cleanup)
    │   └── iwcrcm.job.js            # IWCRCM transmission scheduler (only when IWCRCM_ENABLED=true)
    │
    ├── sockets/
    │   └── socket.handler.js        # High-level broadcast helpers
    │
    ├── utils/
    │   ├── apiResponse.util.js      # Standardized response: sendSuccess / sendError / sendPaginated
    │   ├── jwt.util.js              # generateToken / verifyToken
    │   └── bcrypt.util.js           # hashPassword / comparePassword
    │
    └── validations/
        └── common.validation.js     # Shared Joi schemas — objectId, pagination
```

---

## Database Design

### Collections Overview

```
MongoDB Atlas
├── users          — system user accounts
├── tanks          — registered ESR tanks
├── live_data      — 1-minute IoT readings (TTL: DATA_RETENTION_DAYS, default 120 days)
├── report_data    — 30-minute snapshots (TTL: DATA_RETENTION_DAYS, default 120 days)
├── iwcrcm_transmissions — IWCRCM outbox (TTL: DATA_RETENTION_DAYS)
└── iwcrcm_credentials   — encrypted IWCRCM auth keys (no TTL)
```

---

### users

```js
{
  _id:       ObjectId,
  name:      String,          // 2–50 chars
  email:     String,          // unique, lowercase
  password:  String,          // bcrypt hashed, select: false
  role:      String,          // "admin" | "control_room"
  createdAt: Date,
  updatedAt: Date
}

Indexes:
  { email: 1 }  unique  — fast login lookup
```

---

### tanks

```js
{
  _id:       ObjectId,
  tankName:  String,          // unique, 2–100 chars
  deviceId:  String,          // unique, uppercase
  location:  String,          // max 200 chars
  status:    String,          // "online" | "offline" | "inactive"
  lastSeen:  Date,            // updated on every IoT reading
  iwcrcm: {                   // optional IWCRCM mapping
    enabled:   Boolean,
    deviceId:  String,        // department-issued, 1–11 chars [A-Z0-9]
    longitude: Number,
    latitude:  Number
  },
  createdAt: Date,
  updatedAt: Date
}

Indexes:
  { deviceId: 1 }  unique       — O(1) IoT device lookup
  { status: 1 }                 — filter by online/offline
  { lastSeen: -1 }              — offline detection query
  { 'iwcrcm.deviceId': 1 } unique (partial) — one tank per IWCRCM device
  { 'iwcrcm.enabled': 1 }       — IWCRCM scheduler lookup
```

---

### live_data

```js
{
  _id:       ObjectId,
  tankId:    ObjectId → tanks,
  deviceId:  String,          // uppercase
  flowRate:  Number,          // ≥ 0
  totalizer: Number,          // ≥ 0 (resets at midnight)
  timestamp: Date             // device-reported time
}

Indexes:
  { tankId: 1, timestamp: -1 }   — latest reading per tank (dashboard)
  { deviceId: 1, timestamp: -1 } — device-specific history
  { timestamp: 1 }  TTL: 10368000s — auto-deletes after 120 days (DATA_RETENTION_DAYS)
```

> **Note:** No `createdAt`/`updatedAt` timestamps on live_data to minimize document size. The TTL index on `timestamp` handles automatic cleanup.

---

### report_data

```js
{
  _id:          ObjectId,
  tankId:       ObjectId → tanks,
  deviceId:     String,
  flowRate:     Number,
  totalizer:    Number,
  intervalTime: Date,         // 30-minute bucket timestamp
  createdAt:    Date          // used for TTL + retention queries
}

Indexes:
  { tankId: 1, createdAt: -1 }     — date-range report queries
  { tankId: 1, intervalTime: -1 }  — interval-based aggregation
  { createdAt: 1 }  TTL: 10368000s — auto-deletes after 120 days (DATA_RETENTION_DAYS)
```

---

## Authentication & Authorization

### JWT Flow

```
Client                          Server
  │                               │
  ├─── POST /api/auth/login ──────►│
  │    { email, password }         │  1. Find user by email
  │                                │  2. bcrypt.compare(password, hash)
  │◄── { token, user } ───────────┤  3. jwt.sign({ id, role }, secret)
  │                                │
  ├─── GET /api/tanks ────────────►│
  │    Authorization: Bearer <jwt> │  4. jwt.verify(token, secret)
  │                                │  5. User.findById(decoded.id)
  │◄── { tanks } ─────────────────┤  6. Attach req.user, proceed
```

### Role-Based Access Control

```
Role: admin
  ├── GET    /api/tanks           ✓
  ├── POST   /api/tanks           ✓  (admin only)
  ├── PUT    /api/tanks/:id       ✓  (admin only)
  ├── DELETE /api/tanks/:id       ✓  (admin only)
  ├── GET    /api/dashboard       ✓
  ├── GET    /api/reports/*       ✓
  └── GET    /api/iot/*           ✓

Role: control_room
  ├── GET    /api/tanks           ✓
  ├── POST   /api/tanks           ✗  403 Forbidden
  ├── PUT    /api/tanks/:id       ✗  403 Forbidden
  ├── DELETE /api/tanks/:id       ✗  403 Forbidden
  ├── GET    /api/dashboard       ✓
  ├── GET    /api/reports/*       ✓
  └── GET    /api/iot/*           ✓

IoT Devices (no JWT):
  └── POST   /api/iot/data        ✓  X-Device-Secret header only
```

### Password Security

- Algorithm: `bcrypt` with salt rounds = **12** (adaptive cost factor)
- The `password` field has `select: false` in Mongoose — never returned in queries unless explicitly selected
- Login uses a constant-time comparison via `bcrypt.compare` to prevent timing attacks
- Same error message returned for "user not found" and "wrong password" to prevent user enumeration

---

## API Reference

### Standard Response Format

Every API response follows this structure:

```json
// Success
{
  "status": "success",
  "message": "Descriptive message",
  "data": { ... },
  "timestamp": "2026-05-22T10:00:00.000Z"
}

// Paginated
{
  "status": "success",
  "message": "...",
  "data": [ ... ],
  "pagination": {
    "total": 10,
    "page": 1,
    "limit": 10,
    "pages": 1
  },
  "timestamp": "..."
}

// Error
{
  "status": "error",
  "message": "What went wrong",
  "errors": ["field-level errors (validation)"],
  "timestamp": "..."
}
```

---

### Authentication

| Method | Endpoint | Auth | Body |
|---|---|---|---|
| POST | `/api/auth/register` | None | `{ name, email, password, role }` |
| POST | `/api/auth/login` | None | `{ email, password }` |
| GET  | `/api/auth/profile` | JWT | — |

---

### Tank Management

| Method | Endpoint | Auth | Role | Notes |
|---|---|---|---|---|
| GET    | `/api/tanks` | JWT | any | `?page=1&limit=10&status=online` |
| GET    | `/api/tanks/:id` | JWT | any | — |
| POST   | `/api/tanks` | JWT | admin | Creates tank |
| PUT    | `/api/tanks/:id` | JWT | admin | Partial update |
| DELETE | `/api/tanks/:id` | JWT | admin | Hard delete |

---

### IoT Data Ingestion

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| POST | `/api/iot/data` | `X-Device-Secret` header | Device sends every 1 min |
| GET  | `/api/iot/latest/:tankId` | JWT | Most recent reading |
| GET  | `/api/iot/history/:tankId` | JWT | `?hours=1&limit=60` |

**IoT Payload:**

```json
{
  "deviceId":  "DEV001",
  "flowRate":  120,
  "totalizer": 4500,
  "timestamp": "2026-05-22T10:00:00.000Z"
}
```

---

### Dashboard

| Method | Endpoint | Auth | Returns |
|---|---|---|---|
| GET | `/api/dashboard` | JWT | All tanks + status summary + latest readings |
| GET | `/api/dashboard/:tankId` | JWT | Single tank + last 60 min of history |

---

### Reports

| Method | Endpoint | Auth | Query Params |
|---|---|---|---|
| GET | `/api/reports/daily/:tankId`   | JWT | `?date=2026-05-22` |
| GET | `/api/reports/weekly/:tankId`  | JWT | `?startDate=2026-05-19` |
| GET | `/api/reports/monthly/:tankId` | JWT | `?year=2026&month=5` |

---

### Health Check

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/health` | None | Used by Docker + load balancers |

---

## Real-time System (Socket.IO)

### Client Connection

```js
// Frontend connects
const socket = io('http://localhost:5000');

// Subscribe to a specific tank's feed
socket.emit('subscribe:tank', tankId);

// Subscribe to dashboard (all tanks)
socket.emit('subscribe:dashboard');
```

### Server Rooms

```
Socket.IO Rooms
├── tank:<tankId>     — per-tank subscribers (single tank view)
└── dashboard         — all-tanks subscribers (overview page)
```

### Events Emitted by Server

```js
// Live IoT data received from a device
socket.on('tank:data', (payload) => {
  // {
  //   tankId, tankName, deviceId, location,
  //   flowRate, totalizer, status,
  //   lastSeen, timestamp
  // }
});

// Tank status changed (online ↔ offline)
socket.on('tank:status', (payload) => {
  // { tankId, tankName, status, timestamp }
});

// System-wide alert
socket.on('system:alert', (payload) => {
  // { message, type: 'info'|'warn'|'error', timestamp }
});
```

### Emit Flow on IoT Data Arrival

```
IoT Device POST /api/iot/data
         │
         ▼
  iot.service.processIoTData()
         │
         ├── LiveData.create()           → MongoDB
         ├── Tank.findByIdAndUpdate()    → status: 'online', lastSeen: now
         │
         └── emitTankUpdate(tankId, payload)
                  │
                  ├── io.to('tank:<id>').emit('tank:data', payload)
                  └── io.to('dashboard').emit('tank:data', payload)
```

---

## IoT Data Pipeline

```
Every 1 minute per device:

IoT Device
    │
    │  POST /api/iot/data
    │  Headers: X-Device-Secret: <secret>
    │  Body: { deviceId, flowRate, totalizer, timestamp }
    │
    ▼
[iot.middleware] verifyDeviceSecret
    │  Checks req.headers['x-device-secret'] === process.env.IOT_DEVICE_SECRET
    ▼
[iot.validation] Joi schema check
    │  flowRate ≥ 0, totalizer ≥ 0, deviceId required
    ▼
[iot.service] processIoTData()
    │
    ├── 1. Tank.findOne({ deviceId })         → identify the tank
    ├── 2. LiveData.create({ ... })           → store in live_data (TTL 120 days)
    ├── 3. Tank.findByIdAndUpdate(status, lastSeen)
    ├── 4. emitTankUpdate(tankId, payload)    → Socket.IO broadcast
    └── 5. Return { tank }                   → 200 OK to device
```

---

## Online / Offline Detection

The system uses a **pull-based** offline detection model instead of relying on device disconnection events (which are unreliable for UDP/HTTP IoT devices).

```
Cron: every 1 minute
    │
    ▼
Tank.find({ status: 'online', lastSeen: { $lt: 5 minutes ago } })
    │
    └── For each stale tank:
         ├── Tank.findByIdAndUpdate({ status: 'offline' })
         └── emitTankStatusChange(tankId, 'offline', tankName)
              ├── io.to('tank:<id>').emit('tank:status', ...)
              └── io.to('dashboard').emit('tank:status', ...)
```

**Status Transitions:**

```
[inactive] ──── first IoT data received ────► [online]
  [online] ──── no data for > 5 min    ────► [offline]
 [offline] ──── IoT data received again ───► [online]
```

---

## Reporting Engine

### Totalizer Reset Behavior

The totalizer resets to `0` at the start of each day. This means:

```
08:00 → totalizer = 1000
12:00 → totalizer = 2500
18:00 → totalizer = 3800
23:59 → totalizer = 5500  ← this IS the daily total
```

**Daily Total = Latest totalizer value of the day**

### Aggregation Pipeline — Daily Report

```js
ReportData.aggregate([
  { $match: { tankId, intervalTime: { $gte: dayStart, $lte: dayEnd } } },

  // Sort ascending so $last picks the latest (highest) totalizer
  { $sort: { intervalTime: 1 } },

  {
    $group: {
      _id:            null,
      dailyTotal:     { $last: '$totalizer' },   // ← latest = day total
      avgFlowRate:    { $avg: '$flowRate' },
      maxFlowRate:    { $max: '$flowRate' },
      minFlowRate:    { $min: '$flowRate' },
      totalReadings:  { $sum: 1 },
      firstReadingAt: { $first: '$intervalTime' },
      lastReadingAt:  { $last: '$intervalTime' },
    }
  }
])
```

### Aggregation Pipeline — Weekly / Monthly Report

```js
// Groups by day, picks latest totalizer per day, then sums
ReportData.aggregate([
  { $match: { tankId, intervalTime: { $gte: start, $lte: end } } },
  { $sort: { intervalTime: 1 } },
  {
    $group: {
      _id: { year, month, day },        // group by calendar day
      dailyTotal: { $last: '$totalizer' }, // latest totalizer = day total
      avgFlowRate: { $avg: '$flowRate' },
      maxFlowRate: { $max: '$flowRate' },
      totalReadings: { $sum: 1 },
    }
  },
  { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
])

// weeklyTotal  = sum of all dailyTotal values in the week
// monthlyTotal = sum of all dailyTotal values in the month
```

### Report Data Population (30-minute Snapshots)

```
Cron: every 30 minutes
    │
    ▼
Get all tanks where status = 'online'
    │
    └── For each tank:
         ├── LiveData.findOne({ tankId }).sort({ timestamp: -1 })
         └── ReportData.insertMany([{ tankId, flowRate, totalizer, intervalTime: now }])
```

---

## Data Retention Strategy

| Collection | Retention | Mechanism |
|---|---|---|
| `live_data` | **120 days** (`DATA_RETENTION_DAYS`) | MongoDB TTL index on `timestamp` + daily cron job |
| `report_data` | **120 days** (`DATA_RETENTION_DAYS`) | MongoDB TTL index on `createdAt` + daily cron job |
| `iwcrcm_transmissions` | **120 days** (`DATA_RETENTION_DAYS`) | MongoDB TTL index on `createdAt` + daily cron job |
| `users`, `tanks`, `iwcrcm_credentials` | Never auto-deleted | — |

The retention period is configured once in `.env` (`DATA_RETENTION_DAYS`, default `120`) and applied by `src/config/retention.js`:

- **At startup** `ensureRetentionIndexes()` makes each TTL index match the configured value. It drops the legacy `ttl_report_data_3months` (90-day) index and creates `ttl_report_data_retention`. This uses dropIndex + createIndex (Atlas `readWrite` role is enough), is idempotent, and is safe to run from several PM2 instances.
- **Daily at 00:00** `purgeExpiredData()` deletes anything older than exactly N days and logs the counts.

### Why Two Mechanisms?

The TTL index is async — MongoDB's TTL monitor runs every **60 seconds** and deletions are not guaranteed to happen at the exact expiry moment. The midnight cron job (`0 0 * * *`) provides a predictable, accountable cleanup with logging.

```
TTL Index (report_data, iwcrcm_transmissions)
  expireAfterSeconds: 10368000  →  120 days × 86400 seconds

Cron cleanup — daily at 00:00
  deleteMany({ createdAt: { $lt: now - 120 days } })
  → logs exact count deleted per collection
```

---

## Cron Jobs

Three scheduled jobs run in the same Node.js process:

```
┌──────────────────────┬──────────────────┬──────────────────────────────────────┐
│ Job Name             │ Schedule         │ What it does                         │
├──────────────────────┼──────────────────┼──────────────────────────────────────┤
│ tank-status-check    │ * * * * *        │ Finds online tanks with lastSeen      │
│                      │ (every 1 min)    │ older than 5 min → marks offline      │
│                      │                  │ → emits Socket.IO status event        │
├──────────────────────┼──────────────────┼──────────────────────────────────────┤
│ report-snapshot      │ */30 * * * *     │ For each online tank: reads latest    │
│                      │ (every 30 min)   │ LiveData → inserts into report_data   │
├──────────────────────┼──────────────────┼──────────────────────────────────────┤
│ report-cleanup       │ 0 0 * * *        │ Deletes report_data + IWCRCM outbox   │
│                      │ (midnight daily) │ older than DATA_RETENTION_DAYS (120). │
├──────────────────────┼──────────────────┼──────────────────────────────────────┤
│ iwcrcm-transmission  │ * * * * *        │ Only when IWCRCM_ENABLED=true. Queues │
│                      │ (every 1 min)    │ 1 reading/tank per send interval (60  │
│                      │                  │ min) and sends due/retry records.     │
└──────────────────────┴──────────────────┴──────────────────────────────────────┘
```

---

## Security Implementation

| Threat | Mitigation |
|---|---|
| Brute-force login | `authRateLimiter`: max 10 requests / 15 min per IP |
| API abuse | `globalRateLimiter`: max 100 requests / 15 min per IP |
| IoT flood | `iotRateLimiter`: max 200 requests / min per IP |
| Rogue IoT devices | `X-Device-Secret` shared key verification |
| JWT forgery | `HS256` with a long random secret (`JWT_SECRET`) |
| Privilege escalation | `authorize('admin')` middleware on all write routes |
| XSS / injection | `helmet` sets Content-Security-Policy + 11 other HTTP headers |
| Oversized payloads | `express.json({ limit: '10kb' })` |
| Password exposure | `select: false` on password field; never returned in responses |
| User enumeration | Login returns identical error for wrong email and wrong password |
| Stack traces in prod | `errorHandler` only attaches `stack` when `NODE_ENV=development` |

---

## Performance Optimizations

### MongoDB Indexing Strategy

```
Collection       Index                          Purpose
────────────     ────────────────────────────   ──────────────────────────────
users            { email: 1 }                   Login lookup
tanks            { deviceId: 1 }  unique        IoT ingestion device lookup
tanks            { status: 1 }                  Filter online/offline tanks
tanks            { lastSeen: -1 }               Offline detection query
live_data        { tankId: 1, timestamp: -1 }   Latest reading per tank
live_data        { deviceId: 1, timestamp: -1 } Device history
live_data        { timestamp: 1 }  TTL          Auto-expiry (120 days) + date-range queries
report_data      { tankId: 1, createdAt: -1 }   Report date range queries
report_data      { tankId: 1, intervalTime: -1} Aggregation queries
report_data      { createdAt: 1 }  TTL          Auto-expiry (DATA_RETENTION_DAYS, 120)
```

### Lean Queries

All read queries use `.lean()` which returns plain JavaScript objects instead of full Mongoose documents. This removes the overhead of Mongoose's change-tracking, virtual properties, and prototype chain — typically **2–5x faster** for read-heavy endpoints.

```js
// With .lean() — plain JS object, no Mongoose overhead
const tank = await Tank.findById(id).lean();

// Without .lean() — full Mongoose Document instance
const tank = await Tank.findById(id);
```

### Parallel Data Fetching

The dashboard service fetches tank list and status aggregation concurrently using `Promise.all`:

```js
const [tanks, statusAgg] = await Promise.all([
  Tank.find().lean(),
  Tank.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
]);
```

### Pagination

All list endpoints support cursor-based pagination to prevent loading entire collections:

```
GET /api/tanks?page=2&limit=20

MongoDB: .skip(20).limit(20)
Returns: { data, pagination: { total, page, limit, pages } }
```

### Connection Pooling

Mongoose is configured with `maxPoolSize: 10` — maintains up to 10 persistent MongoDB connections, reused across requests instead of opening a new connection per request.

---

## Environment Variables

```bash
# Application
NODE_ENV=development          # development | production
PORT=5000

# MongoDB Atlas
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/esr_tank_db

# JWT
JWT_SECRET=minimum_32_character_random_string_here
JWT_EXPIRE=7d                 # 7d | 24h | 1h

# CORS
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000   # 15 minutes in ms
RATE_LIMIT_MAX=100            # max requests per window

# IoT Device Auth (shared secret for all devices)
IOT_DEVICE_SECRET=long_random_secret_for_iot_devices

# Logging
LOG_LEVEL=info                # error | warn | info | http | debug
LOG_DIR=logs
```

---

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- MongoDB (local or Atlas)
- npm

### Local Development

```bash
# 1. Clone and enter project
cd ESR-NEW

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env — set MONGODB_URI, JWT_SECRET, IOT_DEVICE_SECRET

# 4. Start development server (with auto-restart)
npm run dev

# 5. Verify server is running
curl http://localhost:5000/health
```

### First Run — Create Admin User

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ESR Admin",
    "email": "admin@esr.com",
    "password": "Admin@123456",
    "role": "admin"
  }'
```

### Register a Tank

```bash
# Use the token from the register/login response
curl -X POST http://localhost:5000/api/tanks \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tankName": "Water Tank 1",
    "deviceId": "DEV001",
    "location": "Zone A — North End"
  }'
```

### Simulate IoT Device Data

```bash
curl -X POST http://localhost:5000/api/iot/data \
  -H "X-Device-Secret: your_iot_device_shared_secret_key_change_in_production" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "DEV001",
    "flowRate": 120,
    "totalizer": 4500,
    "timestamp": "2026-05-22T10:00:00.000Z"
  }'
```

---

## Docker Deployment

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

### Dockerfile — Multi-stage Build

The Dockerfile uses two stages:
1. **Base stage**: Installs only production dependencies (`npm ci --only=production`)
2. **Runtime stage**: Copies the built app, creates a non-root `nodejs` user, runs as that user

This ensures the final image has no dev dependencies and does not run as root.

```
Image size: ~180MB (node:18-alpine base)
User:       nodejs (UID 1001) — non-root for security
Port:       5000
Healthcheck: GET /health every 30s
```

---

## PM2 Production Deployment

```bash
# Install PM2 globally
npm install -g pm2

# Start in cluster mode (uses all CPU cores)
npm run pm2:start

# Monitor all processes
npm run pm2:monit

# View logs
npm run pm2:logs

# Reload with zero downtime
pm2 reload esr-tank-api

# Stop all
npm run pm2:stop
```

### PM2 Cluster Configuration

`ecosystem.config.js` is configured with `instances: 'max'` and `exec_mode: 'cluster'`. PM2 forks one worker per CPU core, with the OS load-balancing incoming connections across them.

**Important:** When running Socket.IO in cluster mode with multiple workers, all workers must share the same Socket.IO state. For horizontal scaling across multiple servers, uncomment the Redis adapter in `docker-compose.yml` and configure `REDIS_URL`.

```
Single server (PM2 cluster):
  Worker 1 ─┐
  Worker 2 ─┤── Same process memory → Socket.IO works correctly
  Worker N ─┘

Multiple servers:
  Server A ─┐
  Server B ─┤── Need Redis adapter → uncomment in docker-compose.yml
  Server C ─┘
```

---

## Postman Testing

Import both files from the `postman/` directory:

```
postman/
├── ESR_Tank_Management.postman_collection.json   — 38 requests, 8 folders
└── ESR_Tank_Management.postman_environment.json  — 11 environment variables
```

### Collection Runner Flow

Run the collection top-to-bottom. Each folder depends on the previous:

```
01 Health Check        → verifies server
02 Authentication      → auto-saves adminToken, controlRoomToken
03 Tank Management     → auto-saves tankId, deviceId
04 IoT Device          → sends 3 readings, triggers Socket.IO
05 Dashboard           → verifies aggregated data
06 Reports             → verifies aggregation pipelines
07 Error Cases         → all 401/403/404 scenarios (12 tests)
08 Cleanup             → deletes test data, clears env vars
```

### Newman CLI (Automated Testing)

```bash
npm install -g newman

newman run postman/ESR_Tank_Management.postman_collection.json \
       -e postman/ESR_Tank_Management.postman_environment.json \
       --reporters cli,json \
       --reporter-json-export results.json
```

---

## Logging

Winston writes to four rotating log file categories under `logs/`:

```
logs/
├── combined-YYYY-MM-DD.log    — all levels
├── error-YYYY-MM-DD.log       — errors only
├── exceptions-YYYY-MM-DD.log  — uncaught exceptions
└── rejections-YYYY-MM-DD.log  — unhandled promise rejections
```

- Files rotate daily, compress with gzip after rotation
- Maximum file size: 20MB before forced rotation
- Retention: 14 days of history
- Console output: enabled in `development`, disabled in `production`

---

## License

MIT
