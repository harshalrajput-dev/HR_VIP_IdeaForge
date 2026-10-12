# HR VIP IdeaForge

A crowdsourced innovation platform for HR VIP employees: anyone can submit a workplace problem or idea, the community upvotes and proposes solutions, HR VIP staff review and steer ideas through a controlled lifecycle, and shipped work is permanently credited on a public Wall of Fame.

## Stack

| Layer | Technology |
| --- | --- |
| API | Node.js, Express 4, Mongoose 8, JWT, bcrypt |
| Client | React 18, React Router 6, Vite 5, Tailwind CSS 3 |
| Database | MongoDB |
| Security | helmet, cors, compression, rate limiting, express-validator |

## Project layout

```
.
├── backend/            Express REST API
│   ├── config/         Environment + enums/constants
│   ├── controllers/    Request handlers
│   ├── middleware/     Auth, RBAC, validation, error handling
│   ├── models/         Mongoose schemas
│   ├── routes/         Route tables
│   ├── scripts/        Seed data and test suites
│   ├── utils/          Tokens, points, pagination, serialisation
│   └── server.js       Entry point
└── frontend/           React single-page app
    ├── src/components/ Reusable UI (IdeaCard, DiscussionThread, …)
    ├── src/context/    AuthContext
    ├── src/hooks/      useApi, useAuthGuard
    ├── src/pages/      Route-level screens
    └── src/services/   Axios client
```

## Prerequisites

- Node.js 18 or newer
- A running MongoDB instance (local or Atlas)

## Setup

```bash
npm run install:all          # installs root, backend and frontend dependencies
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env`:

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (default `5000`) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Token signing secret |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `CLIENT_URL` | Allowed CORS origin |
| `BOOTSTRAP_ADMIN_EMAILS` | Comma-separated emails granted HR VIP access on signup |
| `NODE_ENV` | `development` or `production` |

Edit `frontend/.env`:

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Base URL of the API (default `http://localhost:5000/api`) |

## Running

```bash
npm run seed        # load demo data (idempotent)
npm run seed:fresh  # wipe and reload demo data
npm run dev         # API on :5000 and Vite dev server on :5173
```

Or run each side independently with `npm run dev:backend` / `npm run dev:frontend`.

### Demo accounts

All demo accounts use the password `Password123`.

| Email | Role |
| --- | --- |
| `admin@hrvip.com` | Admin (HR VIP) |
| `maya@hrvip.com` | Standard user |
| `dev@hrvip.com` | Standard user |
| `ananya@hrvip.com` | HR VIP employee |

## Idea lifecycle

```
Submitted -> In Discussion -> Under HR VIP Review -> Approved -> Completed
```

- The first comment on an idea automatically moves it to `In Discussion`.
- HR VIP staff move ideas between states; every transition is written to an audit trail with the actor, timestamp and optional note.
- One comment per idea can be crowned the best solution, which awards points to its author.
- Publishing a project requires an `Approved` idea and a resolvable contributor (the best solution author, or an explicit list), then moves the idea to `Completed` and creates the credit record shown on the Wall of Fame.

## Roles and permissions

- **User** — submit ideas, comment, upvote, mark a best solution on their own idea.
- **HR VIP employee** — everything a user can do, plus review the queue, change statuses, mark best solutions, publish projects and manage roles.
- **Admin** — full HR VIP access, including role management.

The first account to register is promoted to `hr_vip_employee`; any email listed in `BOOTSTRAP_ADMIN_EMAILS` is also promoted on signup.

## API overview

All responses use the envelope `{ success, data, meta? }` and list endpoints return `{ success, data: [...], meta: { page, limit, total, totalPages, hasNext, hasPrev } }`. Every document exposes `id` (never `_id`).

| Method | Endpoint | Access |
| --- | --- | --- |
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Authenticated |
| GET | `/api/ideas` | Public, filterable |
| GET | `/api/ideas/meta/filters` | Public |
| GET | `/api/ideas/:id` | Public |
| POST | `/api/ideas` | Authenticated |
| PATCH | `/api/ideas/:id` | Author or HR VIP |
| DELETE | `/api/ideas/:id` | Author or admin |
| POST | `/api/ideas/:id/upvote` | Authenticated |
| PATCH | `/api/ideas/:id/status` | HR VIP |
| GET | `/api/ideas/:id/comments` | Public |
| POST | `/api/ideas/:id/comments` | Authenticated |
| PATCH | `/api/comments/:id` | Author or HR VIP |
| PATCH | `/api/comments/:id/mark-best` | Idea author or HR VIP |
| DELETE | `/api/comments/:id` | Author, HR VIP or admin |
| GET | `/api/projects` | Public (Wall of Fame) |
| GET | `/api/admin/dashboard` | HR VIP |
| GET | `/api/admin/ideas` | HR VIP |
| POST | `/api/admin/projects` | HR VIP |
| GET | `/api/admin/projects` | HR VIP |
| GET | `/api/admin/users` | HR VIP |
| PATCH | `/api/admin/users/:id/role` | HR VIP |
| GET | `/api/health` | Public |

## Tests

```bash
npm test              # backend lifecycle suite (48 checks) + frontend render suite (17 checks)
npm run lint          # ESLint for both packages
npm run test:contract # live API/client contract check (30 checks)
```

`npm run test:contract` replays every request the React client makes against a running API and asserts the exact response shapes the components destructure. Because it mutates data, it requires a freshly seeded database:

```bash
npm run seed:fresh
npm start             # in a second shell
npm run test:contract
```

## License

MIT
