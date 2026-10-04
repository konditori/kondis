<script lang="ts">
  import { ChevronLeft, ChevronRight } from "@lucide/svelte";
  import ImageLightbox from "$lib/components/ImageLightbox.svelte";
  import type { ActivityDetail } from "$lib/types";
  import { t } from "$lib/i18n";
  let { images }: { images: ActivityDetail["images"] } = $props();
  let imageCarousel = $state<HTMLDivElement>();
  let imagePage = $state(0);
  const viewableImages = $derived(
    images.filter(
      (image) => image.preview || image.original || image.thumbnail,
    ),
  );
  let selectedImageIndex = $state<number | null>(null);
  const imagePageCount = $derived(viewableImages.length);
  $effect(() => {
    if (imagePage >= imagePageCount) {
      imagePage = Math.max(0, imagePageCount - 1);
    }
  });
  function updateImagePage() {
    if (!imageCarousel) return;
    const slides = [...imageCarousel.children] as HTMLElement[];
    const nearest = slides.reduce(
      (best, slide, index) =>
        Math.abs(slide.offsetLeft - imageCarousel!.scrollLeft) <
        Math.abs(slides[best]!.offsetLeft - imageCarousel!.scrollLeft)
          ? index
          : best,
      0,
    );
    imagePage = nearest;
  }

  function scrollImages(direction: -1 | 1) {
    if (!imageCarousel) return;
    const slides = [...imageCarousel.children] as HTMLElement[];
    const next = Math.max(
      0,
      Math.min(imagePage + direction, slides.length - 1),
    );
    const slide = slides[next];
    if (!slide) return;
    imageCarousel.scrollTo({ left: slide.offsetLeft, behavior: "smooth" });
    imagePage = next;
  }
</script>

{#if viewableImages.length > 0}
  <section
    class="activity-image-carousel"
    class:activity-image-carousel-locked={selectedImageIndex !== null}
    aria-label={t("activity_photos")}
  >
    <div
      class="activity-visual-carousel-track"
      role="region"
      aria-label={t("swipeable_activity_photos")}
      bind:this={imageCarousel}
      onscroll={updateImagePage}
    >
      {#each viewableImages as image, imageIndex (image.id)}
        <div class="activity-visual-slide activity-photo-slide">
          <figure>
            <button
              type="button"
              class="activity-photo-open"
              aria-label={image.caption ?? t("open_activity_photos")}
              onclick={() => (selectedImageIndex = imageIndex)}
            >
              <img
                src={image.preview ?? image.thumbnail ?? image.original}
                alt={image.caption ?? t("activity_photo")}
              />
            </button>
            {#if image.caption}<figcaption>{image.caption}</figcaption>{/if}
          </figure>
        </div>
      {/each}
    </div>
    {#if imagePageCount > 1}
      <div
        class="activity-visual-controls"
        aria-label={t("photo_carousel_controls")}
      >
        <button
          type="button"
          aria-label={t("previous_image")}
          onclick={() => scrollImages(-1)}
          disabled={imagePage === 0}><ChevronLeft size={17} /></button
        >
        <span aria-live="polite">{imagePage + 1} / {imagePageCount}</span>
        <button
          type="button"
          aria-label={t("next_image")}
          onclick={() => scrollImages(1)}
          disabled={imagePage === imagePageCount - 1}
          ><ChevronRight size={17} /></button
        >
      </div>
    {/if}
  </section>
{/if}

{#if selectedImageIndex !== null}
  <ImageLightbox
    images={viewableImages}
    initialIndex={selectedImageIndex}
    onClose={() => (selectedImageIndex = null)}
  />
{/if}
