package enrollment

import (
	"crypto/ed25519"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"os"
	"strings"
	"time"
)

const (
	enrollmentIssuer    = "matchboard"
	enrollmentAudience  = "matchboard-ai-enrollment"
	enrollmentOperation = "enroll-connection"

	maxTokenLifetime = 2 * time.Minute
	clockSkew        = 30 * time.Second
)

type enrollmentTokenHeader struct {
	Algorithm string `json:"alg"`
	Type      string `json:"typ"`
}

type enrollmentTokenClaims struct {
	Issuer       string `json:"iss"`
	Audience     string `json:"aud"`
	IssuedAt     int64  `json:"iat"`
	NotBefore    int64  `json:"nbf"`
	ExpiresAt    int64  `json:"exp"`
	TokenID      string `json:"jti"`
	Operation    string `json:"op"`
	ConnectionID string `json:"connectionId"`
	Provider     string `json:"provider"`
}

func verifyEnrollmentToken(
	authorization string,
) (*enrollmentTokenClaims, error) {
	const prefix = "Bearer "

	if !strings.HasPrefix(authorization, prefix) {
		return nil, errors.New("missing bearer token")
	}

	token := strings.TrimSpace(strings.TrimPrefix(authorization, prefix))

	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, errors.New("invalid token")
	}

	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, errors.New("invalid token header")
	}

	var header enrollmentTokenHeader

	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, errors.New("invalid token header")
	}

	if header.Algorithm != "EdDSA" || header.Type != "JWT" {
		return nil, errors.New("unsupported token")
	}

	publicKey, err := enrollmentPublicKey()
	if err != nil {
		return nil, err
	}

	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, errors.New("invalid signature")
	}

	signingInput := []byte(parts[0] + "." + parts[1])

	if !ed25519.Verify(publicKey, signingInput, signature) {
		return nil, errors.New("invalid signature")
	}

	claimsBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, errors.New("invalid claims")
	}

	var claims enrollmentTokenClaims

	if err := json.Unmarshal(claimsBytes, &claims); err != nil {
		return nil, errors.New("invalid claims")
	}

	if err := validateEnrollmentClaims(&claims); err != nil {
		return nil, err
	}

	return &claims, nil
}

func enrollmentPublicKey() (ed25519.PublicKey, error) {
	encoded := os.Getenv("MB_ENROLLMENT_TOKEN_PUBLIC_KEY_B64")
	if encoded == "" {
		return nil, errors.New("verification key unavailable")
	}

	pemBytes, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, errors.New("invalid verification key encoding")
	}

	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, errors.New("invalid verification key")
	}

	parsed, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, errors.New("invalid verification key")
	}

	publicKey, ok := parsed.(ed25519.PublicKey)
	if !ok {
		return nil, errors.New("verification key is not Ed25519")
	}

	return publicKey, nil
}

func validateEnrollmentClaims(claims *enrollmentTokenClaims) error {
	now := time.Now()

	if claims.Issuer != enrollmentIssuer {
		return errors.New("invalid issuer")
	}

	if claims.Audience != enrollmentAudience {
		return errors.New("invalid audience")
	}

	if claims.Operation != enrollmentOperation {
		return errors.New("invalid operation")
	}

	if claims.TokenID == "" ||
		claims.ConnectionID == "" ||
		claims.Provider == "" {
		return errors.New("missing required claims")
	}

	issuedAt := time.Unix(claims.IssuedAt, 0)
	notBefore := time.Unix(claims.NotBefore, 0)
	expiresAt := time.Unix(claims.ExpiresAt, 0)

	if now.Add(clockSkew).Before(notBefore) {
		return errors.New("token not active")
	}

	if now.Add(-clockSkew).After(expiresAt) {
		return errors.New("token expired")
	}

	if issuedAt.After(now.Add(clockSkew)) {
		return errors.New("invalid issued-at time")
	}

	if expiresAt.Before(issuedAt) ||
		expiresAt.Sub(issuedAt) > maxTokenLifetime {
		return errors.New("invalid token lifetime")
	}

	return nil
}
