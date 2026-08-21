<script lang="ts">
  import { createTranslator } from "$lib/i18n";
  const t = createTranslator();
  let { data, form } = $props();
</script>

<svelte:head><title>{t("auth_sign_in")} · Kondis</title></svelte:head>
<main class="auth-page">
  <section>
    <h1>Kondis {t("auth_sign_in")} 😰</h1>
    <form method="POST" action="?/login">
      <label
        >{t("email")}<input
          required
          type="email"
          name="email"
          autocomplete="email"
        /></label
      >
      <label
        >{t("password")}<input
          required
          type="password"
          name="password"
          autocomplete="current-password"
        /></label
      >{#if form?.error}<p class="error">{form.error}</p>{/if}<button
        >{t("auth_sign_in")}</button
      >
    </form>
    {#if data.registrationEnabled}
      <p class="auth-switch">
        {t("dont_have_account")} <a href="/register">{t("create_one")}</a>
      </p>
    {/if}
  </section>
</main>
