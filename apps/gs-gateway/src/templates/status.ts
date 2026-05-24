export const STATUS_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GoldShore Gateway</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .container { text-align: center; border: 1px solid #334155; padding: 2rem; border-radius: 8px; background: #1e293b; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    h1 { margin-bottom: 0.5rem; color: #38bdf8; }
    p { color: #94a3b8; }
    .status { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; background: #059669; color: #fff; font-size: 0.875rem; font-weight: 600; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>GoldShore Gateway</h1>
    <p>Intelligent Routing & Security Layer</p>
    <div class="status">SYSTEM OPERATIONAL</div>
    <p><small>Service: gs-gateway</small></p>
  </div>
</body>
</html>`;
