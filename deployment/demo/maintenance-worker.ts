interface Env {
  MAINTENANCE_SESSION: string;
  MAINTENANCE_STARTED_AT: string;
  MAINTENANCE_TIMER: DurableObjectNamespace;
}

type MaintenanceTimer = { elapsedSeconds: number; startedAt: number };

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function maintenancePage(timer: MaintenanceTimer): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#09101d">
    <meta name="description" content="The Kondis demo is being refreshed.">
    <title>Kondis demo maintenance</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script>
      (() => {
        try {
          const savedTheme = localStorage.getItem("kondis-theme");
          const theme = savedTheme === "light" || savedTheme === "dark"
            ? savedTheme
            : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
          document.documentElement.dataset.theme = theme;
          document.querySelector('meta[name="theme-color"]').setAttribute("content", theme === "dark" ? "#09101d" : "#ffffff");
        } catch {
          // Keep the dark default if storage is unavailable.
        }
      })();
    </script>
    <style>
      :root { color: #f4f7ff; background: #09101d; color-scheme: dark light; font-family: "Manrope", ui-sans-serif, system-ui, sans-serif; font-synthesis: none; }
      * { box-sizing: border-box; }
      html { min-width: 320px; background: #09101d; }
      body { min-height: 100vh; margin: 0; overflow-x: hidden; background: #09101d; }
      a { color: inherit; text-decoration: none; }
      button { font: inherit; }
      .site-header { position: absolute; z-index: 2; top: 0; left: 50%; display: flex; width: min(1240px, calc(100% - 48px)); height: 88px; align-items: center; justify-content: space-between; transform: translateX(-50%); }
      .brand { display: inline-flex; align-items: center; gap: 7px; font-size: 21px; font-weight: 800; letter-spacing: -1.1px; }
      .brand-mark { display: grid; width: 31px; height: 31px; place-items: center; font-family: emoji; font-size: 27px; line-height: 1; }
      nav { display: flex; gap: 4px; margin-left: 100px; }
      nav a { padding: 10px 14px; color: #aeb9ce; font-size: 13px; font-weight: 600; transition: color .2s ease; }
      nav a:hover { color: #fff; }
      .header-actions { display: flex; align-items: center; gap: 10px; }
      .theme-toggle { display: grid; width: 38px; height: 38px; place-items: center; padding: 0; border: 1px solid #43516b; border-radius: 50%; color: #b9c9e4; background: #ffffff08; cursor: pointer; transition: color .2s ease, background .2s ease, transform .2s ease; }
      .theme-toggle:hover { color: #fff; background: #ffffff18; transform: translateY(-2px); }
      .theme-toggle svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
      .hero { position: relative; display: grid; min-height: 100vh; place-items: center; padding: 150px 24px 80px; overflow: hidden; background: radial-gradient(circle at 24% 19%, #1a326243 0, transparent 29%), radial-gradient(circle at 74% 70%, #21498756 0, transparent 31%), #09101d; }
      .hero::after { position: absolute; right: -16%; bottom: -31%; width: min(72vw, 850px); aspect-ratio: 1; border: 1px solid #84adff17; border-radius: 50%; content: ""; }
      .hero-glow { position: absolute; border-radius: 50%; filter: blur(80px); opacity: .5; pointer-events: none; }
      .glow-one { top: 18%; left: -140px; width: 360px; height: 280px; background: #365cc6; }
      .glow-two { right: -140px; bottom: 0; width: 400px; height: 300px; background: #1f9acf; opacity: .22; }
      .maintenance-card { position: relative; z-index: 1; width: min(640px, 100%); text-align: center; }
      .eyebrow { display: flex; align-items: center; justify-content: center; gap: 9px; margin: 0 0 20px; color: #a6c5ff; font-family: "DM Mono", monospace; font-size: 11px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; }
      .eyebrow span { width: 19px; height: 1px; background: #7eacff; }
      h1, p { margin-top: 0; }
      h1 { margin-bottom: 24px; font-size: clamp(48px, 8vw, 78px); font-weight: 700; letter-spacing: -.07em; line-height: .99; }
      h1 em { color: #8fb8ff; font-style: normal; }
      .description { max-width: 500px; margin: 0 auto; color: #aeb9cb; font-size: 16px; line-height: 1.75; }
      .timer-card { width: min(390px, 100%); margin: 38px auto 0; padding: 23px 24px; border: 1px solid #7799d94d; border-radius: 18px; background: linear-gradient(140deg, #ffffff21, #ffffff04); box-shadow: 0 28px 80px #02061170, 0 0 0 1px #ffffff08 inset; }
      .timer-label { margin: 0 0 8px; color: #aeb9ce; font-family: "DM Mono", monospace; font-size: 10px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; }
      time { display: block; color: #f4f7ff; font-family: "DM Mono", monospace; font-size: clamp(38px, 8vw, 50px); font-variant-numeric: tabular-nums; font-weight: 500; letter-spacing: -.08em; line-height: 1; }
      .timer-note { margin: 12px 0 0; color: #8290a6; font-size: 11px; }
      .site-note { margin: 25px 0 0; color: #65728a; font-size: 11px; }
      html[data-theme="light"] { color: #37373c; background: #fff; }
      html[data-theme="light"] body, html[data-theme="light"] { background: #fff; }
      html[data-theme="light"] .site-header { border-bottom: 1px solid #dedee3; background: #fffffff2; backdrop-filter: blur(16px); }
      html[data-theme="light"] .brand { color: #3b3b40; }
      html[data-theme="light"] nav a { color: #49494e; }
      html[data-theme="light"] nav a:hover { color: #4252bb; }
      html[data-theme="light"] .theme-toggle { border-color: #d6d6de; color: #4d5292; background: #f6f6f9; }
      html[data-theme="light"] .theme-toggle:hover { color: #3947a8; background: #e9ecfb; }
      html[data-theme="light"] .hero { background: radial-gradient(circle at 44% 92%, #ffd9d54d 0, transparent 22%), radial-gradient(circle at 79% 73%, #dce4ff6e 0, transparent 27%), radial-gradient(circle at 18% 17%, #eff2ffb8 0, transparent 25%), #fff; }
      html[data-theme="light"] .hero::after { border-color: #5361bc1c; }
      html[data-theme="light"] .glow-one { background: #b8c7ff; opacity: .34; }
      html[data-theme="light"] .glow-two { background: #ffc9c2; opacity: .3; }
      html[data-theme="light"] .eyebrow { color: #4453b8; }
      html[data-theme="light"] .eyebrow span { background: #4a5ac1; }
      html[data-theme="light"] h1 { color: #39393d; }
      html[data-theme="light"] h1 em { color: #4756bd; }
      html[data-theme="light"] .description { color: #56575e; }
      html[data-theme="light"] .timer-card { border-color: #d9dce7; background: #fff; box-shadow: 0 28px 70px #3440641f, 0 0 0 1px #fff inset; }
      html[data-theme="light"] .timer-label { color: #5e6069; }
      html[data-theme="light"] time { color: #39393d; }
      html[data-theme="light"] .timer-note, html[data-theme="light"] .site-note { color: #71727a; }
      @media (max-width: 600px) { .site-header { width: calc(100% - 32px); height: 72px; } .site-header nav { display: none; } .brand { font-size: 19px; } .hero { padding-top: 110px; } }
    </style>
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href="https://kondis.org" aria-label="Kondis home"><span class="brand-mark" role="img" aria-label="sweating face">😰</span><span>Kondis</span></a>
      <nav aria-label="Main navigation"><a href="https://docs.kondis.org">Docs <span aria-hidden="true">↗</span></a><a href="https://github.com/konditori/kondis">GitHub <span aria-hidden="true">↗</span></a></nav>
      <div class="header-actions"><button class="theme-toggle" type="button" aria-label="Switch to light mode" title="Switch to light mode"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg></button></div>
    </header>
    <main class="hero">
      <div class="hero-glow glow-one"></div><div class="hero-glow glow-two"></div>
      <section class="maintenance-card" aria-labelledby="maintenance-heading">
        <p class="eyebrow"><span></span>Demo maintenance<span></span></p>
        <h1 id="maintenance-heading">Refuelling<br><em>the demo.</em></h1>
        <p class="description">A fresh Kondis build and dataset are being installed. The demo will be back shortly.</p>
        <div class="timer-card"><p class="timer-label">Maintenance in progress</p><time data-started-at="${timer.startedAt}" aria-live="off">${formatDuration(timer.elapsedSeconds)}</time><p class="timer-note">Hours : minutes : seconds</p></div>
        <p class="site-note">The main Kondis site and documentation remain available.</p>
      </section>
    </main>
    <script>
      (() => {
        const root = document.documentElement;
        const button = document.querySelector(".theme-toggle");
        const timer = document.querySelector("time[data-started-at]");
        const sunIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>';
        const moonIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 15.1A8.5 8.5 0 0 1 8.9 3.6a8.5 8.5 0 1 0 11.5 11.5Z"></path></svg>';
        const pad = (value) => String(value).padStart(2, "0");
        function applyTheme(theme, persist) {
          root.dataset.theme = theme;
          document.querySelector('meta[name="theme-color"]').setAttribute("content", theme === "dark" ? "#09101d" : "#ffffff");
          button.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
          button.setAttribute("title", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
          button.innerHTML = theme === "dark" ? sunIcon : moonIcon;
          if (persist) localStorage.setItem("kondis-theme", theme);
        }
        button.addEventListener("click", () => applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true));
        const savedTheme = localStorage.getItem("kondis-theme");
        if (savedTheme !== "dark" && savedTheme !== "light") {
          const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
          colorScheme.addEventListener("change", (event) => applyTheme(event.matches ? "dark" : "light", false));
        }
        applyTheme(root.dataset.theme === "light" ? "light" : "dark", false);
        const startedAt = Number(timer.dataset.startedAt);
        function updateTimer() {
          const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
          timer.textContent = pad(Math.floor(seconds / 3600)) + ":" + pad(Math.floor(seconds % 3600 / 60)) + ":" + pad(seconds % 60);
        }
        updateTimer();
        window.setInterval(updateTimer, 1000);
      })();
    </script>
  </body>
</html>`;
}

export class MaintenanceTimerDurableObject {
  private startedAt: number | undefined;
  private readonly ready: Promise<void>;

  constructor(private readonly state: DurableObjectState) {
    this.ready = this.state.blockConcurrencyWhile(async () => {
      this.startedAt = await this.state.storage.get<number>("startedAt");
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    if (this.startedAt === undefined) {
      const candidate = Number(
        new URL(request.url).searchParams.get("startedAt"),
      );
      this.startedAt =
        Number.isFinite(candidate) && candidate > 0 ? candidate : Date.now();
      await this.state.storage.put("startedAt", this.startedAt);
    }
    return Response.json(
      {
        startedAt: this.startedAt,
        elapsedSeconds: Math.max(
          0,
          Math.floor((Date.now() - this.startedAt) / 1_000),
        ),
      } satisfies MaintenanceTimer,
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}

export default {
  async fetch(_request: Request, env: Env): Promise<Response> {
    const id = env.MAINTENANCE_TIMER.idFromName(env.MAINTENANCE_SESSION);
    const timerResponse = await env.MAINTENANCE_TIMER.get(id).fetch(
      `https://maintenance-timer/?startedAt=${encodeURIComponent(env.MAINTENANCE_STARTED_AT)}`,
    );
    const timer = (await timerResponse.json()) as MaintenanceTimer;

    return new Response(maintenancePage(timer), {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
        "Retry-After": "60",
      },
    });
  },
};
