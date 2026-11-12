# Backend

## Runtime

The backend requires Node.js 20 or newer. The production container uses Node.js 22; keep local and deployment runtimes aligned.

## Migration to organizations and member permissions

The multi-tenant migration is incremental and runs in a transaction. Before applying it to any database, take a verified backup and test it against a recent copy of that database. The migration creates one organization per existing user and assigns existing financial records through their creator or existing relationships. If any record cannot be assigned safely, the migration aborts and rolls back instead of guessing.

Set the database connection variables and apply migrations in order:

```powershell
npm run migrate:tenant
npm run migrate:registration-profile
npm run migrate:subscription
npm run migrate:account-security
```

These commands must run after a verified backup and a successful rehearsal on a recent copy of production, and before routing traffic to a backend version that requires the new columns. Migration `004_account_security` adds account roles, email verification, one-time auth tokens, login rate limits, access levels, and organization audit history; it marks existing active accounts as verified and removes the duplicated user-level plan field after the subscription migration has copied the source of truth to `Organizacoes`. The registration migration retains existing accounts and leaves newly added profile fields empty for existing users. Do not use `schema.sql` to upgrade an existing database; it is for initializing an empty database only.

Organization owners can invite members from **Configurações → Dependentes / Subcontas**. The invitation link is a one-time bearer credential, expires after 72 hours, and is shown only when created. Share it through a secure channel. The invited member creates a password and supplies their personal registration details through the link, then must verify their e-mail before signing in. The invitation link itself is not emailed automatically.

The current permission model shares cloud data within an organization. Paid accounts use the `manager`, `user`, and `reader` access levels; the owner retains organization management rights, while managers can administer users only during a current paid subscription. User and reader permissions are checked per implemented module. Free accounts use browser-local storage and are denied cloud data API access. A paid plan enables cloud writes only when `Organizacoes.assinatura_status` is `active` and `assinatura_expira_em` is in the future; after expiry or cancellation, existing cloud data is read-only. Existing `pro` plans are marked expired by migration `003_subscription_lifecycle` because no verified expiration date is available.

The master console is available at `/admin.html`; it lists organizations and users, lets master accounts change user status and subscription entitlements, and displays the subscription/user audit history. Master privileges are separate from paid subscription access: master status alone does not grant cloud access or bypass subscription checks on data APIs. Its APIs require a master-authenticated session; hiding the page is not the security boundary. The last active owner of an organization cannot be disabled.

To grant the master role to exactly one existing account, set `MASTER_ACCOUNT_EMAIL` to its verified email in the deployment environment and run `npm run promote:master` against the intended database after the security migration. The script fails without making changes if the email matches zero or multiple accounts. Do not grant the role to a subscription customer account unless that is explicitly intended.

Email verification, password recovery, and password changes require SMTP configuration. Supply `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, and `PUBLIC_APP_URL` through Secret Manager or the deployment environment. Keep real credentials out of source control. Verification links expire after 24 hours; password reset links expire after 30 minutes. Only token hashes are persisted. Sessions use an `HttpOnly`, `SameSite=Lax` cookie; `COOKIE_SECURE` must be true in production. Firebase Hosting proxies `/api/**` to the Cloud Run service, so confirm the `serviceId` and region in `firebase.json` match the deployed service before publishing.

Stripe integration is deferred: billing routes are not mounted, and the frontend does not offer checkout or subscription management. Do not configure or advertise Stripe flows as available. Master users can still manually change an entitlement through `PUT /api/admin/organizations/:organizationId/subscription`; this changes access state, not an external payment. To return an organization to free, send `{"plan":"basic","status":"free","expiresAt":null}`. A canceled or expired PRO plan retains read-only access to its cloud data. The frontend refreshes subscription state from the API, but the backend remains authoritative for every cloud operation. Export permissions are stored and managed, but are not attached to any export endpoint until such endpoints exist.

Login is rate-limited per email/IP pair and per IP. Repeated failed attempts are temporarily blocked; password reset and verification-link requests are also rate-limited by IP. Security-sensitive organization actions are recorded in `Auditoria_Organizacao`.

The local free tier currently supports the implemented Financeiro data paths (transactions, categories, groups, accounts, payment methods, and investments) on the same browser and device. Local data is namespaced by organization and is not automatically transferred when upgrading. Browser local storage is not encrypted and can be removed by the user or browser; it must not be treated as a cloud backup. Other catalog products shown as “Em breve” do not yet have operational backend routines.

New registrations require the representative's validated CPF, birth date, Brazilian phone, and full address. Business registrations additionally require a validated CNPJ, legal name, and trade name. Invitation acceptance collects the same personal details for each member. Do not log these values or include them in authentication responses.
