<script lang="ts">
  import { MoreVertical, Pencil, Send, Trash2, X } from "@lucide/svelte";
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
  import { t } from "$lib/i18n";
  import { userDisplayName } from "$lib/user-name";
  import { subscribeToActivityEvents } from "$lib/realtime";
  import { onMount } from "svelte";

  let {
    activity,
    viewerId,
    eventsUrl,
    viewerName = "You",
    viewerAvatarUrl,
  }: {
    activity: ActivityDetail;
    viewerId?: string;
    eventsUrl: string;
    viewerName?: string;
    viewerAvatarUrl?: string | null;
  } = $props();
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
  const locallyAddedCommentIds = new Set<string>();

  function sortChronologically(items: Comment[]): Comment[] {
    return [...items].sort(
      (left, right) =>
        Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
        left.id.localeCompare(right.id),
    );
  }

  function upsertComment(comment: Comment) {
    comments = sortChronologically([
      ...comments.filter((item) => item.id !== comment.id),
      comment,
    ]);
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
      body = "";
      const comment = result as Comment;
      if (!comments.some((item) => item.id === comment.id)) {
        locallyAddedCommentIds.add(comment.id);
      }
      upsertComment(comment);
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

  onMount(() =>
    subscribeToActivityEvents(
      eventsUrl,
      (event) => {
        if (
          event.type === "activity.comment.created" &&
          event.activity.id === activity.id
        ) {
          if (event.comment) {
            if (locallyAddedCommentIds.delete(event.comment.id)) return;
            upsertComment(event.comment);
          } else {
            void load();
          }
        } else if (
          (event.type === "activity.comment.updated" ||
            event.type === "activity.comment.deleted") &&
          event.activity.id === activity.id
        ) {
          void load();
        }
      },
      () => {},
      { activityId: activity.id },
    ),
  );
</script>

<section id="comments" class="activity-comments" aria-label={t("comments")}>
  {#if error}<p class="form-error" role="alert">{error}</p>{/if}
  {#if loading}
    <p class="muted-copy">{t("loading_comments")}</p>
  {:else if comments.length}
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
                  aria-label={t("edit_comment")}
                />
                <button type="submit" disabled={saving || !editingBody.trim()}
                  >{t("common_save")}</button
                >
                <button
                  type="button"
                  class="comment-cancel"
                  onclick={cancelEdit}
                  ><X size={15} /> {t("common_cancel")}</button
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
                aria-label={t("comment_actions")}
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
                    ><Pencil size={14} /> {t("edit")}</button
                  >
                  <button
                    type="button"
                    role="menuitem"
                    class="comment-delete"
                    onclick={() => void remove(comment.id)}
                    ><Trash2 size={14} /> {t("common_delete")}</button
                  >
                </div>
              {/if}
            </div>
          {/if}
        </article>
      {/each}
    </div>
  {/if}
  <div class="comment-composer">
    <UserAvatar name={viewerName} src={viewerAvatarUrl} size={44} />
    <form class="comment-form" onsubmit={submit}>
      <input
        bind:value={body}
        maxlength="2000"
        placeholder={t("add_a_comment")}
        aria-label={t("comment")}
      />
      <button
        type="submit"
        disabled={sending || !body.trim()}
        aria-label={t("send_comment")}
        title={t("send_comment")}
      >
        <Send size={16} />
      </button>
    </form>
  </div>
</section>
