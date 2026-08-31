<svelte:head>
  <title>Cursed knowledge | Kondis</title>
  <meta
    name="description"
    content="Cursed knowledge we have learned while building Kondis."
  />
  <link rel="icon" href="/favicon.svg" />
</svelte:head>

<main class="knowledge-page">
  <header class="knowledge-header">
    <a class="brand" href="/" aria-label="Kondis home">
      <span class="brand-mark" role="img" aria-label="sweating face">😰</span>
      <span>Kondis</span>
    </a>
    <a class="back-link" href="/"
      >Back to Kondis <span aria-hidden="true">↗</span></a
    >
  </header>

  <article class="knowledge-content">
    <p class="eyebrow"><span></span> Notes from the workshop</p>
    <h1>Cursed knowledge</h1>
    <p class="lede">
      Cursed knowledge we have learned while building Kondis that we wish we
      never needed to know.
    </p>

    <section class="knowledge-entry">
      <p class="entry-date">2026-08-11</p>
      <h2>Strava takeout crops are cursed</h2>
      <p>
        Strava takeouts do not store activity crop boundaries. The takeout can
        contain the original, untrimmed activity file while <code
          >activities.csv</code
        >
        contains summary metrics for the edited activity. Because there is no crop
        information, Kondis cannot import that edit faithfully. Each cropped workout
        needs to be re-cropped manually.
      </p>
    </section>
  </article>
</main>

<style>
  .knowledge-page {
    min-height: 100vh;
    background:
      radial-gradient(circle at 18% 12%, #1a326243 0, transparent 30%),
      radial-gradient(circle at 88% 78%, #21498756 0, transparent 34%), #09101d;
  }

  .knowledge-header {
    display: flex;
    width: min(1120px, calc(100% - 48px));
    height: 88px;
    align-items: center;
    justify-content: space-between;
    margin: 0 auto;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: #f4f7ff;
    font-size: 21px;
    font-weight: 800;
    letter-spacing: -1.1px;
    text-decoration: none;
  }

  .brand-mark {
    display: grid;
    width: 31px;
    height: 31px;
    place-items: center;
    font-family: "Apple Color Emoji", "Segoe UI Emoji", sans-serif;
    font-size: 27px;
    line-height: 1;
  }

  .back-link {
    color: #aeb9ce;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
  }

  .back-link:hover {
    color: #fff;
  }

  .knowledge-content {
    width: min(760px, calc(100% - 48px));
    margin: 0 auto;
    padding: 130px 0 160px;
  }

  .eyebrow {
    display: flex;
    align-items: center;
    gap: 9px;
    margin: 0 0 20px;
    color: #a6c5ff;
    font-family: "DM Mono", monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .eyebrow span {
    width: 19px;
    height: 1px;
    background: #7eacff;
  }

  h1,
  h2,
  p {
    margin-top: 0;
  }

  h1 {
    margin-bottom: 24px;
    color: #f4f7ff;
    font-size: clamp(48px, 7vw, 78px);
    font-weight: 700;
    letter-spacing: -0.07em;
    line-height: 0.99;
  }

  .lede {
    max-width: 600px;
    margin-bottom: 88px;
    color: #aeb9cb;
    font-size: 18px;
    line-height: 1.75;
  }

  .knowledge-entry {
    padding: 32px 0 0;
    border-top: 1px solid #43516b;
  }

  .entry-date {
    margin-bottom: 16px;
    color: #a6c5ff;
    font-family: "DM Mono", monospace;
    font-size: 12px;
  }

  h2 {
    margin-bottom: 20px;
    color: #f4f7ff;
    font-size: clamp(26px, 4vw, 40px);
    font-weight: 700;
    letter-spacing: -0.05em;
    line-height: 1.1;
  }

  .knowledge-entry > p:last-child {
    max-width: 680px;
    margin-bottom: 0;
    color: #aeb9cb;
    font-size: 16px;
    line-height: 1.8;
  }

  code {
    padding: 2px 5px;
    border-radius: 4px;
    color: #d4e2ff;
    background: #ffffff12;
    font-family: "DM Mono", monospace;
    font-size: 0.9em;
  }

  @media (max-width: 640px) {
    .knowledge-header,
    .knowledge-content {
      width: min(100% - 32px, 760px);
    }

    .knowledge-content {
      padding-top: 90px;
    }

    .lede {
      margin-bottom: 64px;
      font-size: 16px;
    }
  }
</style>
