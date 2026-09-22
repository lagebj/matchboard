package runtime

import (
	"encoding/json"
	"net/http"
)

type healthResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
}

type credentialAccessResponse struct {
	ConnectionID string `json:"connectionId"`
	Credential   string `json:"credential"`
}

func Handle(w http.ResponseWriter, r *http.Request) {
	switch {
	case r.Method == http.MethodGet && r.URL.Path == "/health":
		writeJSON(w, http.StatusOK, healthResponse{
			Status:  "ok",
			Service: "matchboard-ai-runtime",
		})

	case r.Method == http.MethodPost &&
		r.URL.Path == "/v1/credentials/access":

		handleCredentialAccess(w, r)

	default:
		http.NotFound(w, r)
	}
}

func handleCredentialAccess(
	w http.ResponseWriter,
	r *http.Request,
) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")

	claims, err := verifyRuntimeToken(
		r.Header.Get("Authorization"),
	)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error": "unauthorized",
		})
		return
	}

	request, err := decodeCredentialAccessRequest(w, r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "invalid_request",
		})
		return
	}

	if !credentialAccessRequestMatchesClaims(
		request,
		claims,
	) {
		writeJSON(w, http.StatusForbidden, map[string]string{
			"error": "request_not_authorized",
		})
		return
	}

	credential, err := loadConnectionCredential(
		request.ConnectionID,
	)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{
			"error": "credential_access_failed",
		})
		return
	}

	defer clear(credential)

	writeJSON(
		w,
		http.StatusOK,
		credentialAccessResponse{
			ConnectionID: request.ConnectionID,
			Credential:   string(credential),
		},
	)
}

func writeJSON(
	w http.ResponseWriter,
	status int,
	value any,
) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")

	w.WriteHeader(status)

	_ = json.NewEncoder(w).Encode(value)
}
