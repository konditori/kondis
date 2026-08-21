<script lang="ts">
  import { createTranslator } from "$lib/i18n";
  const t = createTranslator();

  let { form } = $props();
</script>

<svelte:head><title>{t("create_kondis_account")}</title></svelte:head>
<main class="auth-page">
  <section>
    <h1>{t("create_your_account")}</h1>
    <p>{t("setup_token_verified")}</p>
    <form method="POST" action="?/setup">
      <label
        >{t("first_name")}<input
          required
          name="firstName"
          autocomplete="given-name"
          value={form?.firstName ?? ""}
        /></label
      >
      <label
        >{t("last_name")}<input
          required
          name="lastName"
          autocomplete="family-name"
          value={form?.lastName ?? ""}
        /></label
      >
      <label
        >{t("email")}<input
          required
          type="email"
          name="email"
          autocomplete="email"
          value={form?.email ?? ""}
        /></label
      >
      <label
        >{t("password")}<input
          required
          minlength="10"
          type="password"
          name="password"
          autocomplete="new-password"
        /></label
      >
      <label
        >{t("confirm_password")}<input
          required
          minlength="10"
          type="password"
          name="confirmPassword"
          autocomplete="new-password"
        /></label
      >
      {#if form?.error}<p class="error">{form.error}</p>{/if}
      <button>{t("set_up")}</button>
    </form>
  </section>
</main>
