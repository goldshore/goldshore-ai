export async function syncDNS(env) {
    // Example DNS sync logic
    const res = await env.API.fetch("https://api.goldshore.ai/health");
    return res.ok;
}
