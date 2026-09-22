package enrollment

import "net/http"

// allowedOrigins is a strict allowlist, not a wildcard: this endpoint accepts a tenant's AI
// provider credential directly from the browser, so reflecting an arbitrary Origin (or using
// "*") would let any third-party site read the enrollment response via a CORS-permitted fetch.
// Mirrors the app.matchboard.football / test.matchboard.football pairing already used for the
// live-match-realtime WebSocket origins in Matchboard's own CSP (src/lib/security/csp.ts).
var allowedOrigins = map[string]struct{}{
	"https://app.matchboard.football":  {},
	"https://test.matchboard.football": {},
}

func isAllowedOrigin(origin string) bool {
	_, ok := allowedOrigins[origin]
	return ok
}

// applyCORSHeaders sets the CORS response headers when the request's Origin is allowlisted, and
// reports whether it did. It must be called for both the OPTIONS preflight and the actual
// POST/GET response — browsers require the header on both.
func applyCORSHeaders(w http.ResponseWriter, r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if !isAllowedOrigin(origin) {
		return false
	}

	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Vary", "Origin")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Max-Age", "600")

	return true
}
