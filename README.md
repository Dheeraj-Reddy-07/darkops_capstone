# DarkOps - Operational Intelligence Dashboard

DarkOps is a comprehensive operational intelligence platform for dark store network management, providing real-time monitoring of store health, complaint resolution, and SLA compliance across 200+ stores in 14 Indian cities.

## 🚀 Features

- **Executive Dashboard**: Network-wide PulseScore monitoring, SLA compliance tracking, and critical store identification
- **Operations Queue**: Live case management with SLA risk prioritization, agent workload balancing, and automated escalation
- **Dark Store Network**: Detailed store performance metrics, equipment health monitoring, and work order management
- **Fraud Detection**: AI-powered fraud review system with confidence scoring and decision tracking
- **Customer Portal**: Self-service portal for order tracking, complaint submission, and chatbot assistance
- **Security & Audit**: Comprehensive security monitoring, audit logging, and threat detection
- **Theme Support**: Seamless dark and light mode toggle across the entire application
- **Role-Based Access Control**: Granular permissions for PLATFORM_ADMIN, EXECUTIVE, OPERATIONS, CUSTOMER_SUPPORT, STORE_MANAGER, and CUSTOMER roles

## 🛠️ Tech Stack

### Frontend

- **Framework**: TanStack Start (React Router)
- **UI**: React 18, Tailwind CSS, shadcn/ui components
- **State Management**: TanStack Query (React Query)
- **Charts**: Recharts
- **Icons**: Lucide React

### Backend

- **Runtime**: Node.js with Express
- **Database**: PostgreSQL with Supabase
- **Authentication**: Supabase Auth with JWT
- **API**: REST API with Express middleware

### Infrastructure

- **Hosting**: Supabase (database + auth)
- **Development**: Vite for frontend, tsx for backend

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (for database and auth)
- Environment variables configured

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Dheeraj-Reddy-07/darkops_capstone.git
cd darkops_capstone
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 4. Run database migrations

```bash
# Apply database migrations in order
psql -h your_host -U your_user -d your_database -f database/migrations/001_extensions.sql
psql -h your_host -U your_user -d your_database -f database/migrations/002_enums.sql
# ... continue for all migrations
```

### 5. Seed the database

```bash
npm run seed
```

### 6. Start development servers

```bash
# Terminal 1: Start frontend
npm run dev:client

# Terminal 2: Start backend
npm run dev:server
```

The frontend will be available at `http://localhost:5173`
The backend API will be available at `http://localhost:5000`

## 👥 Test Users

| Role             | Email                    | Password |
| ---------------- | ------------------------ | -------- |
| PLATFORM_ADMIN   | admin@darkops.com        | demo123  |
| EXECUTIVE        | exec@darkops.com         | demo123  |
| OPERATIONS       | manager@darkops.com      | demo123  |
| CUSTOMER_SUPPORT | agent.a@darkops.com      | demo123  |
| STORE_MANAGER    | storemanager@darkops.com | demo123  |
| CUSTOMER         | customer@darkops.com     | demo123  |

## 📁 Project Structure

```
darkops_capstone/
├── database/
│   ├── migrations/          # SQL migration files
│   ├── seed.ts             # Database seeding script
│   └── init.sql            # Initial schema
├── server/
│   ├── controllers/        # API route handlers
│   ├── middleware/         # Express middleware (auth, validation)
│   ├── lib/                # Server utilities (Supabase client)
│   ├── routes/             # API route definitions
│   ├── services/           # Business logic
│   └── index.ts            # Server entry point
├── src/
│   ├── components/         # React components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Frontend utilities
│   ├── routes/             # TanStack Router routes
│   ├── types/              # TypeScript type definitions
│   └── main.tsx            # Frontend entry point
└── package.json
```

## 🔐 Authentication & Authorization

### Authentication Flow

1. User logs in via Supabase Auth
2. JWT token stored in cookies
3. Token validated on each API request
4. User role fetched from profiles table

### Role-Based Access Control (RBAC)

- **PLATFORM_ADMIN**: Full system access
- **EXECUTIVE**: Read access to all dashboards
- **OPERATIONS**: Case management, store monitoring
- **CUSTOMER_SUPPORT**: Support agent workspace, ticket resolution
- **STORE_MANAGER**: Own store management
- **CUSTOMER**: Personal order/complaint access

## 🗄️ Database Schema

Key tables:

- `profiles` - User profiles and roles
- `stores` - Dark store information
- `complaints` - Customer complaints
- `pulse_scores` - Store health metrics
- `store_metrics_snapshots` - Performance snapshots
- `work_orders` - Equipment maintenance
- `fraud_reviews` - Fraud detection
- `notifications` - User notifications

## 📊 Key Metrics

### PulseScore Calculation

PulseScore is a composite metric (0-100) based on:

- Equipment health (25%)
- SLA compliance (25%)
- Refund rate (20%)
- Delivery performance (15%)
- Picker efficiency (10%)
- Inventory accuracy (5%)

### SLA Targets

- P1 (Critical): 15 minutes
- P2 (High): 30 minutes
- P3 (Medium): 2 hours
- P4 (Low): 4 hours

## 🐛 Known Issues & Fixes

### Fixed Issues

1. **403 Forbidden on Executive Metrics** - Fixed by removing beforeLoad guard and using service role client
2. **Route Flickering** - Fixed by adding OPERATIONS role to RBAC permissions
3. **Empty Operations Dashboard** - Fixed pagination bug where page parameter was undefined
4. **Case Queue Filtering** - Fixed hardcoded agent ID in "My queue" filter

### Current Workarounds

- Service role client used in controllers to bypass RLS for demo purposes
- Cache clearing on route changes to prevent stale data

## 🚧 Development Progress

See `PROGRESS.md` for detailed development tracking.

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📝 License

This project is part of a Deloitte Capstone project.

## 📞 Support

For issues or questions, please contact the development team.
