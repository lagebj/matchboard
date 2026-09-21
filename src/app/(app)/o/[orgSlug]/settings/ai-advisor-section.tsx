"use client";

import { useState } from "react";
import type { AiAdvisorSettingsSummary } from "./ai-advisor-actions";
import { setAiMasterEnabledAction, setAiCapabilityEnabledAction } from "./ai-advisor-actions";

type ProviderModel = { id: string; displayName?: string; description?: string };

const CAPABILITY_LABELS: { key: keyof AiAdvisorSettingsSummary["capabilities"]; title: string; description: string }[] = [
  { key: "ROUND_REVIEW", title: "Round review", description: "Review finalised allocation and opportunity patterns." },
  { key: "LINEUP_REVIEW", title: "Line-up and rotation review", description: "Review a complete plan without changing it." },
  { key: "MATCH_PREP", title: "Match preparation", description: "Surface preparation points before kick-off." },
  { key: "POST_MATCH_REVIEW", title: "Post-match review", description: "Connect recorded match facts and evidence." },
  { key: "WEEKLY_TEAM_REVIEW", title: "Weekly team review", description: "Review completed-week opportunity patterns." },
];

/**
 * Organisation Settings "AI Advisor" section (04_ORG_CONNECTION_FLOW.md / 08_UI_UX_SPEC.md).
 * Owner-only — the parent only renders this component when `ctx.role === "OWNER"`.
 *
 * The connect wizard below implements the browser-direct credential submission
 * (02_SECURITY_BOUNDARY.md "Enrollment path"): the credential is held only in local component
 * state while the user is entering/submitting it, is cleared immediately on both success and
 * failure, and is sent directly to the enrollment URL returned by `/api/ai/connections/bootstrap`
 * — never to a Matchboard API route. Replace-key and disconnect are intentionally not built yet
 * (tracked separately, alongside their backing routes) — the golden reference's "Replace API
 * key"/"Disconnect" affordances are deferred until that backend lands.
 */
export function AiAdvisorSection({ orgSlug, initial }: { orgSlug: string; initial: AiAdvisorSettingsSummary }) {
  const [summary, setSummary] = useState(initial);

  if (!summary.activeConnection || summary.activeConnection.status !== "READY") {
    return (
      <AiAdvisorConnectFlow
        summary={summary}
        onConnectionReady={(activeConnection) => setSummary((s) => ({ ...s, activeConnection }))}
      />
    );
  }

  return (
    <AiAdvisorReadyPanel
      orgSlug={orgSlug}
      summary={summary}
      onModelChanged={(model) =>
        setSummary((s) => (s.activeConnection ? { ...s, activeConnection: { ...s.activeConnection, model } } : s))
      }
      onMasterToggled={(enabled) => setSummary((s) => ({ ...s, enabled }))}
      onCapabilityToggled={(key, enabled) =>
        setSummary((s) => ({ ...s, capabilities: { ...s.capabilities, [key]: enabled } }))
      }
    />
  );
}

function AiAdvisorConnectFlow({
  summary,
  onConnectionReady,
}: {
  summary: AiAdvisorSettingsSummary;
  onConnectionReady: (activeConnection: NonNullable<AiAdvisorSettingsSummary["activeConnection"]>) => void;
}) {
  const [provider, setProvider] = useState(summary.providerOptions[0]?.id ?? "openai");
  const [credential, setCredential] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConnectionId, setPendingConnectionId] = useState<string | null>(null);
  const [models, setModels] = useState<ProviderModel[] | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");

  const selectedProviderOption = summary.providerOptions.find((p) => p.id === provider);

  async function handleConnect() {
    setBusy(true);
    setError(null);
    const credentialToSubmit = credential;
    setCredential(""); // never held longer than needed to submit it

    try {
      const bootstrapResponse = await fetch("/api/ai/connections/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!bootstrapResponse.ok) {
        const body = await bootstrapResponse.json().catch(() => null);
        setError(body?.error ?? "Could not start the connection. Please try again.");
        return;
      }
      const { connectionId, enrollmentUrl, token } = await bootstrapResponse.json();

      const enrollResponse = await fetch(`${enrollmentUrl}/v1/connections`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, provider, credential: credentialToSubmit }),
      });
      if (!enrollResponse.ok) {
        setError("The provider rejected the credential. Please check it and try again.");
        return;
      }

      const completeResponse = await fetch("/api/ai/connections/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      const completeBody = await completeResponse.json().catch(() => null);
      if (!completeResponse.ok) {
        setError(completeBody?.error ?? "Could not validate the connection. Please try again.");
        return;
      }

      setPendingConnectionId(connectionId);
      setModels(completeBody.models ?? []);
      setSelectedModel(completeBody.models?.[0]?.id ?? "");
    } catch {
      setError("Something went wrong while connecting. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectModel() {
    if (!pendingConnectionId || !selectedModel) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/connections/select-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: pendingConnectionId, model: selectedModel }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "That model could not be used. Please choose another.");
        return;
      }
      onConnectionReady({
        id: pendingConnectionId,
        provider,
        providerLabel: selectedProviderOption?.label ?? provider,
        model: body.model,
        status: "READY",
      });
    } catch {
      setError("Something went wrong while selecting the model. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (pendingConnectionId && models) {
    return (
      <div className="rounded-md border border-[var(--border-soft)] p-4 space-y-3">
        <p className="text-sm font-medium">Connected. Choose a model to finish setup.</p>
        {models.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">The provider returned no usable models.</p>
        ) : (
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 py-2 text-sm"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName ?? m.id}
              </option>
            ))}
          </select>
        )}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button
          onClick={handleSelectModel}
          disabled={busy || !selectedModel}
          className="rounded-md bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
        >
          {busy ? "Finishing setup..." : "Use this model"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[var(--border-soft)] p-4 space-y-3">
      <div>
        <label className="text-xs font-medium text-[var(--text-muted)]">Provider</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as typeof provider)}
          className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 py-2 text-sm"
        >
          {summary.providerOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-[var(--text-muted)]">{selectedProviderOption?.credentialLabel ?? "API key"}</label>
        <input
          type="password"
          autoComplete="off"
          value={credential}
          onChange={(e) => setCredential(e.target.value)}
          className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <p className="text-xs text-[var(--text-muted)]">
        The API key is stored in Matchboard&apos;s separate credential-security boundary. Matchboard does not store it in the
        application database.
      </p>
      <button
        onClick={handleConnect}
        disabled={busy || !credential.trim()}
        className="rounded-md bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
      >
        {busy ? "Connecting..." : "Connect provider"}
      </button>
    </div>
  );
}

