<script lang="ts">
  import ThemePicker from "../../../../packages/theme/ThemePicker.svelte";
  import { t } from "$lib/i18n";
  let { data, form } = $props();
</script>

<svelte:head><title>{t("auth_sign_in")} · Kondis</title></svelte:head>
<main class="auth-page">
  <div class="auth-appearance">
    <ThemePicker
      label={t("appearance")}
      system={t("theme_system")}
      light={t("theme_light")}
      dark={t("theme_dark")}
    />
  </div>
  <section>
    <h1>Kondis {t("auth_sign_in")} 😰</h1>
    <form method="POST" action="?/login">
      {#if data.returnTo}<input
          type="hidden"
          name="returnTo"
          value={data.returnTo}
        />{/if}
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
        type="submit">{t("auth_sign_in")}</button
      >
    </form>
    {#if data.registrationEnabled}
      <p class="auth-switch">
        {t("dont_have_account")} <a href="/register">{t("create_one")}</a>
      </p>
    {/if}
  </section>
</main>
