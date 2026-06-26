# 🚂 RailAwaas Care
### Railway Quarter Maintenance System — Indian Railways

![Version](https://img.shields.io/badge/version-2.0-blue)
![Stack](https://img.shields.io/badge/stack-React%20%2B%20Node.js%20%2B%20SQLite-brightgreen)
![License](https://img.shields.io/badge/license-Government%20of%20India-orange)

---

## 📋 Overview

**RailAwaas Care** is a full-stack, deterministic (no AI), role-based railway quarter maintenance management system built for Indian Railways. It digitizes the entire complaint-to-closure lifecycle with an immutable blockchain audit ledger, geo-fenced IOW execution, OTP handshake closure, and automated SLA escalation.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 + Custom Premium CSS |
| Backend | Node.js + Express |
| Database | SQLite (via Prisma ORM) |
| Auth | Firebase Google Auth |
| Maps | React Leaflet |
| Blockchain | SHA-256 Hash Chain (custom) |

---

## 👥 Role-Based Access

| Role | Description |
|---|---|
| **Employee** | Raises complaints, views live timeline, gets closure OTP |
| **IOW** | Assigned tasks with SLA countdown, geo-resolves tickets |
| **SSE** | Assigns tickets to IOWs, approves SLA extensions, workload view |
| **DRM** | Command centre with heatmap, analytics, PDF reports |

---

## 🔑 Key Features

### Phase 1 — Authentication
- ✅ Google Firebase Auth with first-time Profile Setup Wizard (3-step)
- ✅ HRMS/AIMS tab (mock mode, ready for real API endpoint swap)

### Phase 2 — Database
- ✅ Users, Tickets, AuditLedger, Notifications, IOWExtensionRequests
- ✅ Full Prisma ORM with SQLite (easy to migrate to PostgreSQL)

### Phase 3 — Core Business Logic
- ✅ **50+ item Cascading Issue Matrix** — hardcoded SLA & Priority per issue
- ✅ **Geo-fenced Execution** — IOW must be within 50m of quarter GPS
- ✅ **Blockchain Audit Ledger** — SHA-256 chained hashes, tamper detection
- ✅ **OTP Handshake Closure** — 4-digit OTP visible only to employee
- ✅ **Automated SLA Escalation** — Yellow (24h) → Orange (72h) → Red (7d)
- ✅ **Material Indent PDF** — auto-generated on hold, SSE notified
- ✅ **Major Overhaul Auto-flag** — 3 same issues in 6 months triggers flag

### Phase 4 — 10 Advanced Features
- ✅ **SSE Dashboard** — IOW assignment, workload table, extension approvals
- ✅ **Live SLA Countdown** — real-time H:M:S with color urgency
- ✅ **In-App Notifications** — DB-backed bell with unread count, auto-poll
- ✅ **Blockchain Audit Viewer** — visual hash chain with tamper highlight
- ✅ **Quarter QR Generator** — canvas-based QR with GPS encode & PNG download
- ✅ **Monthly Defaulter PDF** — DRM auto-report with IOW scorecard
- ✅ **Priority Badges** — Critical/High/Medium/Low on every ticket
- ✅ **SLA Progress Bar** — visual % remaining on countdown
- ✅ **Swiggy-style Timeline** — Submitted→Seen→In-Progress→Resolved→Closed
- ✅ **Complaint Heatmap** — live GPS markers colored by severity

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- Git

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/parmalsingh26-gif/Railaavas.git
cd Railaavas

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your Firebase credentials

# 4. Push database schema
npx prisma db push

# 5. Start development server
npx tsx server.ts
```

App will be available at **http://localhost:3000**

---

## 🔧 Environment Variables

Copy `.env.example` to `.env` and fill in your Firebase config:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
```

---

## 📂 Project Structure

```
railawaas-care/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── components/
│   │   ├── AuthScreen.tsx      # Login (Google + HRMS tabs)
│   │   ├── ProfileSetup.tsx    # 3-step new user wizard
│   │   ├── EmployeeDashboard.tsx
│   │   ├── IOWDashboard.tsx
│   │   ├── SSEDashboard.tsx    # NEW
│   │   ├── DRMDashboard.tsx
│   │   ├── AuditChainViewer.tsx # NEW — Blockchain viewer
│   │   ├── NotificationBell.tsx # NEW — Real-time alerts
│   │   ├── SLACountdown.tsx    # NEW — Live timer
│   │   ├── MaterialIndentModal.tsx # NEW — Hold + PDF
│   │   ├── QRGenerator.tsx     # NEW — Quarter QR
│   │   └── PriorityBadge.tsx   # NEW — Priority display
│   ├── App.tsx                 # Root with role routing
│   ├── firebase.ts             # Firebase init
│   └── index.css               # Premium design system
├── server.ts                   # Express backend + Cron jobs
├── package.json
└── .env.example
```

---

## 🛡️ Anti-Corruption Features

| Feature | Description |
|---|---|
| Geo-fencing | IOW must physically be at quarter to resolve |
| OTP Handshake | Employee confirms completion independently |
| Blockchain Ledger | Every action hashed and chained — tamper-proof |
| Camera-only Upload | No gallery selection — live photo only |
| SLA Auto-escalation | Cron jobs escalate to DRM if deadlines missed |
| Immutable Profile | Employee profile locked after first setup |

---

## ⚠️ Important Notes

- **No AI features** — all logic is deterministic and rule-based
- SQLite used for development; migrate to PostgreSQL for production
- HRMS/AIMS login is in mock mode — replace `/api/auth/hrms-otp` endpoint to activate
- Firebase config must be added to `.env` before Google login works

---

*Built with ❤️ for Indian Railways Quarter Residents*