function AiAdvisorReadyPanel({
  orgSlug,
  summary,
  onModelChanged,
  onMasterToggled,
  onCapabilityToggled,
}: {
  orgSlug: string;
  summary: AiAdvisorSettingsSummary;
  onModelChanged: (model: string) => void;
  onMasterToggled: (enabled: boolean) => void;
  onCapabilityToggled: (key: keyof AiAdvisorSettingsSummary["capabilities"], enabled: boolean) => void;
}) {
  const connection = summary.activeConnection!;
  const [refreshing, setRefreshing] = useState(false);
  const [changingModel, setChangingModel] = useState(false);
  const [models, setModels] = useState<ProviderModel[] | null>(null);
  const [selectedModel, setSelectedModel] = useState(connection.model ?? "");
  const [error, setError] = useState<string | null>(null);
  const [masterBusy, setMasterBusy] = useState(false);

  async function handleRefreshModels() {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/connections/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: connection.id }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Could not refresh the model list.");
        return;
      }
      setModels(body.models ?? []);
      setChangingModel(true);
    } catch {
      setError("Could not refresh the model list.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleChangeModel() {
    if (!selectedModel) return;
    setError(null);
    try {
      const response = await fetch("/api/ai/connections/select-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: connection.id, model: selectedModel }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "That model could not be used.");
        return;
      }
      onModelChanged(body.model);
      setChangingModel(false);
    } catch {
      setError("Could not change the model.");
    }
  }

  async function handleMasterToggle() {
    setMasterBusy(true);
    setError(null);
    const result = await setAiMasterEnabledAction(orgSlug, !summary.enabled);
    if (!result.success) setError(result.error);
    else onMasterToggled(!summary.enabled);
    setMasterBusy(false);
  }

  async function handleCapabilityToggle(key: keyof AiAdvisorSettingsSummary["capabilities"]) {
    const next = !summary.capabilities[key];
    const result = await setAiCapabilityEnabledAction(orgSlug, key, next);
    if (result.success) onCapabilityToggled(key, next);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-[var(--border-soft)] p-4 space-y-3">
        <div>
          <p className="text-xs font-medium text-[var(--text-muted)]">Provider</p>
          <p className="text-sm font-semibold">{connection.providerLabel}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-[var(--text-muted)]">Model</p>
          <p className="text-sm">{connection.model}</p>
        </div>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        {changingModel && models && (
          <div className="space-y-2">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 py-2 text-sm"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName ?? m.id}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleChangeModel}
                className="rounded-md bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface-hover)]"
              >
                Use this model
              </button>
              <button
                onClick={() => setChangingModel(false)}
                className="rounded-md px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleRefreshModels}
            disabled={refreshing}
            className="rounded-md bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "Refresh models"}
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          The API key is stored in Matchboard&apos;s separate credential-security boundary. Matchboard does not store it in
          the application database.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Enable AI Advisor for this organisation</p>
          <p className="text-xs text-[var(--text-muted)]">Provider connection and AI enablement are separate choices.</p>
        </div>
        <ToggleSwitch checked={summary.enabled} disabled={masterBusy} onChange={handleMasterToggle} />
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">Capabilities</p>
        <div className="divide-y divide-[var(--border-soft)]">
          {CAPABILITY_LABELS.map(({ key, title, description }) => (
            <div key={key} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-[var(--text-muted)]">{description}</p>
              </div>
              <ToggleSwitch
                checked={summary.capabilities[key]}
                disabled={!summary.enabled}
                onChange={() => handleCapabilityToggle(key)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-7 w-12 rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-[var(--success)]" : "bg-[var(--surface-muted)]"
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}
