<script lang="ts">
  import { onMount } from "svelte";
  import { Moon, Sun } from "@lucide/svelte";
  import { t } from "$lib/i18n";
  let { data, form } = $props();
  let theme = $state<"dark" | "light">("dark");

  function setTheme(nextTheme: "dark" | "light", persist = true) {
    theme = nextTheme;
    document.documentElement.dataset.theme = nextTheme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", nextTheme === "dark" ? "#08111f" : "#f4f7fb");
    if (!persist) return;
    try {
      localStorage.setItem("kondis-theme", nextTheme);
    } catch {
      // The interface still works when storage is unavailable.
    }
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  onMount(() => {
    try {
      const savedTheme = localStorage.getItem("kondis-theme");
      if (savedTheme === "dark" || savedTheme === "light") {
        setTheme(savedTheme, false);
      } else if (document.documentElement.dataset.theme === "light") {
        theme = "light";
      }
    } catch {
      // The login page still works when storage is unavailable.
    }
  });
</script>

<svelte:head><title>{t("auth_sign_in")} · Kondis</title></svelte:head>
<main class="auth-page">
  <button
    class="auth-theme-toggle"
    type="button"
    aria-label={theme === "dark"
      ? t("switch_to_light_mode")
      : t("switch_to_dark_mode")}
    title={theme === "dark"
      ? t("switch_to_light_mode")
      : t("switch_to_dark_mode")}
    aria-pressed={theme === "light"}
    onclick={toggleTheme}
  >
    {#if theme === "dark"}
      <Sun size={20} />
    {:else}
      <Moon size={20} />
    {/if}
  </button>
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
