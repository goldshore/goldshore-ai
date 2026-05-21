-- ============================================================
-- Gold Shore Labs — R2 Binding Reference
-- Not SQL — this is the authoritative R2 configuration map
-- ============================================================

/*
  R2 BUCKETS — LIVE
  =================

  gs-assets
    Purpose:  Shared app assets (images, icons, static files, AI outputs)
    Binding:  GS_ASSETS or ASSETS depending on worker
    Workers:  goldshore-api (ASSETS), goldshore-agent (GS_ASSETS), goldshore-admin (GS_ASSETS)
    CORS:     Public read via Workers for assets.goldshore.ai
    Lifecycle: No expiry — manual archival

  gs-assets-preview
    Purpose:  Staging/preview asset variants
    Binding:  GS_ASSETS_PREVIEW
    Workers:  goldshore-api only
    Lifecycle: 90-day auto-expiry on preview/ prefix

  gs-telemetry-storage
    Purpose:  Raw telemetry dumps, agent logs, batch exports
    Binding:  GS_TELEMETRY
    Workers:  goldshore-agent only
    Lifecycle: 30-day rolling retention on telemetry/ prefix

  user-uploads  ← CREATE FIRST: wrangler r2 bucket create user-uploads
    Purpose:  User-submitted content (contact attachments, media processing inputs)
    Binding:  USER_UPLOADS
    Workers:  goldshore-api, banproof-me
    CORS:     Private — presigned URL access only
    Lifecycle: 90-day retention on uploads/ prefix, permanent on processed/


  R2 CORS POLICY (apply in Cloudflare dashboard or via API)
  ==========================================================

  gs-assets — public read CORS:
  {
    "cors": [{
      "allowedOrigins": [
        "https://goldshore.ai",
        "https://goldshore.org",
        "https://admin.goldshore.ai",
        "https://banproof.me",
        "https://rmarston.com",
        "https://armsway.com"
      ],
      "allowedMethods": ["GET", "HEAD"],
      "allowedHeaders": ["*"],
      "maxAgeSeconds": 86400
    }]
  }

  user-uploads — private CORS (presigned only):
  {
    "cors": [{
      "allowedOrigins": ["https://api.goldshore.ai"],
      "allowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "allowedHeaders": ["*"],
      "maxAgeSeconds": 3600
    }]
  }


  R2 OBJECT LIFECYCLE (set via Cloudflare dashboard)
  ====================================================

  gs-telemetry-storage:
    Rule: prefix = "telemetry/"  → delete after 30 days

  gs-assets-preview:
    Rule: prefix = "preview/"    → delete after 90 days

  user-uploads:
    Rule: prefix = "uploads/"    → delete after 90 days
    Rule: prefix = "processed/"  → no expiry


  WRANGLER BINDING SHAPES
  =======================

  In wrangler.jsonc r2_buckets array:

  { "binding": "GS_ASSETS",         "bucket_name": "gs-assets" }
  { "binding": "GS_ASSETS_PREVIEW", "bucket_name": "gs-assets-preview" }
  { "binding": "GS_TELEMETRY",      "bucket_name": "gs-telemetry-storage" }
  { "binding": "USER_UPLOADS",      "bucket_name": "user-uploads" }


  WORKER ACCESS MATRIX
  ====================

  Bucket                | goldshore-api | goldshore-agent | goldshore-admin | banproof-me
  ----------------------|---------------|-----------------|-----------------|------------
  gs-assets             | R/W (ASSETS)  | R/W (GS_ASSETS) | R (GS_ASSETS)   | R
  gs-assets-preview     | R/W           | —               | R               | —
  gs-telemetry-storage  | —             | W               | R               | —
  user-uploads          | R/W           | —               | R               | W


  COMMANDS TO PROVISION
  =====================

  # Create missing bucket
  wrangler r2 bucket create user-uploads

  # Verify all buckets
  wrangler r2 bucket list

  # List objects in a bucket
  wrangler r2 object list gs-assets

  # Set CORS (use Cloudflare REST API or dashboard)
  # https://developers.cloudflare.com/r2/buckets/cors/
*/
