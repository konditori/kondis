<script lang="ts">
  import { ChevronLeft, ChevronRight, X } from "@lucide/svelte";
  import type { ActivityImage } from "$lib/types";

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

  $effect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (!["Escape", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft")
        currentIndex = (currentIndex - 1 + images.length) % images.length;
      if (event.key === "ArrowRight")
        currentIndex = (currentIndex + 1) % images.length;
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  });

  $effect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  });
</script>

{#if imageUrl}
  <div
    class="image-lightbox"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    aria-label={image?.caption ?? "Activity image"}
    onclick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}
    onkeydown={(event) => {
      event.stopPropagation();
      if (event.key === "Escape") onClose();
    }}
  >
    <div class="image-lightbox-content">
      {#if images.length > 1}
        <button
          class="image-lightbox-nav image-lightbox-prev"
          type="button"
          aria-label="Previous image"
          onclick={() =>
            (currentIndex = (currentIndex - 1 + images.length) % images.length)}
        >
          <ChevronLeft size={28} />
        </button>
      {/if}
      <button
        class="image-lightbox-close"
        type="button"
        aria-label="Close image viewer"
        onclick={onClose}
      >
        <X size={22} />
      </button>
      {#if images.length > 1}
        <button
          class="image-lightbox-nav image-lightbox-next"
          type="button"
          aria-label="Next image"
          onclick={() => (currentIndex = (currentIndex + 1) % images.length)}
        >
          <ChevronRight size={28} />
        </button>
      {/if}
      <img
        src={imageUrl}
        alt={image?.caption ?? "Activity photo"}
        width={image?.width ?? undefined}
        height={image?.height ?? undefined}
      />
      {#if images.length > 1}<span class="image-lightbox-counter"
          >{currentIndex + 1} / {images.length}</span
        >{/if}
      {#if image?.caption}<p>{image.caption}</p>{/if}
    </div>
  </div>
{/if}
