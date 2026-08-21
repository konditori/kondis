<script lang="ts">
  import { createTranslator } from "$lib/i18n";
  const t = createTranslator();
  let { form } = $props();
</script>

<svelte:head><title>{t("welcome_to_kondis")}</title></svelte:head>
<main class="auth-page">
  <section>
    <h1>{t("welcome_to_kondis")} 😰</h1>
    <p>{t("setup_token_description")}</p>
    <form method="POST" action="?/verify">
      <label
        >{t("setup_token")}<input
          required
          type="password"
          name="setupToken"
          autocomplete="off"
        /></label
      >{#if form?.error}<p class="error">{form.error}</p>{/if}<button
        >{t("common_confirm")}</button
      >
    </form>
  </section>
</main>
