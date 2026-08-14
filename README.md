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
| **Authentication** | Auth.js (Credentials Provider with College ID + Academic Year) |
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
Push the schema to your database and seed initial test data:
```bash
npx prisma db push
npx prisma generate
npm run db:seed
```

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
- **Privacy Controls**: Leaderboard visibility is opt-out, and college IDs are never exposed publicly.
- **Server-Only AI Calls**: AI interactions stay strictly server-side, validated with Zod, and auto-purged after 30 days.

---

## 📄 License & Credits

Built with ❤️ for **Faculty of Medicine, Alexandria University** students.
