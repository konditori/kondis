<script lang="ts">
  import { MessageCircle, Send, Trash2 } from "@lucide/svelte";
  import {
    getSdkRequestOptions,
    socialControllerComment,
    socialControllerComments,
    socialControllerDeleteComment,
  } from "$lib/api";
  import type { ActivityDetail } from "$lib/types";
  import { userDisplayName } from "$lib/user-name";

  let { activity }: { activity: ActivityDetail } = $props();
  type Comment = {
    id: string;
    body: string;
    createdAt: string;
    updatedAt: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    };
  };
  let comments = $state<Comment[]>([]);
  let body = $state("");
  let loading = $state(true);
  let sending = $state(false);
  let error = $state("");

  async function load() {
    loading = true;
    try {
      const result = await socialControllerComments(
        { id: activity.id, cursor: "", limit: "50" },
        getSdkRequestOptions(),
      );
      comments = result.comments as Comment[];
    } catch {
      error = "Could not load comments.";
    } finally {
      loading = false;
    }
  }
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!body.trim() || sending) return;
    sending = true;
    try {
      const result = await socialControllerComment(
        { id: activity.id, commentCreateDto: { body: body.trim() } },
        getSdkRequestOptions(),
      );
      comments = [result as Comment, ...comments];
      body = "";
    } catch {
      error = "Could not add comment.";
    } finally {
      sending = false;
    }
  }
  async function remove(id: string) {
    try {
      await socialControllerDeleteComment(
        { activityId: activity.id, commentId: id },
        getSdkRequestOptions(),
      );
      comments = comments.filter((comment) => comment.id !== id);
    } catch {
      error = "Could not delete comment.";
    }
  }
  $effect(() => {
    void load();
  });
</script>

<section id="comments" class="activity-comments" aria-label="Comments">
  <div class="section-heading">
    <MessageCircle size={19} />
    <h2>Comments</h2>
  </div>
  <form class="comment-form" onsubmit={submit}>
    <input
      bind:value={body}
      maxlength="2000"
      placeholder="Add a comment"
      aria-label="Comment"
    /><button type="submit" disabled={sending || !body.trim()}
      ><Send size={16} /> Comment</button
    >
  </form>
  {#if error}<p class="form-error">{error}</p>{/if}
  {#if loading}<p class="muted-copy">
      Loading comments…
    </p>{:else if comments.length === 0}<p class="muted-copy">
      Be the first to comment.
    </p>{:else}
    <div class="comment-list">
      {#each comments as comment (comment.id)}<article class="comment-row">
          <div class="person-copy">
            <strong>{userDisplayName(comment.user)}</strong><span>{comment.body}</span>
          </div>
          <button
            class="icon-button"
            type="button"
            aria-label="Delete comment"
            onclick={() => remove(comment.id)}><Trash2 size={15} /></button
          >
        </article>{/each}
    </div>
  {/if}
</section>
