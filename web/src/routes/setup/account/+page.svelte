<script lang="ts">
  let { form } = $props();
</script>

<svelte:head><title>Create your Kondis account</title></svelte:head>
<main class="auth-page">
  <section>
    <h1>Create your account</h1>
    <p>Your setup token has been verified.</p>
    <form method="POST" action="?/setup">
      <label
        >First name<input
          required
          name="firstName"
          autocomplete="given-name"
          value={form?.firstName ?? ""}
        /></label
      >
      <label
        >Last name<input
          required
          name="lastName"
          autocomplete="family-name"
          value={form?.lastName ?? ""}
        /></label
      >
      <label
        >Email<input
          required
          type="email"
          name="email"
          autocomplete="email"
          value={form?.email ?? ""}
        /></label
      >
      <label
        >Password<input
          required
          minlength="10"
          type="password"
          name="password"
          autocomplete="new-password"
        /></label
      >
      <label
        >Confirm password<input
          required
          minlength="10"
          type="password"
          name="confirmPassword"
          autocomplete="new-password"
        /></label
      >
      {#if form?.error}<p class="error">{form.error}</p>{/if}
      <button>Set up</button>
    </form>
  </section>
</main>
