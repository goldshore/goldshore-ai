import { SignJWT, importPKCS8 } from "jose";

export type GoogleServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  private_key_id?: string;
  token_uri?: string;
};

export type GoogleServiceAccountAssertionOptions = {
  subject: string;
  scopes: readonly string[];
  now?: number;
};

const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";

export async function createGoogleServiceAccountAssertion(
  credentials: GoogleServiceAccountCredentials,
  options: GoogleServiceAccountAssertionOptions,
): Promise<string> {
  if (!credentials.client_email?.trim()) {
    throw new Error("Google service account client_email is required.");
  }
  if (!credentials.private_key?.includes("BEGIN PRIVATE KEY")) {
    throw new Error("Google service account private_key must be a PKCS#8 PEM key.");
  }
  if (!options.subject?.trim()) {
    throw new Error("Google Workspace delegated subject is required.");
  }
  if (options.scopes.length === 0) {
    throw new Error("At least one Google OAuth scope is required.");
  }

  const now = options.now ?? Math.floor(Date.now() / 1000);
  const tokenUri = credentials.token_uri?.trim() || DEFAULT_TOKEN_URI;
  const privateKey = await importPKCS8(credentials.private_key, "RS256");

  return new SignJWT({ scope: options.scopes.join(" ") })
    .setProtectedHeader({
      alg: "RS256",
      typ: "JWT",
      ...(credentials.private_key_id ? { kid: credentials.private_key_id } : {}),
    })
    .setIssuer(credentials.client_email)
    .setSubject(options.subject)
    .setAudience(tokenUri)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);
}
