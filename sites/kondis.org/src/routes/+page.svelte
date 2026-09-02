<script lang="ts">
  const github = "https://github.com/konditori/kondis";
  const docs = "https://docs.kondis.org";
</script>

<svelte:head>
  <title>Kondis - Open Source Fitness</title>
  <meta
    name="description"
    content="Kondis is an open-source, self-hosted fitness tracker for recording, importing, and exploring your training."
  />
  <link rel="icon" href="/favicon.svg" />
</svelte:head>

<main>
  <section class="hero">
    <div class="hero-glow glow-one"></div>
    <div class="hero-glow glow-two"></div>
    <div class="hero-copy">
      <h1>Open Source<br /><em>Fitness</em></h1>
      <p class="hero-description">
        Run, ride, train with full control over your data. Self-host your
        workouts with full multi-user support, letting you share your activities
        with family and friends. Log your exercises directly from your phone or
        import your history from other platforms.
        <br /><br />
        Kondis is currently under development, feel free to join the effort.
      </p>
      <div class="hero-actions">
        <a class="button" href="#get-started"
          >Get Started <span aria-hidden="true">→</span></a
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
    </div>

    <div class="product-previews">
      <div class="product-showcase" aria-label="Kondis landing page screenshot">
        <img
          class="product-screenshot"
          src="/kondis-dashboard-preview.png"
          alt="Kondis app home feed"
        />
      </div>
      <aside class="mobile-showcase" aria-label="Kondis mobile app preview">
        <img
          src="/kondis-mobile-preview.png"
          alt="Kondis mobile app with fictional running and cycling activities"
        />
      </aside>
    </div>
  </section>

  <section class="trust-row" aria-label="Kondis principles">
   <p>Kondis is Swedish slang for conditioning. The 😰 emoji represents a workout well done.</p>
    <div>
      <span><a href="https://discord.gg/jKjtYVe9uZ">Discord</a></span><i></i><span><a href="https://www.reddit.com/r/kondis/">Reddit</a></span>
    </div>
  </section>

  <section id="features" class="features intro-section">
    <div class="section-heading">
      <p class="eyebrow">Built for the long run</p>
      <h2>Everything you need to<br />know your next move.</h2>
      <p>
        Track your training progress, personal bests, and do full workout
        analysis. We are adding new features all the time and hope to give you
        maximum control over your training data.
      </p>
    </div>

    <div class="feature-grid">
      <article class="feature-card feature-route">
        <div class="feature-copy">
          <h3>Track from your mobile phone.</h3>
          <p>
            Log workouts directly from your phone. Currently only Android is
            supported, but iOS and Apple Watch support is coming soon. You can
            also import activities from other platforms.
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
          <h3>Bring your history with you.</h3>
          <p>
            Import activity files such as .fit, .gpx, and .tcx files. Strava
            takeout file support allows you to import your entire Strava history
            with a few clicks.
          </p>
        </div>
        <div class="import-art">
          <div class="file-card">
            <span class="file-icon">↗</span><b>morning-run.fit</b><small
              >134 kB</small
            ><i>Imported</i>
          </div>
          <div class="file-card offset">
            <span class="file-icon">⌁</span><b>sunday-trail.gpx</b><small
              >76 kB</small
            ><i>Ready</i>
          </div>
        </div>
      </article>

      <article class="feature-card feature-community">
        <div class="feature-copy">
          <h3>Keep family and friends informed.</h3>
          <p>
            In-app live tracking allows you to share minute-by-minute updates
            automatically, both for safety and for fun.
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
      <div class="shield">🔒</div>
      <h2>Your data has<br /><em>one destination:</em> you.</h2>
      <p>
        Kondis is free and open source. Run it on your own server and decide who gets access.
      </p>
      <a class="text-link" href={docs}>Read the documentation <span>→</span></a>
    </div>
  </section>

  <section id="get-started" class="get-started">
    <p class="eyebrow">Get moving</p>
    <h2>Ready when you are.</h2>
    <p>
      Set up Kondis on your server or VPS. We currently only recommend technical
      users since the project is moving fast.
    </p>
    <div class="hero-actions">
      <a class="button" href={docs}
        >Read the installation guide <span>→</span></a
      >
    </div>
  </section>
</main>
