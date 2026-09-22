package runtime

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strings"
)

const maxCredentialAccessBodyBytes = 4 * 1024

var connectionIDPattern = regexp.MustCompile(
	`^aic_[A-Za-z0-9_-]{8,128}$`,
)

type credentialAccessRequest struct {
	ConnectionID string `json:"connectionId"`
}

func decodeCredentialAccessRequest(
	w http.ResponseWriter,
	r *http.Request,
) (*credentialAccessRequest, error) {
	contentType := r.Header.Get("Content-Type")

	if !strings.HasPrefix(
		contentType,
		"application/json",
	) {
		return nil, errors.New(
			"invalid content type",
		)
	}

	r.Body = http.MaxBytesReader(
		w,
		r.Body,
		maxCredentialAccessBodyBytes,
	)

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	var request credentialAccessRequest

	if err := decoder.Decode(&request); err != nil {
		return nil, errors.New(
			"invalid request",
		)
	}

	if err := decoder.Decode(
		&struct{}{},
	); err != io.EOF {
		return nil, errors.New(
			"invalid request",
		)
	}

	request.ConnectionID = strings.TrimSpace(
		request.ConnectionID,
	)

	if !connectionIDPattern.MatchString(
		request.ConnectionID,
	) {
		return nil, errors.New(
			"invalid connection id",
		)
	}

	return &request, nil
}

func credentialAccessRequestMatchesClaims(
	request *credentialAccessRequest,
	claims *runtimeTokenClaims,
) bool {
	return request.ConnectionID ==
		claims.ConnectionID
}
