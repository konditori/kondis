<script lang="ts">
  import { page } from "$app/state";
  import { ArrowLeft, RouteOff } from "@lucide/svelte";
  import { createTranslator } from "$lib/i18n";
  const t = createTranslator();
</script>

<div class="empty-state error-page">
  <span class="empty-icon"><RouteOff size={28} /></span>
  <span class="eyebrow">{t("error_label")} {page.status}</span>
  <h1>{page.error?.message ?? t("error_generic_title")}</h1>
  <a class="back-link" href="/"
    ><ArrowLeft size={18} /> {t("return_to_activities")}</a
  >
</div>
