import { describe, it } from "node:test";
import assert from "node:assert";
import { getRequiredRoles, extractRoles, isAuthorizedRole, DEFAULT_ADMIN_ROLES } from "./adminAuth.ts";
import type { ControlEnv } from "./types.ts";
import type { AccessTokenPayload } from "@goldshore/auth";

describe("adminAuth", () => {
  describe("getRequiredRoles", () => {
    it("should return DEFAULT_ADMIN_ROLES if CONTROL_ADMIN_ROLES is not set", () => {
      const env = {} as ControlEnv;
      assert.deepStrictEqual(getRequiredRoles(env), DEFAULT_ADMIN_ROLES);
    });

    it("should return DEFAULT_ADMIN_ROLES if CONTROL_ADMIN_ROLES is empty", () => {
      const env = { CONTROL_ADMIN_ROLES: "" } as ControlEnv;
      assert.deepStrictEqual(getRequiredRoles(env), DEFAULT_ADMIN_ROLES);
    });

    it("should return trimmed roles from CONTROL_ADMIN_ROLES", () => {
      const env = { CONTROL_ADMIN_ROLES: "admin, ops,  infra  " } as ControlEnv;
      assert.deepStrictEqual(getRequiredRoles(env), ["admin", "ops", "infra"]);
    });

    it("should filter out empty strings after splitting", () => {
      const env = { CONTROL_ADMIN_ROLES: "admin,,ops," } as ControlEnv;
      assert.deepStrictEqual(getRequiredRoles(env), ["admin", "ops"]);
    });
  });

  describe("extractRoles", () => {
    it("should return an empty array if claims are null or undefined", () => {
      assert.deepStrictEqual(extractRoles(null), []);
      assert.deepStrictEqual(extractRoles(undefined), []);
    });

    it("should extract roles from 'roles' field (string or array)", () => {
      assert.deepStrictEqual(extractRoles({ roles: "admin" } as AccessTokenPayload), ["admin"]);
      assert.deepStrictEqual(extractRoles({ roles: ["admin", "ops"] } as AccessTokenPayload), ["admin", "ops"]);
    });

    it("should extract roles from 'role' field", () => {
      assert.deepStrictEqual(extractRoles({ role: "owner" } as AccessTokenPayload), ["owner"]);
    });

    it("should extract roles from 'groups' field", () => {
      assert.deepStrictEqual(extractRoles({ groups: ["group1", "group2"] } as AccessTokenPayload), ["group1", "group2"]);
    });

    it("should combine and deduplicate roles from all fields and lowercase them", () => {
      const claims = {
        roles: ["Admin", "Ops"],
        role: "infra",
        groups: ["OPS", "Viewer"]
      } as unknown as AccessTokenPayload;

      const roles = extractRoles(claims);
      assert.strictEqual(roles.length, 4);
      assert.ok(roles.includes("admin"));
      assert.ok(roles.includes("ops"));
      assert.ok(roles.includes("infra"));
      assert.ok(roles.includes("viewer"));
    });
  });

  describe("isAuthorizedRole", () => {
    it("should return true if the user has one of the required roles", () => {
      const claims = { roles: ["ops"] } as AccessTokenPayload;
      assert.strictEqual(isAuthorizedRole(claims, ["admin", "ops"]), true);
    });

    it("should return true if the user has a matching role with different case", () => {
      const claims = { roles: ["OPS"] } as AccessTokenPayload;
      assert.strictEqual(isAuthorizedRole(claims, ["Ops"]), true);
    });

    it("should return false if the user has none of the required roles", () => {
      const claims = { roles: ["viewer"] } as AccessTokenPayload;
      assert.strictEqual(isAuthorizedRole(claims, ["admin", "ops"]), false);
    });

    it("should return false if the user has no roles", () => {
      const claims = {} as AccessTokenPayload;
      assert.strictEqual(isAuthorizedRole(claims, ["admin"]), false);
    });

    it("should return false if claims are missing", () => {
      assert.strictEqual(isAuthorizedRole(null, ["admin"]), false);
    });
  });
});
