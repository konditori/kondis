<script lang="ts">
  import { onMount } from "svelte";

  const github = "https://github.com/konditori/kondis";
  const docs = "https://docs.kondis.org";
  type Theme = "dark" | "light";

  let theme = $state<Theme>("dark");

  function applyTheme(nextTheme: Theme, persist = true) {
    theme = nextTheme;
    document.documentElement.dataset.theme = nextTheme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", nextTheme === "dark" ? "#09101d" : "#ffffff");
    if (persist) localStorage.setItem("kondis-theme", nextTheme);
  }

  function toggleTheme() {
    applyTheme(theme === "dark" ? "light" : "dark");
  }

  onMount(() => {
    const savedTheme = localStorage.getItem("kondis-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      applyTheme(savedTheme);
      return;
    }

    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const syncWithSystemTheme = () =>
      applyTheme(colorScheme.matches ? "dark" : "light", false);
    syncWithSystemTheme();
    colorScheme.addEventListener("change", syncWithSystemTheme);

    return () => colorScheme.removeEventListener("change", syncWithSystemTheme);
  });
</script>

<svelte:head>
  <title>Kondis — Your training, at home</title>
  <meta
    name="description"
    content="Kondis is an open-source, self-hosted fitness tracker for recording, importing, and exploring your training."
  />
  <link rel="icon" href="/favicon.svg" />
</svelte:head>

