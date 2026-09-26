# QP/Sec: Secure Question Paper Portal

An academic demonstration of a controlled examination-paper lifecycle: authenticated authoring, server-side encryption, MFA-gated role access, per-copy trace identifiers, controlled print authorization, and audit review.

> This is a demonstration, not a production examination-security platform. A web app cannot prevent photography, screenshots, copying after decryption, compromised endpoints, or access to a local printer. HSM/KMS key custody, managed print, DLP, network controls, CCTV and physical transport procedures require institution-managed infrastructure and are not simulated here.

## Workflow

Question setter → MFA + role check → AES-256-GCM encryption → Supabase storage → authorized view/print → unique copy watermark → audit event → investigation

| Control | Demonstration |
| --- | --- |
| Authentication | Supabase email/password and TOTP authenticator MFA |
| RBAC | `admin`, `question_setter`, `exam_officer`, `exam_centre` roles enforced in API routes |
| Encryption | Question content encrypted on the server with AES-256-GCM; keys are never sent to the browser |
| Storage | Supabase Postgres stores ciphertext; browser-side RLS access to paper and audit rows is denied |
| Copy traceability | Each authorized view and print authorization receives a unique copy ID tied to the user and event |
| Audit | Creation, view, and print authorization events are recorded with time and available request metadata |
| Incident response | Admins/exam officers can review events; revoke a user's Supabase account/session and investigate the matching copy ID |

## Requirements

- Node.js 20.9 or later
- npm
- A Supabase project
- A GitHub repository and Vercel account for hosted deployment

## Supabase setup

1. Create a Supabase project and open its SQL Editor.
2. Run the complete [`supabase/schema.sql`](supabase/schema.sql) file.
3. If this project already has the older portal schema, run [`supabase/registration-migration.sql`](supabase/registration-migration.sql) once. It approves existing profiles and makes subsequent signups require approval.
4. In **Authentication → Providers**, enable Email signups. In **Authentication → Multi-Factor Authentication**, enable TOTP.
5. New users register at `/register`, confirm their email if prompted, and remain unapproved. An administrator must verify the request and assign a role before paper access is enabled.
6. To bootstrap the first administrator, create the user through Supabase Auth, then run this in SQL Editor using that user's Auth UUID:

```sql
update public.profiles
set role = 'admin', approved = true
where id = 'USER_UUID_HERE';
```

To approve a registrant, assign only the role they need:

```sql
update public.profiles
set role = 'exam_centre', approved = true
where id = 'USER_UUID_HERE';
```

Valid roles: `admin`, `question_setter`, `exam_officer`, `exam_centre`. New registrations default to the unapproved `exam_centre` role.

7. Copy the project URL, anon/publishable key, and service-role key from **Project Settings → API**. The service-role key bypasses RLS and must only be configured as a private server environment variable.

After approval, the portal guides each user through enrolling a TOTP authenticator. Subsequent sign-ins prompt for a current code. Paper APIs require Supabase's `aal2` assurance level. Admins should enroll MFA before assigning privileged roles.

## Local run

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill in real values. Generate the encryption key with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Put the output into `PAPER_ENCRYPTION_KEY`. Use a different high-entropy key in every environment. Never commit `.env.local`, the service-role key, or the encryption key.

```bash
npm run dev
```

Open `http://localhost:3000`.

Available checks:

```bash
npm run lint
npm run build
npm audit
```

## Demonstration flow

1. Register at `/register` and confirm the email if Supabase requires confirmation.
2. Have an administrator approve the profile and assign `question_setter` or another required role.
3. Sign in and enroll/verify an authenticator if prompted.
4. Create a paper as a `question_setter`; the API encrypts content before storing it in Supabase.
5. Approve an `exam_centre` or `exam_officer` account, then authorize a view or print. Each action creates a unique copy watermark and audit event.
6. Sign in as an `admin` or `exam_officer` to review the audit feed.

Print authorization opens a browser print view with a visible copy watermark. It records an authorization request; it does **not** attest that a registered physical printer was used or prevent saving/capturing the rendered paper.

## Deploy to Vercel

1. Push this repository to GitHub. Confirm `.env.local` is not staged and no real keys are present in Git history.
2. Import the repository in Vercel as a Next.js project. Use Node.js 20.9+.
3. Add these Environment Variables in Vercel Project Settings for each deployment environment:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
PAPER_ENCRYPTION_KEY
```

4. Deploy and add the production URL to Supabase **Authentication → URL Configuration → Site URL / Redirect URLs**.
5. Create or promote a test user, enroll TOTP, then test creation, viewing, printing and audit review.

Keep `SUPABASE_SERVICE_ROLE_KEY` and `PAPER_ENCRYPTION_KEY` private in Vercel. Do not prefix them with `NEXT_PUBLIC_`.

## Important production gaps

- **HSM/KMS:** encryption keys are environment secrets, not HSM-protected, wrapped, or rotated. Use a managed KMS/HSM and defined key lifecycle before handling real papers.
- **Secure print:** this prototype logs authorization and adds a visible watermark; it does not restrict printer models, queues, number of pages, reprints, or physical access.
- **DLP/device controls:** screenshots, cameras, USB, email, clipboard, and local copies cannot be reliably controlled by this browser app.
- **Physical operations:** transportation seals, centre custody, CCTV, mobile-device restrictions, and incident playbooks must be implemented and audited operationally.
- **Watermarking:** IDs are visible labels associated with each issued response, not robust invisible forensic watermarks embedded into documents.
- **Audit guarantees:** audit inserts use a server-side service key, but this demo does not provide immutable/WORM retention, external log shipping, tamper-evident chaining, or alerting.
- **MFA recovery:** configure and test an institution-owned recovery process; do not rely on a shared administrator account.

Never use real examination papers or production secrets in this demonstration deployment.
