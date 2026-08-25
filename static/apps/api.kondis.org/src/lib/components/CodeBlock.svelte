<script lang="ts">
  let {
    code,
    label = "code",
  }: {
    code: string;
    label?: string;
  } = $props();

  let copied = $state(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    copied = true;
    window.setTimeout(() => (copied = false), 1400);
  }
</script>

<div class="code-block">
  <div class="code-block-header">
    <span>{label}</span>
    <button class="copy-button" type="button" onclick={copy}>
      {copied ? "Copied" : "Copy"}
    </button>
  </div>
  <pre><code>{code}</code></pre>
</div>
