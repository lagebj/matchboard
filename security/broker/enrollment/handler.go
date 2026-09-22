package enrollment

import (
	"encoding/json"
	"errors"
	"net/http"
)

type healthResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
}

func Handle(
	w http.ResponseWriter,
	r *http.Request,
) {
	applyCORSHeaders(w, r)

	switch {
	case r.Method == http.MethodOptions &&
		r.URL.Path == "/v1/connections":

		// The enrollment credential submission is a browser-direct POST (ADR-0148), so browsers
		// send a CORS preflight first. Reply 204 with no body; applyCORSHeaders above already
		// set the Access-Control-* headers when the Origin is allowlisted, otherwise this
		// correctly fails the browser's preflight check.
		w.WriteHeader(http.StatusNoContent)

	case r.Method == http.MethodGet &&
		r.URL.Path == "/health":

		writeJSON(
			w,
			http.StatusOK,
			healthResponse{
				Status:  "ok",
				Service: "matchboard-ai-enrollment",
			},
		)

	case r.Method == http.MethodPost &&
		r.URL.Path == "/v1/connections":

		w.Header().Set(
			"Cache-Control",
			"no-store",
		)

		claims, err := verifyEnrollmentToken(
			r.Header.Get("Authorization"),
		)
		if err != nil {
			writeJSON(
				w,
				http.StatusUnauthorized,
				map[string]string{
					"error": "unauthorized",
				},
			)
			return
		}

		request, err := decodeEnrollmentRequest(
			w,
			r,
		)
		if err != nil {
			writeJSON(
				w,
				http.StatusBadRequest,
				map[string]string{
					"error": "invalid_request",
				},
			)
			return
		}

		if !enrollmentRequestMatchesClaims(
			request,
			claims,
		) {
			writeJSON(
				w,
				http.StatusForbidden,
				map[string]string{
					"error": "request_not_authorized",
				},
			)
			return
		}

		if err := storeEnrollmentCredential(
			request,
		); err != nil {

			if errors.Is(
				err,
				errConnectionAlreadyExists,
			) {
				writeJSON(
					w,
					http.StatusConflict,
					map[string]string{
						"error": "connection_already_exists",
					},
				)
				return
			}

			writeJSON(
				w,
				http.StatusBadGateway,
				map[string]string{
					"error": "credential_storage_failed",
				},
			)
			return
		}

		writeJSON(
			w,
			http.StatusCreated,
			enrollResponse{
				ConnectionID: request.ConnectionID,
				Status:       "connected",
			},
		)

	default:
		http.NotFound(w, r)
	}
}

func writeJSON(
	w http.ResponseWriter,
	status int,
	value any,
) {
	w.Header().Set(
		"Content-Type",
		"application/json",
	)

	w.WriteHeader(status)

	_ = json.NewEncoder(w).Encode(value)
}