<header class="site-header">
  <a class="brand" href="/" aria-label="Kondis home">
    <span class="brand-mark" role="img" aria-label="sweating face">😰</span>
    <span>Kondis</span>
  </a>

  <nav aria-label="Main navigation">
    <a href="#features">Features</a>
    <a href={docs}>Docs <span aria-hidden="true">↗</span></a>
    <a href={github}>GitHub <span aria-hidden="true">↗</span></a>
  </nav>

  <div class="header-actions">
    <button
      class="theme-toggle"
      type="button"
      onclick={toggleTheme}
      aria-label={theme === "dark"
        ? "Switch to light mode"
        : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {#if theme === "dark"}
        <svg viewBox="0 0 24 24" aria-hidden="true"
          ><circle cx="12" cy="12" r="4" /><path
            d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          /></svg
        >
      {:else}
        <svg viewBox="0 0 24 24" aria-hidden="true"
          ><path
            d="M20.4 15.1A8.5 8.5 0 0 1 8.9 3.6a8.5 8.5 0 1 0 11.5 11.5Z"
          /></svg
        >
      {/if}
    </button>
    <a class="button button-small" href="#get-started">Get started</a>
  </div>
</header>

<main>
  <section class="hero">
    <div class="hero-glow glow-one"></div>
    <div class="hero-glow glow-two"></div>
    <div class="hero-copy">
      <p class="eyebrow"><span></span> Open source fitness tracking</p>
      <h1>Your training,<br /><em>at home.</em></h1>
      <p class="hero-description">
        Record workouts, explore every route, and keep your training history
        somewhere that belongs to you.
      </p>
      <div class="hero-actions">
        <a class="button" href="#get-started"
          >Start with Kondis <span aria-hidden="true">→</span></a
        >
        <a class="button button-ghost" href={github}>
          <svg viewBox="0 0 24 24" aria-hidden="true"
            ><path
              d="M12 2.5a9.5 9.5 0 0 0-3 18.51c.47.09.64-.2.64-.45v-1.67c-2.61.57-3.16-1.11-3.16-1.11-.43-1.08-1.04-1.37-1.04-1.37-.85-.58.06-.57.06-.57.94.07 1.44.97 1.44.97.84 1.43 2.19 1.02 2.73.78.08-.6.33-1.02.6-1.25-2.08-.23-4.27-1.03-4.27-4.64 0-1.03.37-1.87.97-2.53-.1-.24-.42-1.2.09-2.5 0 0 .79-.25 2.61.97A9.1 9.1 0 0 1 12 7.33c.8 0 1.61.1 2.36.32 1.81-1.22 2.6-.97 2.6-.97.52 1.3.2 2.26.1 2.5.6.66.96 1.5.96 2.53 0 3.62-2.2 4.4-4.28 4.63.34.29.64.82.64 1.65v2.42c0 .25.17.55.64.45A9.5 9.5 0 0 0 12 2.5Z"
              fill="currentColor"
            /></svg
          >
          View on GitHub
        </a>
      </div>
      <p class="hero-note">Self-host it. Own your data. Keep moving.</p>
    </div>

    <div class="product-showcase" aria-label="Kondis workout dashboard preview">
      <div class="preview-topbar">
        <div class="preview-brand">
          <span class="preview-k" aria-hidden="true">😰</span> kondis
        </div>
        <div class="preview-search">Search activities</div>
        <div class="preview-avatar">JL</div>
      </div>
      <div class="preview-body">
        <aside class="preview-sidebar">
          <span class="side-active">⌂ <b>Home</b></span>
          <span>◷ Activities</span>
          <span>◉ Explore</span>
          <span>♙ People</span>
          <i></i>
          <span>⚙ Settings</span>
        </aside>
        <div class="preview-content">
          <div class="preview-heading">
            <div>
              <p>Tuesday, 12 March</p>
              <h2>Good morning, Jamie</h2>
            </div>
            <button>+ Add activity</button>
          </div>
          <div class="activity-grid">
            <article class="activity-card run-card">
              <div class="card-label">
                <span class="activity-icon">⌁</span><b>Morning run</b><small
                  >Today · 07:16</small
                >
              </div>
              <div class="route-map">
                <svg viewBox="0 0 480 220" role="img" aria-label="Route map">
                  <path
                    class="map-road"
                    d="M-8 57C71 37 87 97 150 90s77-79 145-49c56 24 83 63 193 9"
                  />
                  <path
                    class="map-road thin"
                    d="M19 190c49-46 98-7 148-39 56-36 39-93 119-75 55 12 73 80 174 51"
                  />
                  <path
                    class="map-road thin"
                    d="M-6 132c89-34 102 21 184 5 73-14 66-78 152-54 59 17 84 44 152 34"
                  />
                  <path
                    class="route-line"
                    d="M92 167c14-43 42-68 67-73 33-7 40-38 80-37 36 1 37 35 72 46 23 7 41 21 39 42-3 31-46 43-77 25-22-13-29-43-59-44-34-1-39 27-72 33-25 4-35 20-50 8Z"
                  />
                  <circle cx="92" cy="167" r="6" class="route-start" />
                </svg>
              </div>
              <div class="activity-stats">
                <span><b>8.42</b> km</span><span><b>42:16</b> time</span><span
                  ><b>5:01</b> /km</span
                >
              </div>
            </article>
            <article class="progress-card">
              <p>This week</p>
              <h3>37.6 <small>km</small></h3>
              <div class="bars">
                <i></i><i></i><i></i><i></i><i></i><i></i><i></i>
              </div>
              <div class="week-labels">
                <span>M</span><span>T</span><span>W</span><span>T</span><span
                  >F</span
                ><span>S</span><span>S</span>
              </div>
            </article>
          </div>
          <div class="preview-section-title">
            <h3>Recent activities</h3>
            <span>View all →</span>
          </div>
          <div class="recent-activity">
            <span class="round-icon bike">⌁</span>
            <div>
              <b>Lunch ride</b>
              <p>10 March · Road cycling</p>
            </div>
            <strong>42.8 km</strong><small>1:46:12</small>
          </div>
          <div class="recent-activity">
            <span class="round-icon hike">△</span>
            <div>
              <b>Sunday hike</b>
              <p>9 March · Hiking</p>
            </div>
            <strong>12.1 km</strong><small>3:12:46</small>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="trust-row" aria-label="Kondis principles">
    <p>Built for your training, not your attention.</p>
    <div>
      <span>Self-hosted</span><i></i><span>Private by default</span><i></i><span
        >Open source</span
      >
    </div>
  </section>

  <section id="features" class="features intro-section">
    <div class="section-heading">
      <p class="eyebrow"><span></span> Built for the long run</p>
      <h2>Everything you need to<br />know your next move.</h2>
      <p>
        Kondis gives every workout a durable home—from the first GPS point to
        the next personal best.
      </p>
    </div>

    <div class="feature-grid">
      <article class="feature-card feature-route">
        <div class="feature-copy">
          <span class="feature-number">01</span>
          <h3>Every route tells a story.</h3>
          <p>
            See where your effort took you with clear route maps, elevation
            profiles, and the details that matter.
          </p>
        </div>
        <div class="feature-map-art">
          <svg viewBox="0 0 620 360" aria-hidden="true">
            <path
              class="contour"
              d="M-28 80C65 7 153 130 238 54S393 75 477 27s95 42 174 4"
            />
            <path
              class="contour"
              d="M-12 175c90-64 133 26 218-26 95-59 115 46 204-12 89-58 108 13 224-32"
            />
            <path
              class="contour"
              d="M-18 280c79-50 137-6 203-39 83-41 111 47 197 15 92-35 133 41 262-23"
            />
            <path
              class="feature-route-line"
              d="M110 289c18-53 42-95 91-105 52-11 67-99 128-96 51 3 58 80 112 95 47 13 70 25 56 72-12 40-58 63-96 41-43-25-47-81-92-76-47 5-52 54-100 58-42 4-61 55-99 11Z"
            />
            <circle cx="110" cy="289" r="9" class="route-start" />
          </svg>
        </div>
      </article>

      <article class="feature-card feature-import">
        <div class="feature-copy">
          <span class="feature-number">02</span>
          <h3>Bring your history with you.</h3>
          <p>
            Import activities from FIT, TCX, and GPX files—or bring over your
            Strava takeout to start fresh without leaving anything behind.
          </p>
        </div>
        <div class="import-art">
          <div class="file-card">
            <span class="file-icon">↗</span><b>morning-run.fit</b><small
              >8.4 MB</small
            ><i>Imported</i>
          </div>
          <div class="file-card offset">
            <span class="file-icon">⌁</span><b>sunday-trail.gpx</b><small
              >1.2 MB</small
            ><i>Ready</i>
          </div>
        </div>
      </article>

      <article class="feature-card feature-community">
        <div class="feature-copy">
          <span class="feature-number">03</span>
          <h3>Train together, on your terms.</h3>
          <p>
            Follow the people you choose, share activities, and celebrate the
            work—without handing your community to an ad network.
          </p>
        </div>
        <div class="people-art">
          <div class="people-orbit orbit-one"></div>
          <div class="people-orbit orbit-two"></div>
          <span class="person person-one">M</span><span
            class="person person-two">A</span
          ><span class="person person-three">S</span><span
            class="person person-four">J</span
          >
          <div class="heart">♥</div>
        </div>
      </article>
    </div>
  </section>

  <section class="privacy-section">
    <div class="privacy-orbit orbit-a"></div>
    <div class="privacy-orbit orbit-b"></div>
    <div class="privacy-content">
      <div class="shield">⌁</div>
      <p class="eyebrow"><span></span> Yours by design</p>
      <h2>Your data has<br /><em>one destination:</em> you.</h2>
      <p>
        Kondis is free and open source. Run it on your own server, decide who
        gets access, and keep your training history yours for the years ahead.
      </p>
      <a class="text-link" href={docs}>Read the documentation <span>→</span></a>
    </div>
  </section>

  <section id="get-started" class="get-started">
    <p class="eyebrow"><span></span> Get moving</p>
    <h2>Ready when you are.</h2>
    <p>
      Set up Kondis on your own server and start building a training archive
      that lasts.
    </p>
    <div class="hero-actions">
      <a class="button" href={docs}
        >Read the installation guide <span>→</span></a
      ><a class="button button-ghost" href={github}>Explore the source</a>
    </div>
  </section>
</main>

<footer>
  <a class="brand" href="/" aria-label="Kondis home"
    ><span class="brand-mark" role="img" aria-label="sweating face">😰</span
    ><span>Kondis</span></a
  >
  <p>Open-source, self-hosted fitness tracking.</p>
  <div>
    <a href={docs}>Docs</a><a href="https://api.kondis.org">API</a><a
      href={github}>GitHub</a
    >
  </div>
</footer>
