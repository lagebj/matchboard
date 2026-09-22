package enrollment

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestApplyCORSHeaders_AllowedOrigin(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/v1/connections", nil)
	req.Header.Set("Origin", "https://app.matchboard.football")

	w := httptest.NewRecorder()

	if !applyCORSHeaders(w, req) {
		t.Fatal("expected allowlisted origin to be accepted")
	}

	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "https://app.matchboard.football" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want the reflected allowlisted origin", got)
	}

	if got := w.Header().Get("Access-Control-Allow-Methods"); got != "POST, OPTIONS" {
		t.Fatalf("Access-Control-Allow-Methods = %q", got)
	}

	if got := w.Header().Get("Access-Control-Allow-Headers"); got != "Content-Type, Authorization" {
		t.Fatalf("Access-Control-Allow-Headers = %q", got)
	}
}

func TestApplyCORSHeaders_TestSlotOriginAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/v1/connections", nil)
	req.Header.Set("Origin", "https://test.matchboard.football")

	w := httptest.NewRecorder()

	if !applyCORSHeaders(w, req) {
		t.Fatal("expected the test-slot origin to be allowlisted")
	}
}

func TestApplyCORSHeaders_RejectsUnknownOrigin(t *testing.T) {
	// A strict allowlist, not a reflect-anything policy: this endpoint accepts a tenant's raw AI
	// provider credential, so an arbitrary third-party origin must never be granted CORS access.
	req := httptest.NewRequest(http.MethodPost, "/v1/connections", nil)
	req.Header.Set("Origin", "https://evil.example.com")

	w := httptest.NewRecorder()

	if applyCORSHeaders(w, req) {
		t.Fatal("expected an unknown origin to be rejected")
	}

	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want empty for a rejected origin", got)
	}
}

func TestApplyCORSHeaders_NoOriginHeader(t *testing.T) {
	// Same-origin/non-browser requests (e.g. health checks) send no Origin header at all.
	req := httptest.NewRequest(http.MethodGet, "/health", nil)

	w := httptest.NewRecorder()

	if applyCORSHeaders(w, req) {
		t.Fatal("expected a request with no Origin header to be treated as not allowlisted")
	}
}

func TestHandle_PreflightOptions(t *testing.T) {
	req := httptest.NewRequest(http.MethodOptions, "/v1/connections", nil)
	req.Header.Set("Origin", "https://app.matchboard.football")
	req.Header.Set("Access-Control-Request-Method", "POST")

	w := httptest.NewRecorder()

	Handle(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusNoContent)
	}

	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "https://app.matchboard.football" {
		t.Fatalf("Access-Control-Allow-Origin = %q", got)
	}
}

func TestHandle_PreflightFromUnknownOrigin(t *testing.T) {
	req := httptest.NewRequest(http.MethodOptions, "/v1/connections", nil)
	req.Header.Set("Origin", "https://evil.example.com")

	w := httptest.NewRecorder()

	Handle(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("status = %d, want %d (still responds, just without CORS headers, matching fetch's own preflight-fail behavior)", resp.StatusCode, http.StatusNoContent)
	}

	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want empty", got)
	}
}

func TestAllowedProviders_MatchesMatchboardWireIDs(t *testing.T) {
	// Must stay in lockstep with Matchboard's AI_PROVIDER_WIRE_IDS
	// (src/lib/ai/provider-registry.ts) — a provider missing here is silently rejected as
	// "unsupported_provider" during enrollment even though the app offers it in the UI.
	want := []string{"openai", "anthropic", "google_gemini", "mistral", "ollama_cloud"}

	if len(allowedProviders) != len(want) {
		t.Fatalf("allowedProviders has %d entries, want %d", len(allowedProviders), len(want))
	}

	for _, provider := range want {
		if _, ok := allowedProviders[provider]; !ok {
			t.Errorf("allowedProviders is missing %q", provider)
		}
	}
}
