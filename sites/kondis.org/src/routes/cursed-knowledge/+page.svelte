<svelte:head>
  <title>Cursed knowledge | Kondis</title>
  <meta
    name="description"
    content="Cursed knowledge we have learned while building Kondis."
  />
  <link rel="icon" href="/favicon.svg" />
</svelte:head>

<main class="knowledge-page">
  <section class="knowledge-intro">
    <h1>Cursed Knowledge</h1>
    <p>Annoying things we learned while developing Kondis.</p>
  </section>

  <section class="knowledge-feed" aria-label="Cursed knowledge entries">
    <article class="knowledge-entry">
      <p class="entry-date">2026-08-25</p>
      <div class="entry-visual language-visual" aria-hidden="true">
        <span>English</span>
        <span>Svenska</span>
        <span>日本語</span>
      </div>
      <div class="entry-copy">
        <h2>Strava takeout files are silently translated</h2>
        <p class="entry-reference">Importing takeout data</p>
        <p>
          Strava takeout files depend on a hidden language setting. If you don't
          have English preselected, your takeout data fields will be in whatever
          language Strava is set to, meaning it is very difficult for other apps
          (including Kondis) to read. Also, you can only do one takeout per
          account per week, so if it isn't right the first time, you have to
          wait a week to try again.
        </p>
      </div>
    </article>

    <article class="knowledge-entry">
      <p class="entry-date">2026-08-11</p>
      <div class="entry-visual" aria-hidden="true">
        <span>.zip</span>
        <div class="route-line"></div>
      </div>
      <div class="entry-copy">
        <h2>Strava takeout crops are cursed</h2>
        <p class="entry-reference">Importing edited activities</p>
        <p>
          Strava takeouts do not store activity crop boundaries. The takeout can
          contain the original, untrimmed activity file while <code
            >activities.csv</code
          > contains summary metrics for the edited activity. Because there is no
          crop information, Kondis cannot import that edit faithfully. Each cropped
          workout needs to be re-cropped manually.
        </p>
      </div>
    </article>
  </section>
</main>
