type SecurityEventCategory =
  | "auth"
  | "access"
  | "mutation"
  | "data_integrity"
  | "policy"
  | "session";

type SecurityEventAction =
  | "login_success"
  | "login_failure"
  | "access_denied"
  | "access_granted"
  | "finalization"
  | "unfinalization"
  | "manual_override"
  | "draft_clear"
  | "draft_regeneration"
  | "report_complete"
  | "report_reopen"
  | "match_cancel"
  | "match_reopen"
  | "match_delete"
  | "player_remove"
  | "player_restore"
  | "event_squad_confirm"
  | "event_squad_unconfirm"
  | "data_export"
  | "policy_evaluation"
  | "session_revoked"
  | "organisation_create"
  | "organisation_invitation_create"
  | "organisation_invitation_accept"
  | "organisation_invitation_revoke"
  | "organisation_membership_update"
  | "organisation_team_access_add"
  | "organisation_team_access_add"
  | "organisation_team_access_remove"
  | "machine_principal_create"
  | "machine_principal_revoke"
  | "machine_principal_reactivate"
  | "machine_principal_secret_rotate"
  | "machine_token_issued"
  | "machine_token_auth_failure"
  | "notification_sent"
  | "notification_failed";

interface SecurityEvent {
  category: SecurityEventCategory;
  action: SecurityEventAction;
  actor?: string;
  tenant?: string;
  resource?: string;
  resourceId?: string;
  result: "success" | "failure" | "denied";
  reason?: string;
  metadata?: Record<string, unknown>;
}

function formatSecurityEvent(event: SecurityEvent): string {
  const parts = [
    `[security:${event.category}]`,
    event.action,
    `result=${event.result}`,
  ];

  if (event.actor) parts.push(`actor=${event.actor}`);
  if (event.tenant) parts.push(`tenant=${event.tenant}`);
  if (event.resource) parts.push(`resource=${event.resource}`);
  if (event.resourceId) parts.push(`id=${event.resourceId}`);
  if (event.reason) parts.push(`reason=${event.reason}`);

  return parts.join(" ");
}

export function logSecurityEvent(event: SecurityEvent): void {
  const formatted = formatSecurityEvent(event);

  if (event.result === "denied" || event.result === "failure") {
    console.warn(formatted);
  } else {
    console.info(formatted);
  }
}

export function logAuthSuccess(actor: string, resource?: string): void {
  logSecurityEvent({
    category: "auth",
    action: "login_success",
    actor,
    result: "success",
    resource: resource ?? "session",
  });
}

export function logAuthFailure(actor: string, reason: string): void {
  logSecurityEvent({
    category: "auth",
    action: "login_failure",
    actor,
    result: "failure",
    reason,
  });
}

export function logAccessDenied(actor: string, resource: string, reason: string): void {
  logSecurityEvent({
    category: "access",
    action: "access_denied",
    actor,
    result: "denied",
    resource,
    reason,
  });
}

export function logMutationEvent(
  action: SecurityEventAction,
  actor: string,
  resource: string,
  resourceId: string,
  result: "success" | "failure",
  reason?: string,
): void {
  logSecurityEvent({
    category: "mutation",
    action,
    actor,
    resource,
    resourceId,
    result,
    reason,
  });
}

export function logFinalization(actor: string, resource: string, resourceId: string, result: "success" | "failure", reason?: string): void {
  logSecurityEvent({
    category: "mutation",
    action: "finalization",
    actor,
    resource,
    resourceId,
    result,
    reason,
  });
}

export function logManualOverride(actor: string, resource: string, resourceId: string, reason: string): void {
  logSecurityEvent({
    category: "mutation",
    action: "manual_override",
    actor,
    resource,
    resourceId,
    result: "success",
    reason,
  });
}

export function logDataExport(actor: string, format: string, visibility: string, result: "success" | "failure"): void {
  logSecurityEvent({
    category: "data_integrity",
    action: "data_export",
    actor,
    resource: "season_export",
    result,
    metadata: { format, visibility },
  });
}

export function logReportComplete(actor: string, reportId: string, result: "success" | "failure", reason?: string): void {
  logSecurityEvent({
    category: "mutation",
    action: "report_complete",
    actor,
    resource: "post_match_report",
    resourceId: reportId,
    result,
    reason,
  });
}

export function logReportReopen(actor: string, reportId: string, result: "success" | "failure", reason?: string): void {
  logSecurityEvent({
    category: "mutation",
    action: "report_reopen",
    actor,
    resource: "post_match_report",
    resourceId: reportId,
    result,
    reason,
  });
}

export function logMatchCancel(actor: string, matchId: string, result: "success" | "failure", reason?: string): void {
  logSecurityEvent({
    category: "mutation",
    action: "match_cancel",
    actor,
    resource: "match",
    resourceId: matchId,
    result,
    reason,
  });
}

export function logMatchReopen(actor: string, matchId: string, result: "success" | "failure"): void {
  logSecurityEvent({
    category: "mutation",
    action: "match_reopen",
    actor,
    resource: "match",
    resourceId: matchId,
    result,
  });
}

export function logMatchDelete(actor: string, matchId: string, result: "success" | "failure"): void {
  logSecurityEvent({
    category: "mutation",
    action: "match_delete",
    actor,
    resource: "match",
    resourceId: matchId,
    result,
  });
}

