import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { exportPKCS8, generateKeyPair, jwtVerify } from "jose";
import { createGoogleServiceAccountAssertion } from "./google-service-account";

describe("createGoogleServiceAccountAssertion", () => {
  it("signs a one-hour delegated Workspace assertion", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
    const assertion = await createGoogleServiceAccountAssertion(
      {
        client_email: "workspace-sync@example.iam.gserviceaccount.com",
        private_key: await exportPKCS8(privateKey),
        private_key_id: "test-key",
      },
      {
        subject: "admin@example.com",
        scopes: ["scope:user.readonly", "scope:group.member.readonly"],
        now: 1_800_000_000,
      },
    );

    const { payload, protectedHeader } = await jwtVerify(assertion, publicKey, {
      issuer: "workspace-sync@example.iam.gserviceaccount.com",
      subject: "admin@example.com",
      audience: "https://oauth2.googleapis.com/token",
      currentDate: new Date(1_800_000_100_000),
    });

    assert.equal(protectedHeader.alg, "RS256");
    assert.equal(protectedHeader.kid, "test-key");
    assert.equal(payload.iat, 1_800_000_000);
    assert.equal(payload.exp, 1_800_003_600);
    assert.equal(payload.scope, "scope:user.readonly scope:group.member.readonly");
  });

  it("rejects incomplete credentials before signing", async () => {
    await assert.rejects(
      createGoogleServiceAccountAssertion(
        { client_email: "", private_key: "" },
        { subject: "admin@example.com", scopes: ["scope"] },
      ),
      /client_email/,
    );
  });
});
