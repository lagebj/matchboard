package enrollment

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strings"
)

const maxEnrollmentBodyBytes = 16 * 1024

var connectionIDPattern = regexp.MustCompile(`^aic_[A-Za-z0-9_-]{8,128}$`)

var allowedProviders = map[string]struct{}{
	"openai":        {},
	"anthropic":     {},
	"google_gemini": {},
	"mistral":       {},
	"ollama_cloud":  {},
}

type enrollRequest struct {
	ConnectionID string `json:"connectionId"`
	Provider     string `json:"provider"`
	Credential   string `json:"credential"`
}

type enrollResponse struct {
	ConnectionID string `json:"connectionId"`
	Status       string `json:"status"`
}

func decodeEnrollmentRequest(
	w http.ResponseWriter,
	r *http.Request,
) (*enrollRequest, error) {
	contentType := r.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "application/json") {
		return nil, errors.New("invalid content type")
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxEnrollmentBodyBytes)

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	var request enrollRequest

	if err := decoder.Decode(&request); err != nil {
		return nil, errors.New("invalid request")
	}

	// Reject a second JSON value or trailing JSON object.
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return nil, errors.New("invalid request")
	}

	request.ConnectionID = strings.TrimSpace(request.ConnectionID)
	request.Provider = strings.ToLower(strings.TrimSpace(request.Provider))

	if !connectionIDPattern.MatchString(request.ConnectionID) {
		return nil, errors.New("invalid connection id")
	}

	if _, ok := allowedProviders[request.Provider]; !ok {
		return nil, errors.New("unsupported provider")
	}

	if request.Credential == "" {
		return nil, errors.New("credential required")
	}

	if len(request.Credential) > 8192 {
		return nil, errors.New("credential too large")
	}

	return &request, nil
}

func enrollmentRequestMatchesClaims(
	request *enrollRequest,
	claims *enrollmentTokenClaims,
) bool {
	return request.ConnectionID == claims.ConnectionID &&
		request.Provider == claims.Provider
}
