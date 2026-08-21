<script lang="ts">
  import { t } from "$lib/i18n";
  let { form } = $props();
</script>

<svelte:head><title>{t("auth_create_account")} · Kondis</title></svelte:head>
<main class="auth-page">
  <section>
    <h1>{t("create_your_account")}</h1>
    <form method="POST" action="?/register">
      <label
        >{t("first_name")}<input
          required
          name="firstName"
          autocomplete="given-name"
          value={form?.firstName ?? ""}
        /></label
      ><label
        >{t("last_name")}<input
          required
          name="lastName"
          autocomplete="family-name"
          value={form?.lastName ?? ""}
        /></label
      ><label
        >{t("email")}<input
          required
          type="email"
          name="email"
          autocomplete="email"
          value={form?.email ?? ""}
        /></label
      ><label
        >{t("password")}<input
          required
          minlength="10"
          type="password"
          name="password"
          autocomplete="new-password"
        /></label
      ><label
        >{t("confirm_password")}<input
          required
          minlength="10"
          type="password"
          name="confirmPassword"
          autocomplete="new-password"
        /></label
      >{#if form?.error}<p class="error">{form.error}</p>{/if}<button
        >{t("auth_create_account")}</button
      >
    </form>
    <p class="auth-switch">
      {t("already_have_account")} <a href="/login">{t("auth_sign_in")}</a>
    </p>
  </section>
</main>
