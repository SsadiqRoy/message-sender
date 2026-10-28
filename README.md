# Message Sender

Next.js App Router, TypeScript, Sass, Supabase Auth/Postgres and Nodemailer. Design: https://www.figma.com/design/L1F3Fv6NeU4M9Mo0xtdxIz/Message-Sender?node-id=5-208

## Setup

1. `npm ci`
2. Copy `.env.example` to `.env.local`. Set `SUPABASE_SERVICE_ROLE_KEY` server-side. Never prefix this key with NEXT_PUBLIC or commit it.
3. The six `ms_` tables have already been applied to General Project. Do **not** rerun `sql/schema.sql` there. It is provided for a fresh database.
4. Create an account through Supabase Auth, or choose an existing account without changing it. Run `node --env-file=.env.local scripts/bootstrap.mjs your-email@example.com` to grant the first chief membership. This inserts only into ms_members.
5. `npm run dev`; production: `npm run build && npm start`.

The package retains the requested `"next": "^16.0.10"`; package-lock pins the tested resolution.

## Access and data

All application tables have RLS enabled and direct anon/authenticated grants revoked. The server validates the bearer token against Supabase Auth and checks active ms_members membership before using service-role access. No authorization is taken from editable user metadata. Existing prospects and workspace_members are untouched. The informational advisor notices for RLS without policies are intentional: clients cannot directly access these server-only tables.

Admin creation is chief-only. SMTP profiles are shared. SMS uses the server-side sendSms function. SMTP passwords are request-only. Each send reauthenticates the acting admin and makes one external call per recipient. A request key prevents replay within one operation. Interrupted or ambiguous deliveries must be reviewed before resending; provider acceptance is not proof of inbox delivery. Previous message bodies remain in immutable versions.

## SMS provider

SMS calls the existing `sendSms(phone, message)` function directly. `SMS_RUNNER_URL` and `SMS_RUNNER_TOKEN` retain their existing provider URL/API-key meaning. No SMS connection record is selected, queried or required. New SMS versions store `connection_id: null`; old SMS versions also send without looking up their historical connection. Email continues to use saved SMTP profiles.

Password confirmation creates a separate, nonpersistent session and cleans it up with `scope: 'local'`. It never globally signs out the user. Expired/revoked browser sessions return to login, and explicit logout uses local scope with visible error handling. After updating from the previous global-signout version, log in again once to replace any already-revoked session. No database migration is required.

## Current implementation limits

- Sending is a sequential, foreground operation. Keep the browser open. Durable background processing is not implemented.
- Drafts are saved explicitly; autosave is not implemented.
- Excel imports use the first worksheet. Column mapping is supported; the applied summary follows import, rather than a full dry-run diff.
- Attachments are limited to 5 MB total and saved with message versions in Postgres. Use object storage for larger production workloads.
- Recipient creation/import is available in Recipients. In-composer add/import, test-send shortcut, segment/encoding calculation remain follow-up work.
- Profile changes support email and password. Name editing and forgot-password UI remain follow-up work.
- Authenticated visual QA and live provider sends require configured server secrets, a chief account and SMTP/provider credentials. No live messages were sent during development.

## Verification

`npm test`, `npm run typecheck`, `npm run build`. Recipient tests cover split matches, duplicate phone/new email, filling empty fields, missing contacts and normalization.
