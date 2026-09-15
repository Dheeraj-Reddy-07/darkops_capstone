# DarkOps - Demo Guide

## Deloitte Capstone 2026

This guide covers how to start, access, and demonstrate the DarkOps Operational Intelligence Platform.

---

## Prerequisites

- Node.js v18+
- The project `.env` file populated with Supabase credentials (do **not** commit `.env` to git)
- Supabase project active at `obcfrzyjsqddkseayila.supabase.co`

---

## Starting the Application

### Terminal 1 - Frontend (Vite)

```bash
npm run dev:client
# Vite starts on http://localhost:5173
```

### Terminal 2 - Backend (Express)

```bash
npm run dev:server
# Express starts on http://localhost:5000
# Vite proxies /api/* → Express automatically
```

### Open the Application

Navigate to: **http://localhost:5173**

---

## Demo Credentials

All demo users share the same password:

| Role               | Email                  | Password      | Experience                                     |
| ------------------ | ---------------------- | ------------- | ---------------------------------------------- |
| Executive          | `exec@darkops.com`     | `password123` | Executive dashboard, network metrics, insights |
| Operations Manager | `manager@darkops.com`  | `password123` | Operations queue, case management              |
| Operations Agent   | `agent@darkops.com`    | `password123` | Assigned cases, case resolution                |
| Fraud Analyst      | `fraud@darkops.com`    | `password123` | Fraud review queue, approve/deny decisions     |
| Customer           | `customer@darkops.com` | `password123` | Customer portal, order tracking, support       |

> **Note:** These are demo accounts created for this capstone project. Never use real production credentials in this guide.

---

## Recommended Demo Flow

### Entry Experience

1. Open `http://localhost:5173` → see the DarkOps landing page
2. Click **"Access DarkOps"** → see the polished login page
3. In the **Demo Access** panel, click **"Executive"** → credentials auto-fill
4. Click **"Sign in to DarkOps"**

### Executive Role Demo (5-7 minutes)

- **Executive Dashboard** (`/executive`): Network PulseScore, critical stores, KPIs, city-level table
- **Executive Insights** (`/executive/insights`): Ask operational questions in plain language
- **Dark Stores** (`/dark-stores`): Store network matrix, filter by zone/city
- Click any store → **Store Detail** with PulseScore breakdown

### Operations Role Demo (3-5 minutes)

- Log in as Manager or Agent
- **Operations** (`/operations`): Live complaint queue with priority, SLA, and status
- Click any case → **Case Detail** with timeline, escalation, and resolution controls
- Demonstrate assigning and escalating a case

### Fraud Analyst Demo (3-4 minutes)

- Log in as Fraud Analyst
- **Fraud Queue** (`/fraud`): Risk-flagged claims with confidence scores
- Click a flagged case → **Fraud Case Detail**: factors, customer history, approve/deny
- Demonstrate a decision

### Customer Portal Demo (2-3 minutes)

- Log in as Customer
- **Customer Home** (`/customer`): Live order tracking, open issue status, recent orders
- **Customer Support** (`/customer/support`): 3-step complaint wizard, order selection, category, details

---

## Important Routes

| Route                    | Description                     |
| ------------------------ | ------------------------------- |
| `/`                      | Landing page                    |
| `/login`                 | Sign in                         |
| `/executive`             | Executive network dashboard     |
| `/executive/insights`    | AI-assisted analytics assistant |
| `/operations`            | Operations case queue           |
| `/cases/:id`             | Individual case detail          |
| `/dark-stores`           | Dark store network              |
| `/dark-stores/:id`       | Store detail with PulseScore    |
| `/dark-stores/:id/pulse` | PulseScore drill-down           |
| `/fraud`                 | Fraud review queue              |
| `/fraud/:id`             | Fraud case detail               |
| `/customer`              | Customer portal                 |
| `/customer/support`      | Customer complaint form         |

---

## Global Search

Press **⌘K** (Mac) or **Ctrl+K** (Windows) from any dashboard page to open the Command Palette. Type at least 2 characters to search stores and cases.

---

## Known Limitations

- **Customer portal orders**: The customer portal shows real order data only if `customer@darkops.com`'s profile is linked to a customer record. If no orders appear, the portal gracefully falls back to demo data.
- **Notifications**: The notification bell currently shows 0 new alerts (real-time Supabase subscriptions are a P2 enhancement).
- **AI Insights**: Executive Insights uses a deterministic mock AI response engine backed by real seeded metrics. Live LLM integration is a future enhancement.

---

## Architecture

```
Browser (React + Vite + TanStack Router/Query)
          │
          │  Vite proxy: /api → :5000
          ▼
  Node.js + Express (port 5000)
          │
          │  Supabase JS SDK (service role, server-only)
          ▼
  Supabase PostgreSQL + Auth + RLS
          (hosted: obcfrzyjsqddkseayila.supabase.co)
```

---

_Last updated: August 2026_
