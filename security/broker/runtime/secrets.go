package runtime

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"
)

const connectionSecretPath = "/matchboard/ai-connections"

var secretManagerHTTPClient = &http.Client{
	Timeout: 5 * time.Second,
}

type accessSecretVersionResponse struct {
	Data string `json:"data"`
}

func loadConnectionCredential(
	connectionID string,
) ([]byte, error) {
	projectID := os.Getenv("MB_SCALEWAY_PROJECT_ID")
	region := os.Getenv("MB_SCALEWAY_REGION")
	secretKey := os.Getenv("MB_SCALEWAY_SECRET_KEY")

	if projectID == "" ||
		region == "" ||
		secretKey == "" {
		return nil, errors.New(
			"secret manager configuration incomplete",
		)
	}

	baseURL := fmt.Sprintf(
		"https://api.scaleway.com/secret-manager/v1beta1/regions/%s",
		url.PathEscape(region),
	)

	query := url.Values{}
	query.Set("project_id", projectID)
	query.Set("secret_path", connectionSecretPath)
	query.Set("secret_name", connectionID)

	endpoint := baseURL +
		"/secrets-by-path/versions/latest_enabled/access?" +
		query.Encode()

	req, err := http.NewRequest(
		http.MethodGet,
		endpoint,
		nil,
	)
	if err != nil {
		return nil, err
	}

	req.Header.Set(
		"X-Auth-Token",
		secretKey,
	)

	resp, err := secretManagerHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK ||
		resp.StatusCode >= http.StatusMultipleChoices {
		_, _ = io.Copy(
			io.Discard,
			io.LimitReader(resp.Body, 16*1024),
		)

		return nil, fmt.Errorf(
			"secret manager returned status %d",
			resp.StatusCode,
		)
	}

	var result accessSecretVersionResponse

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if result.Data == "" {
		return nil, errors.New("secret data missing")
	}

	credential, err := base64.StdEncoding.DecodeString(
		result.Data,
	)
	if err != nil {
		return nil, errors.New(
			"invalid secret data encoding",
		)
	}

	return credential, nil
}
