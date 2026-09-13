"use client";

/**
 * Offline continuation shell client (ADR-0138 Bundle 7).
 *
 * Mounted for a live-match URL only when the network was genuinely unreachable and
 * `public/live-sw.js` served this generic shell as the offline navigation fallback — the
 * browser's address bar still shows the real match URL. Never rendered by a normal online
 * navigation (the real match page always answers first when reachable).
 *
 * Deliberately reads `window.location.pathname` in a post-mount effect rather than any
 * Next.js routing primitive (`useParams`, etc.) — this page's own route is `/offline-live`, a
 * fixed, generic path; the URL the browser is actually showing when this component runs is a
 * different match's real URL entirely. Rendering a fixed "detecting…" state during SSR and the
 * first client render (before the effect ever runs) keeps hydration consistent — the URL-
 * dependent branch only appears after mount, matching the standard safe pattern for this exact
 * "content depends on the real browser location, not the route this file lives at" scenario.
 */

import { useEffect, useState } from "react";
import { LiveMatchClient, type LiveMatchActions, type PreparedLiveMatchPackage } from "./live-match-client";
import { createLeagueActions, useLiveRealtime } from "./league-live-match-client";
import { createEventActions } from "./event-live-match-client";
import { getPreparedPackage, getLocalSession } from "@/lib/live-match/local/live-local-store";
import { extractLiveRouteSubjectId } from "@/lib/live-match/offline/live-route-match";

type ShellState =
  | { kind: "detecting" }
  | { kind: "not-a-live-route" }
  | { kind: "not-prepared" }
  | { kind: "ready"; subjectId: string; pkg: PreparedLiveMatchPackage };

export function OfflineLiveShellClient() {
  const [state, setState] = useState<ShellState>({ kind: "detecting" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const subjectId = extractLiveRouteSubjectId(window.location.pathname);
      if (!subjectId) {
        if (!cancelled) setState({ kind: "not-a-live-route" });
        return;
      }
      const pkg = await getPreparedPackage<PreparedLiveMatchPackage>(subjectId);
      if (cancelled) return;
      if (!pkg) {
        setState({ kind: "not-prepared" });
        return;
      }
      setState({ kind: "ready", subjectId, pkg });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "detecting") {
    return <ShellMessage title="Loading live reporting…" body="Checking this device for a prepared live session." />;
  }

  if (state.kind === "not-a-live-route") {
    // Only reachable if this page is somehow opened directly rather than served by the service
    // worker as a fallback for a real live-match URL — not a normal path, but a safe, honest
    // message rather than a blank or confusing screen.
    return (
      <ShellMessage
        title="Offline live reporting shell"
        body="This page is only used automatically when live reporting is opened while offline. It has nothing to show on its own."
      />
    );
  }

  if (state.kind === "not-prepared") {
    // ADR-0138 Bundle 7, work item 8 — an explicit, honest state for a match never opened on
    // this device while online, rather than a confusing blank screen or a generic browser
    // offline error.
    return (
      <ShellMessage
        title="This match hasn't been opened yet on this device"
        body="Live reporting can only continue offline once it has already been opened here while connected. Reconnect, open live reporting for this match, then it will keep working if the connection drops again."
      />
    );
  }

  return <ReconstructedLiveMatchClient subjectId={state.subjectId} pkg={state.pkg} />;
}

function ReconstructedLiveMatchClient({ subjectId, pkg }: { subjectId: string; pkg: PreparedLiveMatchPackage }) {
  // Called unconditionally regardless of subject type (rules-of-hooks) — its result is simply
  // unused for an Event package, which has its own actions factory with no realtime involvement
  // at all (ARR-0046).
  const realtime = useLiveRealtime(subjectId);
  const actions: LiveMatchActions =
    pkg.subjectType === "LEAGUE"
      ? withOfflinePackage(createLeagueActions(subjectId, realtime), pkg, subjectId)
      : withOfflinePackage(createEventActions(subjectId, pkg.eventId ?? ""), pkg, subjectId);

  return (
    <LiveMatchClient
      matchId={subjectId}
      teamName={pkg.teamName}
      opponentName={pkg.opponentName}
      contextLabel={pkg.contextLabel}
      periodConfig={pkg.periodConfig}
      actions={actions}
      isHome={pkg.isHome}
      markOwnTeam={pkg.markOwnTeam}
      subjectType={pkg.subjectType}
      eventId={pkg.eventId}
    />
  );
}

/** Overrides only `getPreMatchPackage` — every other action (recordEvent, startSession,
 * endSession, heartbeat, reportUrl) is the exact real implementation, which naturally fails safe
 * while offline (a normal fetch failure, handled by the existing outbox machinery — ADR-0138
 * Bundle 6) and naturally starts working again the moment the network returns, with no separate
 * "offline mode" code path to keep in sync. `activeSession` is read from this device's own
 * `LocalSession` record (not the prepared package, which never carries it) so an
 * already-in-progress session correctly resumes as active rather than showing "Start live
 * reporting" again. */
function withOfflinePackage(actions: LiveMatchActions, pkg: PreparedLiveMatchPackage, subjectId: string): LiveMatchActions {
  return {
    ...actions,
    getPreMatchPackage: async () => {
      const localSession = await getLocalSession(subjectId);
      return {
        success: true,
        data: {
          squad: pkg.squad,
          activeSession: localSession ? { id: localSession.id, coachId: localSession.coachId, startedAt: localSession.startedAt } : null,
        },
      };
    },
  };
}

function ShellMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="touchline flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--tl-c-canvas)] p-6 text-center">
      <h1 className="text-[20px] font-[650] text-[var(--foreground)]">{title}</h1>
      <p className="max-w-sm text-[14px] text-[var(--text-soft)]">{body}</p>
    </div>
  );
}
