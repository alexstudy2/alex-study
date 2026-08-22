# 🩺 Alex Study

> A dedicated, high-performance study companion built exclusively for students at the **Faculty of Medicine, Alexandria University**.

![Next.js](https://img.shields.io/badge/Next.js-16_App_Router-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?style=for-the-badge&logo=prisma)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)
![Groq AI](https://img.shields.io/badge/Groq_AI-Fast_LLM-f3603f?style=for-the-badge)
![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css)

---

## ✨ Features

- **📚 Specialized Academic Structure**: Tailored specifically to the 5-year + Internship medical curriculum (Years 1–5 & Internship).
- **⏱️ Focus & Pomodoro Sessions**: Track study time, distraction rates, and calculate the custom **Focus Score**:
  $$\text{Focus Score} = \left(\frac{\text{Actual Minutes}}{\text{Planned Minutes}}\right) \times 60 + (1 - \text{Distraction Rate}) \times 40$$
- **🏆 Gamification & Leaderboards**: Weekly batch leaderboards (All College Students & Friends) with anti-cheat protection.
- **⚔️ Challenges & Peer Study**: 1-on-1 competitive challenges, study lobbies, and real-time study rooms.
- **🤖 Privacy-Preserving AI**: Groq AI integration for natural language task parsing, personalized study insights, and editable exam plans.
- **🌍 Full Bilingual Support**: Native Arabic (RTL) & English (LTR) interface with Cairo (`Africa/Cairo`) timezone boundaries.
- **🎨 Medical Gold & Royal Navy Design**: Styled with a classic academic aesthetic using the custom **Cinzel** typography and curated color palette.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS v4, Vanilla CSS Design Tokens, Cinzel Serif Typography |
| **Database & ORM** | Supabase (PostgreSQL), Prisma ORM 6.19 |
| **Authentication** | next-auth v4 (Credentials Provider with College ID + Academic Year) |
| **State Management** | Zustand (Client), TanStack Query (Server) |
| **AI Integration** | Groq AI (OpenAI-compatible SDK) |
| **Rate Limiting & Locking**| Upstash Redis (REST API) |
| **Notifications & Mail** | Gmail SMTP via Nodemailer, In-App Notifications |

---

## 🚀 Quick Start & Local Setup

### Prerequisites
- **Node.js**: v20 or newer
- **npm** / **yarn** / **pnpm**

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/alex-study.git
cd alex-study
```

### 2. Install Dependencies
```bash
npm install --legacy-peer-deps
```

### 3. Environment Variables
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

```env
DATABASE_URL="postgresql://postgres:[password]@[host]:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[password]@[host]:5432/postgres"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"
GROQ_API_KEY="gsk_..."
UPSTASH_REDIS_REST_URL="https://...upstash.io"
UPSTASH_REDIS_REST_TOKEN="..."
NEXT_PUBLIC_SUPABASE_URL="https://...supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_USER="your-email@gmail.com"
SMTP_APP_PASSWORD="..."
CRON_SECRET="..."
```

### 4. Database Setup
Apply the migration history (never `db push` against a shared database -- the migration
files contain raw-SQL partial unique indexes that `push` cannot see and would silently
drop, and push/deploy produce different constraint sets; see docs/OPERATIONS.md):
```bash
npx prisma migrate deploy
npx prisma generate
npm run db:seed
```
`npx prisma db push` is acceptable only for a throwaway local sandbox that will never be
migrated.

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Verification & Testing Commands

Run the full verification suite before committing or pushing changes:

```bash
# Typecheck TypeScript
npm run typecheck

# Validate Prisma Schema
npm run db:validate

# Run Linter & Formatter
npm run lint
npm run format:check

# Run Unit Tests
npm test
```

---

## 🛡️ Privacy & Security

- **Compound Auth Key**: Authentication uses `(collegeId, academicYear)` compound unique constraints.
- **Privacy Controls**: Leaderboard visibility is opt-out, and college IDs are findable only by exact match in user search.
- **Server-Only AI Calls**: AI interactions stay strictly server-side, validated with Zod, and auto-purged after 30 days.

---

## 🚀 Production Deployment

1. **Database**: apply migrations against the direct (session-mode) connection with
   `npx prisma migrate deploy` -- see docs/OPERATIONS.md. Never `db push` a shared
   environment (raw-SQL partial indexes are invisible to push and would be dropped).
2. **Vercel project**: import the repo; region and function limits come from
   `vercel.json`. Node >= 20 is enforced via the `engines` field.
3. **Required environment variables** (full annotated list in `.env.example`):
   `DATABASE_URL`, `NEXTAUTH_SECRET` (32+ chars), `CRON_SECRET` (32+ chars), and either
   `NEXTAUTH_URL` or `AUTH_TRUST_HOST=true`. Optional but warned-at-boot when absent:
   Upstash (shared rate limiting), SMTP (email delivery), Groq (AI features).
4. **GitHub Secrets**: repository secrets `APP_URL` and `CRON_SECRET` power the scheduled
   cron workflow (`.github/workflows/cron.yml`) that calls `/api/internal/jobs/*`.
5. **Post-deploy smoke**: `GET /api/health` must return `{"ok":true}`; sign-in sets a
   `__Secure-` prefixed cookie; completing a password reset invalidates older sessions
   immediately; the response CSP carries a per-request nonce.

---

## 📄 License & Credits

Built with ❤️ for **Faculty of Medicine, Alexandria University** students.