export function logPlayerRemove(actor: string, playerId: string, result: "success" | "failure", reason?: string): void {
  logSecurityEvent({
    category: "mutation",
    action: "player_remove",
    actor,
    resource: "player",
    resourceId: playerId,
    result,
    reason,
  });
}

export function logPlayerRestore(actor: string, playerId: string, result: "success" | "failure"): void {
  logSecurityEvent({
    category: "mutation",
    action: "player_restore",
    actor,
    resource: "player",
    resourceId: playerId,
    result,
  });
}

export function logEventSquadConfirm(actor: string, eventId: string, result: "success" | "failure", reason?: string): void {
  logSecurityEvent({
    category: "mutation",
    action: "event_squad_confirm",
    actor,
    resource: "event",
    resourceId: eventId,
    result,
    reason,
  });
}

export function logEventSquadUnconfirm(actor: string, eventId: string, result: "success" | "failure"): void {
  logSecurityEvent({
    category: "mutation",
    action: "event_squad_unconfirm",
    actor,
    resource: "event",
    resourceId: eventId,
    result,
  });
}

export function logOrganisationCreate(actor: string, organisationId: string, result: "success" | "failure"): void {
  logSecurityEvent({
    category: "mutation",
    action: "organisation_create",
    actor,
    resource: "organisation",
    resourceId: organisationId,
    result,
  });
}

export function logOrganisationInvitationCreate(actor: string, organisationId: string, result: "success" | "failure", reason?: string): void {
  logSecurityEvent({
    category: "mutation",
    action: "organisation_invitation_create",
    actor,
    resource: "organisation",
    resourceId: organisationId,
    result,
    reason,
  });
}

export function logOrganisationInvitationAccept(actor: string, organisationId: string, result: "success" | "failure"): void {
  logSecurityEvent({
    category: "mutation",
    action: "organisation_invitation_accept",
    actor,
    resource: "organisation",
    resourceId: organisationId,
    result,
  });
}

export function logOrganisationInvitationRevoke(actor: string, organisationId: string, result: "success" | "failure", reason?: string): void {
  logSecurityEvent({
    category: "mutation",
    action: "organisation_invitation_revoke",
    actor,
    resource: "organisation",
    resourceId: organisationId,
    result,
    reason,
  });
}

export function logOrganisationMembershipUpdate(actor: string, organisationId: string, result: "success" | "failure", reason?: string): void {
  logSecurityEvent({
    category: "mutation",
    action: "organisation_membership_update",
    actor,
    resource: "organisation",
    resourceId: organisationId,
    result,
    reason,
  });
}

export function logOrganisationTeamAccessAdd(actor: string, organisationId: string, result: "success" | "failure"): void {
  logSecurityEvent({
    category: "mutation",
    action: "organisation_team_access_add",
    actor,
    resource: "organisation",
    resourceId: organisationId,
    result,
  });
}

export function logOrganisationTeamAccessRemove(actor: string, organisationId: string, result: "success" | "failure"): void {
  logSecurityEvent({
    category: "mutation",
    action: "organisation_team_access_remove",
    actor,
    resource: "organisation",
    resourceId: organisationId,
    result,
  });
}
export function logMachinePrincipalCreate(actor: string, principalId: string, result: "success" | "failure" = "success"): void {
  logSecurityEvent({
    category: "mutation",
    action: "machine_principal_create",
    actor,
    resource: "machine_principal",
    resourceId: principalId,
    result,
  });
}

export function logMachinePrincipalRevoke(actor: string, principalId: string, result: "success" | "failure" = "success"): void {
  logSecurityEvent({
    category: "mutation",
    action: "machine_principal_revoke",
    actor,
    resource: "machine_principal",
    resourceId: principalId,
    result,
  });
}

export function logMachinePrincipalReactivate(actor: string, principalId: string, result: "success" | "failure" = "success"): void {
  logSecurityEvent({
    category: "mutation",
    action: "machine_principal_reactivate",
    actor,
    resource: "machine_principal",
    resourceId: principalId,
    result,
  });
}

export function logMachinePrincipalSecretRotate(actor: string, principalId: string, result: "success" | "failure" = "success"): void {
  logSecurityEvent({
    category: "mutation",
    action: "machine_principal_secret_rotate",
    actor,
    resource: "machine_principal",
    resourceId: principalId,
    result,
  });
}

export function logMachineTokenIssued(actor: string, detail: string, result: "success" | "failure" = "success"): void {
  logSecurityEvent({
    category: "auth",
    action: "machine_token_issued",
    actor,
    resource: "machine_token",
    resourceId: detail,
    result,
  });
}

export function logMachineTokenAuthFailure(actor: string, reason: string): void {
  logSecurityEvent({
    category: "auth",
    action: "machine_token_auth_failure",
    actor,
    resource: "machine_token",
    resourceId: reason,
    result: "failure",
  });
}

export function logNotificationSent(actor: string, notificationId: string, result: "success" | "failure", reason?: string): void {
  logSecurityEvent({
    category: "mutation",
    action: "notification_sent",
    actor,
    resource: "notification_outbox",
    resourceId: notificationId,
    result,
    reason,
  });
}

export function logNotificationFailed(actor: string, notificationId: string, reason?: string): void {
  logSecurityEvent({
    category: "mutation",
    action: "notification_failed",
    actor,
    resource: "notification_outbox",
    resourceId: notificationId,
    result: "failure",
    reason,
  });
}
