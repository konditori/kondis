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
    <nav aria-label="Main navigation">
      <a href="/">Home</a>
      <a href="https://docs.kondis.org">Docs <span aria-hidden="true">↗</span></a>
      <a href="https://github.com/konditori/kondis">GitHub <span aria-hidden="true">↗</span></a>
    </nav>
  </header>

  <section class="knowledge-intro">
    <p class="eyebrow"><span></span> Notes from the workshop</p>
    <h1>Cursed Knowledge</h1>
    <p>
      Cursed knowledge we have learned while building Kondis that we wish we
      never needed to know.
    </p>
  </section>

  <section class="knowledge-feed" aria-label="Cursed knowledge entries">
    <article class="knowledge-entry">
      <p class="entry-date">2026-08-11</p>
      <div class="entry-visual" aria-hidden="true">
        <span>FIT</span>
        <span>TCX</span>
        <span>GPX</span>
        <div class="route-line"></div>
      </div>
      <div class="entry-copy">
        <h2>Strava takeout crops are cursed</h2>
        <p class="entry-reference">Importing edited activities</p>
        <p>
          Strava takeouts do not store activity crop boundaries. The takeout can
          contain the original, untrimmed activity file while <code
            >activities.csv</code
          > contains summary metrics for the edited activity. Because there is
          no crop information, Kondis cannot import that edit faithfully. Each
          cropped workout needs to be re-cropped manually.
        </p>
      </div>
    </article>
  </section>
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

  nav {
    display: flex;
    gap: 4px;
  }

  nav a {
    padding: 10px 14px;
    color: #aeb9ce;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
  }

  nav a:hover {
    color: #fff;
  }

  .knowledge-intro {
    width: min(760px, calc(100% - 48px));
    margin: 0 auto;
    padding: 142px 0 92px;
    text-align: center;
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
    justify-content: center;
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
    margin-bottom: 22px;
    color: #f4f7ff;
    font-size: clamp(48px, 7vw, 78px);
    font-weight: 700;
    letter-spacing: -0.07em;
    line-height: 0.99;
  }

  .knowledge-intro > p:last-child {
    max-width: 600px;
    margin: 0 auto;
    color: #aeb9cb;
    font-size: 18px;
    line-height: 1.75;
  }

  .knowledge-feed {
    width: min(920px, calc(100% - 48px));
    margin: 0 auto;
    padding-bottom: 160px;
  }

  .knowledge-entry {
    display: grid;
    grid-template-columns: 110px minmax(260px, 330px) 1fr;
    gap: 28px;
    align-items: start;
    padding: 28px 0 48px;
    border-top: 1px solid #43516b;
  }

  .entry-date {
    margin: 8px 0 0;
    color: #a6c5ff;
    font-family: "DM Mono", monospace;
    font-size: 12px;
  }

  .entry-visual {
    position: relative;
    display: flex;
    min-height: 210px;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 8px;
    padding: 20px;
    overflow: hidden;
    border: 1px solid #43516b;
    border-radius: 8px;
    background: #111d2c;
    color: #a6c5ff;
    font-family: "DM Mono", monospace;
    font-size: 10px;
  }

  .entry-visual > span {
    padding: 5px 7px;
    border: 1px solid #607aa9;
    border-radius: 4px;
    background: #172843;
  }

  .route-line {
    position: absolute;
    right: -22px;
    bottom: 28px;
    width: 180px;
    height: 100px;
    border: 2px solid #83aeff;
    border-radius: 48% 52% 42% 58%;
    box-shadow: 0 0 24px #83aeff66;
    transform: rotate(-18deg);
  }

  .entry-copy h2 {
    margin-bottom: 20px;
    color: #f4f7ff;
    font-size: clamp(26px, 4vw, 40px);
    font-weight: 700;
    letter-spacing: -0.05em;
    line-height: 1.1;
  }

  .entry-reference {
    margin-bottom: 18px;
    color: #a6c5ff;
    font-family: "DM Mono", monospace;
    font-size: 12px;
  }

  .entry-copy > p:last-child {
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
    .knowledge-intro,
    .knowledge-feed {
      width: min(100% - 32px, 760px);
    }

    .knowledge-header {
      height: auto;
      padding: 22px 0;
    }

    nav a {
      padding: 8px 5px;
      font-size: 11px;
    }

    .knowledge-intro {
      padding-top: 82px;
    }

    .knowledge-entry {
      display: block;
    }

    .entry-date {
      margin-bottom: 18px;
    }

    .entry-visual {
      min-height: 150px;
      margin-bottom: 28px;
    }

    .knowledge-intro > p:last-child {
      font-size: 16px;
    }
  }
</style>
