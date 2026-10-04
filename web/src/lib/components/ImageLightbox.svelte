<script lang="ts">
  import { ChevronLeft, ChevronRight, X } from "@lucide/svelte";
  import { onDestroy } from "svelte";
  import type { ActivityImage } from "$lib/types";
  import { t } from "$lib/i18n";

  let {
    images,
    initialIndex,
    onClose,
  }: {
    images: ActivityImage[];
    initialIndex: number;
    onClose: () => void;
  } = $props();
  let currentIndex = $state(0);
  $effect(() => {
    currentIndex = Math.min(initialIndex, Math.max(0, images.length - 1));
  });
  const image = $derived(images[currentIndex]);
  const imageUrl = $derived(
    image?.original ?? image?.preview ?? image?.thumbnail,
  );

  let dialog = $state<HTMLDialogElement>();
  $effect(() => {
    if (dialog && imageUrl && !dialog.open) dialog.showModal();
  });
  onDestroy(() => dialog?.close());

  function close() {
    dialog?.close();
    onClose();
  }
  function handleKeydown(event: KeyboardEvent) {
    if (!["Escape", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") close();
    if (event.key === "ArrowLeft")
      currentIndex = (currentIndex - 1 + images.length) % images.length;
    if (event.key === "ArrowRight")
      currentIndex = (currentIndex + 1) % images.length;
  }

  $effect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  });
</script>

{#if imageUrl}
  <dialog
    bind:this={dialog}
    class="image-lightbox"
    tabindex="-1"
    aria-label={image?.caption ?? t("activity_image")}
    onclick={(event) => {
      if (event.target === event.currentTarget) close();
    }}
    onkeydown={handleKeydown}
    oncancel={(event) => {
      event.preventDefault();
      close();
    }}
  >
    <div class="image-lightbox-content">
      {#if images.length > 1}
        <button
          class="image-lightbox-nav image-lightbox-prev"
          type="button"
          aria-label={t("previous_image")}
          onclick={() =>
            (currentIndex = (currentIndex - 1 + images.length) % images.length)}
        >
          <ChevronLeft size={28} />
        </button>
      {/if}
      <button
        class="image-lightbox-close"
        type="button"
        aria-label={t("close_image_viewer")}
        onclick={close}
      >
        <X size={22} />
      </button>
      {#if images.length > 1}
        <button
          class="image-lightbox-nav image-lightbox-next"
          type="button"
          aria-label={t("next_image")}
          onclick={() => (currentIndex = (currentIndex + 1) % images.length)}
        >
          <ChevronRight size={28} />
        </button>
      {/if}
      <img
        src={imageUrl}
        alt={image?.caption ?? t("activity_photo")}
        width={image?.width ?? undefined}
        height={image?.height ?? undefined}
      />
      {#if images.length > 1}<span class="image-lightbox-counter"
          >{currentIndex + 1} / {images.length}</span
        >{/if}
      {#if image?.caption}<p>{image.caption}</p>{/if}
    </div>
  </dialog>
{/if}
