# Security: Incident Response and Backup Verification

## Incident response procedures

### Security event categories

Matchboard logs structured security events via `src/lib/security/audit-log.ts`. All security-relevant mutations and access events are categorized:

| Category | Events |
|----------|--------|
| auth | login_success, login_failure |
| access | access_denied, access_granted |
| mutation | finalization, unfinalization, manual_override, draft_clear, draft_regeneration, report_complete, report_reopen, match_cancel, match_reopen, match_delete, player_remove, player_restore, event_squad_confirm, event_squad_unconfirm |
| data_integrity | data_export |
| policy | policy_evaluation |
| session | session_revoked |

### Event structure

Each event includes:
- `category` — security domain
- `action` — specific event type
- `result` — success, failure, or denied
- `actor` — authenticated coach email
- `resource` — domain object type
- `resourceId` — specific object identifier
- `reason` — human-readable reason (for failures and denials)
- `metadata` — structured key-value pairs (format, visibility for exports)

### Response actions by event type

| Event | Response |
|-------|----------|
| Repeated login_failure | Review IP; consider temporary lockout if rate limit exceeded |
| access_denied | Verify user; if not in allowlist, no action needed; if coach, check role/tenant |
| finalization success | No action — expected operation |
| unfinalization success | Review reason; verify coach intent |
| manual_override with reason | Review override reason; verify policy compliance |
| draft_clear | Review what was cleared; verify intent |
| data_export | Log format and visibility; verify coach access |
| match_cancel, match_reopen | Review reason; verify authorized coach |
| player_remove, player_restore | Review reason; verify no unauthorized data access |

### Severity escalation

- **Informational** (success results): Logged at `info` level. No immediate action required.
- **Warning** (failure/denied results): Logged at `warn` level. Monitor for patterns.
- **Escalation trigger**: 5+ failed auth attempts from same actor in 10 minutes; 3+ access_denied events from same actor in 30 minutes.

## Audit log review

Audit logs are emitted via structured console output. In production (Vercel + Neon):

1. Vercel captures console output and makes it available in deployment logs
2. For persistent audit trails, configure a log drain to an external logging service
3. Review audit events regularly for unauthorized access patterns
4. Store audit logs separately from application logs for compliance

### Log retention

- Vercel deployment logs: 30 days (Vercel default)
- External log drain: configure per retention policy (recommended: 90 days minimum)
- Neon database audit: Neon provides query logs with configurable retention

## Backup verification

### Neon backup verification

Neon provides automatic backups with point-in-time recovery. Verify backup integrity:

1. **Daily verification**: Confirm Neon backup status via Neon dashboard or API
2. **Weekly restore test**: Create a temporary branch from backup; verify schema and sample data
3. **Monthly full restore test**: Restore to a test environment; verify application connectivity

### Verification checklist

- [ ] Neon project has continuous protection enabled
- [ ] Neon branch creation works from any point in time within retention window
- [ ] Test restore completes within acceptable RTO (target: < 30 minutes)
- [ ] Restored database passes application health checks
- [ ] All tables accessible and row counts match expected ranges
- [ ] Application connects to restored database without errors

### Data integrity checks

The application provides built-in integrity audit tools:

- `GET /api/admin/audit` — runs integrity audit checks
- `POST /api/admin/reconcile` — reconciles derived data from canonical sources
- `npm run security:check-sql` — static check for forbidden SQL methods
- `npm run validate` — includes security:check-sql in the validation pipeline

### Recovery procedures

1. **Data corruption**: Use `POST /api/admin/reconcile` to rebuild derived data from canonical sources
2. **Unauthorized mutation**: Use un-finalization to revert finalized selections; audit log shows actor
3. **Database failure**: Create new Neon branch from PITR; update DATABASE_URL; verify application health
4. **Secret exposure**: Rotate AUTH_SECRET and AUTH_GOOGLE_SECRET in Vercel; update local .env