<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head><title>Sign in · Kondis</title></svelte:head>
<main class="auth-page">
  <section>
    <h1>Kondis login 😰</h1>
    <form method="POST" action="?/login">
      <label
        >Email<input
          required
          type="email"
          name="email"
          autocomplete="email"
        /></label
      >
      <label
        >Password<input
          required
          type="password"
          name="password"
          autocomplete="current-password"
        /></label
      >{#if form?.error}<p class="error">{form.error}</p>{/if}<button
        >Sign in</button
      ></form>
    <p class="auth-switch">Don't have an account? <a href="/register">Create one</a></p>
  </section>
</main>
