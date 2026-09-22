package enrollment

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

var errConnectionAlreadyExists = errors.New("connection already exists")

var secretManagerHTTPClient = &http.Client{
	Timeout: 5 * time.Second,
}

type secretContainer struct {
	ID string `json:"id"`
}

type secretManagerErrorDetail struct {
	ArgumentName string `json:"argument_name"`
	Reason       string `json:"reason"`
	HelpMessage  string `json:"help_message"`
}

type secretManagerErrorBody struct {
	Message string                     `json:"message"`
	Type    string                     `json:"type"`
	Details []secretManagerErrorDetail `json:"details"`
}

type secretManagerHTTPError struct {
	StatusCode int
	Message    string
	Type       string
	Details    []secretManagerErrorDetail
}

func (e *secretManagerHTTPError) Error() string {
	parts := []string{
		fmt.Sprintf(
			"secret manager returned status %d",
			e.StatusCode,
		),
	}

	if e.Message != "" {
		parts = append(parts, e.Message)
	}

	for _, detail := range e.Details {
		detailParts := []string{}

		if detail.ArgumentName != "" {
			detailParts = append(
				detailParts,
				"argument="+detail.ArgumentName,
			)
		}

		if detail.Reason != "" {
			detailParts = append(
				detailParts,
				"reason="+detail.Reason,
			)
		}

		if detail.HelpMessage != "" {
			detailParts = append(
				detailParts,
				"help="+detail.HelpMessage,
			)
		}

		if len(detailParts) > 0 {
			parts = append(
				parts,
				strings.Join(detailParts, ", "),
			)
		}
	}

	return strings.Join(parts, ": ")
}

func (e *secretManagerHTTPError) isDuplicate() bool {
	if e.StatusCode == http.StatusConflict {
		return true
	}

	if e.StatusCode != http.StatusBadRequest {
		return false
	}

	for _, detail := range e.Details {
		if detail.ArgumentName != "name" {
			continue
		}

		if detail.Reason != "format" {
			continue
		}

		help := strings.ToLower(
			strings.TrimSpace(detail.HelpMessage),
		)

		if strings.Contains(
			help,
			"cannot have same secret name in same path",
		) {
			return true
		}
	}

	return false
}

func storeEnrollmentCredential(
	request *enrollRequest,
) error {
	projectID := os.Getenv("MB_SCALEWAY_PROJECT_ID")
	region := os.Getenv("MB_SCALEWAY_REGION")
	secretKey := os.Getenv("MB_SCALEWAY_SECRET_KEY")
	kmsKeyID := os.Getenv("MB_SCALEWAY_SECRET_KMS_KEY_ID")

	if projectID == "" ||
		region == "" ||
		secretKey == "" ||
		kmsKeyID == "" {
		return errors.New(
			"storage configuration incomplete",
		)
	}

	baseURL := fmt.Sprintf(
		"https://api.scaleway.com/secret-manager/v1beta1/regions/%s",
		url.PathEscape(region),
	)

	createBody := map[string]any{
		"project_id": projectID,
		"name":       request.ConnectionID,
		"path":       "/matchboard/ai-connections",
		"type":       "opaque",
		"key_id":     kmsKeyID,
	}

	var secret secretContainer

	_, err := doSecretManagerRequest(
		http.MethodPost,
		baseURL+"/secrets",
		secretKey,
		createBody,
		&secret,
	)
	if err != nil {
		var httpErr *secretManagerHTTPError

		if errors.As(err, &httpErr) &&
			httpErr.isDuplicate() {
			return errConnectionAlreadyExists
		}

		return fmt.Errorf(
			"create secret: %w",
			err,
		)
	}

	// Enrollment is not complete until the credential version exists
	// and the secret has been protected.
	complete := false

	defer func() {
		if !complete && secret.ID != "" {
			_, _ = doSecretManagerRequest(
				http.MethodDelete,
				baseURL+
					"/secrets/"+
					url.PathEscape(secret.ID),
				secretKey,
				nil,
				nil,
			)
		}
	}()

	versionBody := map[string]any{
		"data": base64.StdEncoding.EncodeToString(
			[]byte(request.Credential),
		),
	}

	if _, err := doSecretManagerRequest(
		http.MethodPost,
		baseURL+
			"/secrets/"+
			url.PathEscape(secret.ID)+
			"/versions",
		secretKey,
		versionBody,
		nil,
	); err != nil {
		return fmt.Errorf(
			"create secret version: %w",
			err,
		)
	}

	if _, err := doSecretManagerRequest(
		http.MethodPost,
		baseURL+
			"/secrets/"+
			url.PathEscape(secret.ID)+
			"/protect",
		secretKey,
		nil,
		nil,
	); err != nil {
		return fmt.Errorf(
			"protect secret: %w",
			err,
		)
	}

	complete = true

	return nil
}

func doSecretManagerRequest(
	method string,
	endpoint string,
	token string,
	body any,
	result any,
) (int, error) {
	var reader io.Reader

	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return 0, err
		}

		reader = bytes.NewReader(payload)
	}

	req, err := http.NewRequest(
		method,
		endpoint,
		reader,
	)
	if err != nil {
		return 0, err
	}

	req.Header.Set(
		"X-Auth-Token",
		token,
	)

	if body != nil {
		req.Header.Set(
			"Content-Type",
			"application/json",
		)
	}

	resp, err := secretManagerHTTPClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK ||
		resp.StatusCode >= http.StatusMultipleChoices {

		var apiError secretManagerErrorBody

		_ = json.NewDecoder(
			io.LimitReader(
				resp.Body,
				16*1024,
			),
		).Decode(&apiError)

		return resp.StatusCode, &secretManagerHTTPError{
			StatusCode: resp.StatusCode,
			Message:    apiError.Message,
			Type:       apiError.Type,
			Details:    apiError.Details,
		}
	}

	if result != nil {
		if err := json.NewDecoder(
			resp.Body,
		).Decode(result); err != nil {
			return resp.StatusCode, err
		}
	}

	return resp.StatusCode, nil
}
