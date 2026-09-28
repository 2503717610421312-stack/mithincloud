deployed link : mithincloud.vercel.app



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

## Project methodology

This project uses a defense-in-depth methodology to demonstrate the controlled handling of examination papers. Access is based on an authenticated Supabase identity, an administrator-approved profile, a least-privilege role, and a verified TOTP authenticator. These controls are evaluated together rather than treating a successful login as sufficient authorization.

Registration creates an authentication identity and a corresponding profile. New profiles are unapproved by default. An administrator assigns an appropriate role and approves the profile before the user can proceed to MFA enrollment or paper operations. Each protected API request independently checks the session, MFA assurance level, approval state, and role required for that operation.

When an authorized setter submits a paper, the server validates the title, subject, and content, encrypts the content with AES-256-GCM, and stores the ciphertext, initialization vector, and authentication tag in Supabase Postgres. The encryption key is held in a private server environment variable and is not sent to the browser. For an authorized view or print request, the server checks access again, decrypts the paper for that operation, generates a unique copy watermark, and records an audit event associated with the user and paper.

The resulting audit trail supports review of who created, viewed, or requested authorization to print a paper, and helps connect an issued copy to its recorded watermark. The methodology is assessed through negative authorization tests, inspection that stored content is ciphertext, confirmation that copy identifiers are unique, and verification that authorized actions create corresponding audit records. This is an academic prototype: it does not prevent screenshots, photography, endpoint compromise, or uncontrolled physical printing.

## Requirements

- Node.js 20.9 or later
- npm
- A Supabase project
- A GitHub repository and Vercel account for hosted deployment

## Supabase setup

1. Create a Supabase project and open its SQL Editor.
2. Run the complete [`supabase/schema.sql`](supabase/schema.sql) file.
3. If this project already has the older portal schema, run [`supabase/registration-migration.sql`](supabase/registration-migration.sql) once. It approves existing profiles and makes subsequent signups require approval.
4. In **Authentication → Providers → Email**, enable signups and set the password requirements you want. In **Authentication → Multi-Factor Authentication**, enable TOTP. This demo confirms new accounts server-side so registration does not send a confirmation email.
5. New users register at `/register` with a name, email and password, then sign in immediately. They remain unapproved until an administrator assigns a role.
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

1. Install Node.js 20.9 or later, npm, and JDK 11 or later (the JDK is only needed for the Java smoke tester).
2. Complete the Supabase setup above, copy the placeholder template with `Copy-Item .env.example .env.local`, and replace its four values with your Supabase URL, anon key, service-role key, and generated encryption key. Keep `.env.local`, the service-role key, and encryption key private.
3. From the project folder, install dependencies and check the TypeScript project:

```powershell
npm install
npm run lint
npm run build
```

If you need to create a new encryption key, run:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Put the output into `PAPER_ENCRYPTION_KEY`. Use a different high-entropy key in every environment. Never commit `.env.local`, the service-role key, or the encryption key.

4. Start the web app in PowerShell:

```powershell
npm run dev
```

5. Open `http://localhost:3000`. In a second PowerShell terminal, compile and run the Java HTTP smoke tester:

```powershell
$testOut = Join-Path $env:TEMP 'mithincloud-java-tests'
New-Item -ItemType Directory -Force $testOut | Out-Null
javac -d $testOut tests\ProjectSmokeTest.java
java -cp $testOut ProjectSmokeTest http://localhost:3000
```

The tester checks page availability and redirects, anonymous API access denial, and malformed/invalid registration requests. It does not create a user or change Supabase data. A non-zero exit code means one or more checks failed.

Available checks:

```bash
npm run lint
npm run build
npm audit
```

## Methodology integration checks

The Java smoke tester intentionally does not claim to verify authenticated MFA and role workflows. Complete these checks manually with separate test accounts after the smoke tests pass:

1. Approve a `question_setter` test account, enroll and verify TOTP, then create a paper. Confirm the paper row stores ciphertext and IV/authentication tag rather than readable question content.
2. Try paper creation with an approved `exam_centre` account; the API should deny it. Confirm an unapproved account cannot list or create papers.
3. Approve an `exam_centre` account, verify TOTP, then authorize a paper view and print. Each action should return a copy watermark and create a corresponding audit event.
4. Confirm an `exam_centre` cannot read the audit feed, while an approved `admin` or `exam_officer` with verified TOTP can.
5. Confirm browser-side reads of `papers` and `audit_logs` remain blocked by RLS. Never use real examination papers or production credentials for these checks.

## How to work with the system

The application has one security console at `/dashboard`; it does not have a separate administrator page. Paper and audit actions require an approved account and verified MFA. The role permissions implemented by the API are:

| Operation | Roles |
| --- | --- |
| Create a paper | `admin`, `question_setter`, `exam_officer` |
| View a paper | `admin`, `exam_officer`, `exam_centre` |
| Authorize printing | `admin`, `exam_centre` |
| Review audit events | `admin`, `exam_officer` |

1. Register at `/register`. The server confirms the new account and signs it in without sending an email link. The profile is created as unapproved, so paper access remains unavailable.
2. An administrator approves the profile and assigns only the role needed. This prototype does not include a user-management screen; use the Supabase SQL Editor and the approval query in the setup section.
3. Sign in again after approval. Enroll an authenticator using the QR code or manual setup key, then enter the current six-digit TOTP code. Paper operations remain locked until verification succeeds.
4. To create a paper, use **Create a paper** in the security console. Enter a title, subject, and question-paper content, then select **Encrypt & seal**. The server stores encrypted content and returns a reference watermark.
5. Sign in as an approved `exam_centre` to authorize a view or print. Each successful action creates a new copy watermark and audit record. `exam_officer` users can view papers but cannot authorize printing.
6. Sign in as an approved `admin` or `exam_officer` and review **Recent activity** to inspect recorded events and copy identifiers.

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
- **Email ownership:** public registration marks submitted email addresses as confirmed without proving ownership. This is for demonstrations only; use verified email or an invitation-based registration flow before production.

Never use real examination papers or production secrets in this demonstration deployment.
