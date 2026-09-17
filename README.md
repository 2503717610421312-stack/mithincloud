# Secure Question Paper Management Portal

A MicroProject implementation for protecting examination question papers against unauthorized access, copying and distribution.

## Main security flow

Question Setter → MFA/Login → Secure Portal → Encryption + Watermark Metadata → Supabase/PostgreSQL → Authorized Exam Centre → Secure Print → Audit Logs → Leakage Investigation

## Features implemented

- Supabase email/password authentication.
- Role-based access: `admin`, `question_setter`, `exam_officer`, `exam_centre`.
- PostgreSQL Row Level Security (RLS).
- Server-side AES-256-GCM encryption for question-paper content.
- Unique watermark/copy identifier for every stored paper.
- Audit logging for create, view/decrypt and print actions.
- Secure server API routes.
- Exam-centre print action with a visible watermark footer.
- Dashboard showing papers and recent audit events.
- Vercel-ready Next.js deployment.

> This is an academic prototype. Real national/state examination infrastructure would also require HSM/KMS, hardened endpoints, secure print infrastructure, DLP, CCTV/device controls, network segmentation, key rotation, penetration testing and formal operational procedures.

## 1. Requirements

- Node.js 20+
- A Supabase project
- A GitHub repository
- A Vercel account

## 2. Supabase setup

1. Create a new project at Supabase.
2. Open **SQL Editor**.
3. Run `supabase/schema.sql`.
4. Open **Authentication → Providers** and keep Email enabled.
5. Create test users from **Authentication → Users → Add user**.
6. After creating a user, set that user's role using SQL, for example:

```sql
update public.profiles
set role = 'question_setter'
where id = 'USER_UUID_HERE';
```

Valid roles are:
`admin`, `question_setter`, `exam_officer`, `exam_centre`.

7. Copy the Project URL and anon/publishable key from Supabase project settings.
8. Copy the service-role key only for the server-side Vercel environment variable. Never expose it to the browser.

## 3. Generate the encryption key

Generate a 32-byte random key and encode it as base64.

Example with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Put the result into `PAPER_ENCRYPTION_KEY`.

Do not commit the real key to GitHub.

## 4. Local configuration

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Then update:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAPER_ENCRYPTION_KEY`

### Where exactly are the Supabase values used?

`lib/supabase-browser.ts`
- Uses `NEXT_PUBLIC_SUPABASE_URL`
- Uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`

`lib/supabase-server.ts`
- Uses the public URL + anon key for the authenticated server client.

`lib/supabase-admin.ts`
- Uses `SUPABASE_SERVICE_ROLE_KEY`.
- Server-only; never use this in a client component.

API routes use these server utilities.

## 5. Install and run

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## 6. Test flow

### Question setter

1. Login with a user whose profile role is `question_setter`.
2. Enter title, subject and question paper text.
3. Click **Create & Encrypt Paper**.
4. The server generates a unique watermark ID and encrypts the paper with AES-256-GCM.
5. Only encrypted content is stored in the `papers` table.

### Exam centre

1. Change a test user's role to `exam_centre`.
2. Login with that user.
3. Open a paper.
4. Click **Decrypt / View**.
5. Click **Secure Print**.
6. A print audit record is created.

### Audit

Admins and exam officers can see recent audit events.

## 7. Sample input

```text
Title: Data Structures Internal Examination
Subject: Data Structures
Paper:
1. Explain stack and queue.
2. Write an algorithm for binary search.
3. Analyze the time complexity of merge sort.
```

## 8. Sample output

The dashboard displays:

```text
Data Structures Internal Examination
Status: Encrypted
Watermark: WP-XXXXXXXX
Created by: authorized user
```

After secure viewing:

```text
Audit event: PAPER_DECRYPTED
Watermark: WP-XXXXXXXX
User: authorized exam-centre user
```

After printing:

```text
Audit event: PAPER_PRINTED
Watermark: WP-XXXXXXXX
```

## 9. Project structure

```text
question-paper-security-portal/
├── app/
│   ├── api/
│   │   ├── audit/                  # Audit log API
│   │   └── papers/
│   │       ├── route.ts            # Create/list papers
│   │       └── [id]/
│   │           ├── decrypt/route.ts # Server-side decryption
│   │           └── print/route.ts   # Secure-print audit
│   ├── dashboard/page.tsx          # Main protected dashboard
│   ├── login/page.tsx              # Authentication
│   ├── globals.css                 # UI styling
│   ├── layout.tsx                  # Root layout
│   └── page.tsx                    # Redirect entry
├── components/
│   └── Dashboard.tsx               # Main UI
├── lib/
│   ├── crypto.ts                   # AES-256-GCM encryption/decryption
│   ├── supabase-admin.ts           # Server-only admin client
│   ├── supabase-browser.ts         # Browser Supabase client
│   ├── supabase-server.ts          # Server Supabase client
│   └── watermark.ts                # Watermark ID generation
├── supabase/
│   └── schema.sql                  # Tables, RLS and policies
├── .env.example                    # Environment variable template
├── package.json
└── README.md
```

## 10. GitHub

Create an empty GitHub repository, then:

```bash
git init
git add .
git commit -m "Initial secure question paper portal"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Do not commit `.env.local`.

## 11. Vercel deployment

1. Push the project to GitHub.
2. Open Vercel and import the GitHub repository.
3. Framework: Next.js.
4. Add these Environment Variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
PAPER_ENCRYPTION_KEY
```

5. Deploy.
6. In Supabase Authentication URL settings, add your Vercel URL to the allowed site/redirect URLs if required by your authentication configuration.
7. Test login, paper creation, decryption and print logging.

## Security notes for viva

- **Encryption:** AES-256-GCM protects question-paper content at rest in the database.
- **RBAC:** users can perform actions according to their role.
- **RLS:** database policies provide another authorization layer.
- **Watermarking:** each paper has a unique identifier that can be associated with a leak.
- **Audit logging:** security-sensitive actions are recorded.
- **MFA:** this prototype uses Supabase authentication; MFA can be enabled in Supabase Auth for production.
- **HSM:** represented as a production requirement rather than simulated inside a student web application.
- **DLP/CCTV/device monitoring:** these are operational controls and cannot be reliably implemented by a normal Vercel web app alone.

## Important

Never put the Supabase service-role key or encryption key in:
- React client code
- `NEXT_PUBLIC_*` variables
- GitHub
- screenshots
- README files
- browser localStorage

