<script lang="ts">
  let { form } = $props();
</script>

<svelte:head><title>Welcome to Kondis</title></svelte:head>
<main class="auth-page">
  <section>
    <h1>Welcome to Kondis 😰</h1>
    <p>Please create your account</p>
    <form method="POST" action="?/setup">
      <label
        >Setup token<input
          required
          type="password"
          name="setupToken"
          autocomplete="off"
        /></label
      ><label
        >First name<input
          required
          name="firstName"
          autocomplete="given-name"
          value={form?.firstName ?? ""}
        /></label
      ><label
        >Last name<input
          required
          name="lastName"
          autocomplete="family-name"
          value={form?.lastName ?? ""}
        /></label
      ><label
        >Email<input
          required
          type="email"
          name="email"
          autocomplete="email"
          value={form?.email ?? ""}
        /></label
      ><label
        >Password<input
          required
          minlength="10"
          type="password"
          name="password"
          autocomplete="new-password"
        /></label
      ><label
        >Confirm password<input
          required
          minlength="10"
          type="password"
          name="confirmPassword"
          autocomplete="new-password"
        /></label
      >{#if form?.error}<p class="error">{form.error}</p>{/if}<button
        >Set up</button
      >
    </form>
  </section>
</main>
