# Production Runbook

This runbook covers production operations for StackForge.
Use it as an executable checklist for deployment, security, and continuity.

## 1. Secrets Preparation

Goal: never commit secrets to the repository or shared environment files.

Checklist:

- Store secrets in a Secret Manager (AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, Vault).
- Inject secrets at runtime (container/orchestrator), not through committed files.
- Define strong secrets for:
  - `JWT_ACCESS_SECRET`
  - `JWT_ACCESS_SECRETS`
  - `POSTGRES_PASSWORD`
- Ensure periodic secret rotation (recommended window: 30 to 90 days).
- Limit access with least-privilege principles (runtime and authorized operators only).

Minimum validation:

- No secret values in `docker-compose.production.yml`.
- No sensitive values in startup logs.
- `CORS_ALLOWED_ORIGINS` points only to real frontend domains.

## 2. TLS and Reverse Proxy

Goal: expose the API only via HTTPS in production.

Checklist:

- API behind a reverse proxy (Nginx, Traefik, Caddy, ALB/Ingress).
- Valid TLS certificates with automatic renewal.
- Redirect HTTP to HTTPS at the edge.
- Forward proper headers to the app (e.g. `X-Forwarded-Proto`).
- Enable HSTS at the proxy (once the main domain is stable).

Minimum validation:

- Public endpoint responds over HTTPS.
- Sensitive cookies are sent with `Secure` in production.
- No admin endpoint is exposed without authentication/private network.

## 3. Database: Backup and Restore

Goal: guarantee acceptable RPO/RTO for operational failures.

Checklist:

- Define automatic backups (daily at minimum).
- Define backup retention (e.g. 7, 14, 30 days according to compliance).
- Encrypt backups at rest and in transit.
- Test restore periodically (at least monthly).
- Version control restore scripts/procedures.

PostgreSQL backup example (reference):

```bash
pg_dump "$DATABASE_URL" --format=custom --file=backup-$(date +%F).dump
```

PostgreSQL restore example (reference):

```bash
pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" backup-YYYY-MM-DD.dump
```

Minimum validation:

- Backup generated successfully and stored outside the main host.
- Restore executed in a staging environment with validated integrity.

## 4. JWT Key Rotation

Goal: rotate keys without immediately dropping all sessions.

Recommended strategy:

1. Add a new key in `JWT_ACCESS_SECRETS` with a new `kid`.
2. Switch `JWT_ACCESS_ACTIVE_KID` to the new key.
3. Keep the previous key for a transition period (until old tokens naturally expire).
4. Remove the old key after a safe window.

Checklist:

- Planned rotation with a maintenance window.
- Monitor 401/403 errors during transition.
- Documented rollback plan (revert `JWT_ACCESS_ACTIVE_KID`).

Minimum validation:

- New tokens signed with the new `kid`.
- Old tokens still valid during the transition window.

## 5. Safe Deployment (Step-by-step)

Recommended sequence:

1. Confirm quality:

```bash
pnpm lint
pnpm test
```

2. Confirm local recovery stack:

```bash
pnpm prod:recovery:test
```

3. Deploy to the target environment with real variables via secret manager.
4. Verify health:

```bash
pnpm prod:smoke
pnpm prod:smoke:auth
```

5. Check logs and metrics for 10 to 15 minutes after deployment.

## 6. Monitoring and Alerts

Goal: detect downtime and anomalous behavior early.

Checklist:

- Monitor:
  - availability (`/health/liveness`)
  - readiness (`/health/readiness`)
  - 5xx error rate
  - p95 latency
  - unusual 401/403 volume
- Alerts with escalation (email/chat/pager).
- Minimum dashboard with 24h and 7d windows.

Minimum validation:

- Alert triggers during simulated downtime.
- Team knows who responds to alerts and within what time.

## 7. Incident Response (Quick Guide)

Scenario: API unavailable or elevated 5xx errors.

Response checklist:

1. Confirm container/process status.
2. Check API and database logs.
3. Validate database connectivity and credentials.
4. Executar smoke (`prod:smoke` e `prod:smoke:auth`).
5. If needed, rollback to the previous stable version.
6. Record a post-mortem with root cause and preventive action.

## 8. Operational Access Policy

Checklist:

- Production access through individual accounts (no shared users).
- MFA required for administrative access.
- Access auditing enabled.
- Role separation: development, operations, and audit.

## 9. Production Readiness Checklist

Check all items before go-live:

- [ ] Secrets in secret manager (no secrets in repo)
- [ ] TLS active with automatic renewal
- [ ] Daily backup active and restore tested
- [ ] JWT rotation defined and tested
- [ ] Monitoring and alerts active
- [ ] Recovery test executed successfully
- [ ] Rollback procedure documented
- [ ] Team aligned with the runbook and on-call owners
