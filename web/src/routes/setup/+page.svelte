<script lang="ts">
  let { form } = $props();
</script>

<svelte:head><title>Welcome to Kondis</title></svelte:head>
<main class="auth-page">
  <section>
    <h1>Welcome to Kondis 😰</h1>
    <p>Enter the setup token shown in the backend log to get started.</p>
    <form method="POST" action="?/verify">
      <label
        >Setup token<input
          required
          type="password"
          name="setupToken"
          autocomplete="off"
        /></label
      >{#if form?.error}<p class="error">{form.error}</p>{/if}<button
        >Continue</button
      >
    </form>
  </section>
</main>
