// Configuration for keys that need regular rotation
const ROTATION_CONFIG = [
    { name: "system-api-key", prefix: "sk_live_", length: 32 },
    { name: "internal-service-token", prefix: "tk_int_", length: 24 }
];
function generateKey(prefix, length) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    const randomPart = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${prefix}${randomPart}`;
}
export async function rotateKeys(env) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Starting scheduled API key rotation...`);
    const auditLog = {
        action: "rotate_keys",
        timestamp,
        results: []
    };
    for (const config of ROTATION_CONFIG) {
        try {
            // 1. Generate new key
            const newKey = generateKey(config.prefix, config.length);
            // 2. Store new key as active
            // In a real system, this would update a secure store or service configuration
            await env.CONTROL_LOGS.put(`secrets:${config.name}:active`, newKey);
            // 3. Archive the rotation event
            await env.CONTROL_LOGS.put(`secrets:${config.name}:history:${timestamp}`, newKey);
            console.log(`Successfully rotated key: ${config.name}`);
            auditLog.results.push({ name: config.name, status: "success" });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Failed to rotate key for ${config.name}:`, errorMessage);
            auditLog.results.push({
                name: config.name,
                status: "error",
                error: errorMessage
            });
        }
    }
    // 4. Log the full audit trail
    const auditKey = `audit:rotation:${timestamp}`;
    await env.CONTROL_LOGS.put(auditKey, JSON.stringify(auditLog));
    console.log(`[${timestamp}] Key rotation complete. Audit log stored at: ${auditKey}`);
}
