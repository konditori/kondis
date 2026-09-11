const body = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Kondis demo maintenance</title>
    <style>
      :root { color-scheme: light dark; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #111713; color: #e8f0e9; }
      main { width: min(34rem, calc(100% - 3rem)); border-top: 4px solid #8fc99a; padding-top: 1.5rem; }
      h1 { margin: 0 0 1rem; font-size: clamp(1.8rem, 7vw, 3.8rem); line-height: .95; letter-spacing: -.06em; }
      p { max-width: 28rem; color: #afbbb1; line-height: 1.6; }
    </style>
  </head>
  <body><main><h1>Resetting the demo.</h1><p>A fresh Kondis build and dataset are being installed. Try again in a minute.</p></main></body>
</html>`;

export default {
  fetch(): Response {
    return new Response(body, {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
        "Retry-After": "60",
      },
    });
  },
};
