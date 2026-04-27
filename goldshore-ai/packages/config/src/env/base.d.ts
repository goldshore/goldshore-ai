/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// Type definitions for environment variables
interface ImportMetaEnv {
    readonly PUBLIC_API: string;
    readonly PUBLIC_AUTH_TOKEN_URL: string;
    readonly PUBLIC_AUTH_CLIENT_ID: string;
    readonly AUTH_CLIENT_SECRET: string;
    // Add other env vars as needed
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// Global Cloudflare Env types
interface KVNamespace {
    put(key: string, value: string | ReadableStream | ArrayBuffer, options?: any): Promise<void>;
    get(key: string, options?: any): Promise<string | null>;
    // Add other methods as needed
}

interface D1Database {
    prepare(query: string): any;
    // Add other methods as needed
}

interface Env {
	KV: KVNamespace;
	DB: D1Database;
	CONTACT_TTL_SECONDS?: string;
}

declare namespace App {
    interface Locals {
        runtime: {
            env: Env;
        };
    }
}
