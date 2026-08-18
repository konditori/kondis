<script lang="ts">
  import {
    MessageCircle,
    MoreVertical,
    Pencil,
    Send,
    Trash2,
    X,
  } from "@lucide/svelte";
  import {
    getSdkRequestOptions,
    socialControllerComment,
    socialControllerComments,
    socialControllerDeleteComment,
    socialControllerUpdateComment,
  } from "$lib/api";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import type { ActivityDetail } from "$lib/types";
  import { relativeTime } from "$lib/format";
  import { userDisplayName } from "$lib/user-name";

  let { activity, viewerId }: { activity: ActivityDetail; viewerId?: string } =
    $props();
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
  let editingId = $state<string | null>(null);
  let editingBody = $state("");
  let openMenuId = $state<string | null>(null);
  let loading = $state(true);
  let sending = $state(false);
  let saving = $state(false);
  let error = $state("");

  function sortChronologically(items: Comment[]): Comment[] {
    return [...items].sort(
      (left, right) =>
        Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
        left.id.localeCompare(right.id),
    );
  }

  async function load() {
    loading = true;
    try {
      const result = await socialControllerComments(
        { id: activity.id, cursor: "", limit: "50" },
        getSdkRequestOptions(),
      );
      comments = sortChronologically(result.comments as Comment[]);
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
    error = "";
    try {
      const result = await socialControllerComment(
        { id: activity.id, commentCreateDto: { body: body.trim() } },
        getSdkRequestOptions(),
      );
      comments = sortChronologically([...comments, result as Comment]);
      body = "";
    } catch {
      error = "Could not add comment.";
    } finally {
      sending = false;
    }
  }

  function beginEdit(comment: Comment) {
    editingId = comment.id;
    editingBody = comment.body;
    openMenuId = null;
  }

  function cancelEdit() {
    editingId = null;
    editingBody = "";
  }

  async function saveEdit(comment: Comment) {
    if (!editingBody.trim() || saving) return;
    saving = true;
    error = "";
    try {
      const result = await socialControllerUpdateComment(
        {
          activityId: activity.id,
          commentId: comment.id,
          commentUpdateDto: { body: editingBody.trim() },
        },
        getSdkRequestOptions(),
      );
      comments = comments.map((item) =>
        item.id === comment.id ? (result as Comment) : item,
      );
      cancelEdit();
    } catch {
      error = "Could not edit comment.";
    } finally {
      saving = false;
    }
  }

  async function remove(id: string) {
    openMenuId = null;
    error = "";
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
    />
    <button type="submit" disabled={sending || !body.trim()}>
      <Send size={16} /> Comment
    </button>
  </form>
  {#if error}<p class="form-error" role="alert">{error}</p>{/if}
  {#if loading}
    <p class="muted-copy">Loading comments…</p>
  {:else if comments.length === 0}
    <p class="muted-copy">Be the first to comment.</p>
  {:else}
    <div class="comment-list">
      {#each comments as comment (comment.id)}
        <article class="comment-row">
          <UserAvatar
            name={userDisplayName(comment.user)}
            src={comment.user.avatarUrl}
            size={38}
          />
          <div class="person-copy">
            <div class="comment-meta">
              <strong>{userDisplayName(comment.user)}</strong>
              <time datetime={comment.createdAt}
                >{relativeTime(comment.createdAt)}</time
              >
            </div>
            {#if editingId === comment.id}
              <form
                class="comment-edit-form"
                onsubmit={(event) => {
                  event.preventDefault();
                  void saveEdit(comment);
                }}
              >
                <input
                  bind:value={editingBody}
                  maxlength="2000"
                  aria-label="Edit comment"
                />
                <button type="submit" disabled={saving || !editingBody.trim()}
                  >Save</button
                >
                <button
                  type="button"
                  class="comment-cancel"
                  onclick={cancelEdit}><X size={15} /> Cancel</button
                >
              </form>
            {:else}
              <p>{comment.body}</p>
            {/if}
          </div>
          {#if viewerId === comment.user.id && editingId !== comment.id}
            <div class="comment-menu">
              <button
                class="comment-menu-trigger"
                type="button"
                aria-label="Comment actions"
                aria-expanded={openMenuId === comment.id}
                onclick={() =>
                  (openMenuId = openMenuId === comment.id ? null : comment.id)}
                ><MoreVertical size={17} /></button
              >
              {#if openMenuId === comment.id}
                <div class="comment-menu-popover" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onclick={() => beginEdit(comment)}
                    ><Pencil size={14} /> Edit</button
                  >
                  <button
                    type="button"
                    role="menuitem"
                    class="comment-delete"
                    onclick={() => void remove(comment.id)}
                    ><Trash2 size={14} /> Delete</button
                  >
                </div>
              {/if}
            </div>
          {/if}
        </article>
      {/each}
    </div>
  {/if}
</section>
