<script lang="ts">
  import { UserRound, UserPlus, Check, X } from "@lucide/svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import {
    socialControllerAccept,
    socialControllerIgnore,
    socialControllerPeople,
    socialControllerRequests,
    socialControllerSend,
    socialControllerUnfollow,
  } from "$lib/api";
  import { userDisplayName } from "$lib/user-name";

  type Person = Awaited<ReturnType<typeof socialControllerPeople>>[number];
  type RequestItem = Awaited<
    ReturnType<typeof socialControllerRequests>
  >[number];
  let query = $state("");
  let people = $state<Person[]>([]);
  let requests = $state<RequestItem[]>([]);
  let loading = $state(false);
  let showRequests = $state(false);
  let error = $state("");

  async function search() {
    loading = true;
    error = "";
    try {
      people = (await socialControllerPeople({ query })) as Person[];
    } catch {
      error = "Could not load people.";
    } finally {
      loading = false;
    }
  }

  async function toggleFollow(person: Person) {
    try {
      if (person.relation.following) {
        await socialControllerUnfollow({ id: person.user.id });
        person.relation = { ...person.relation, following: false };
      } else if (!person.relation.outgoingRequest) {
        await socialControllerSend({ id: person.user.id });
        person.relation = { ...person.relation, outgoingRequest: true };
      }
    } catch {
      error = "Could not update the follow request.";
    }
  }

  async function loadRequests() {
    showRequests = !showRequests;
    if (showRequests)
      requests = (await socialControllerRequests({
        direction: "incoming",
      })) as RequestItem[];
  }

  async function accept(id: string) {
    await socialControllerAccept({ id });
    requests = requests.filter((request) => request.id !== id);
  }
  async function ignore(id: string) {
    await socialControllerIgnore({ id });
    requests = requests.filter((request) => request.id !== id);
  }

  $effect(() => {
    void search();
  });
</script>

<svelte:head><title>People · Kondis</title></svelte:head>

<div class="page-shell">
  <header class="page-header">
    <div>
      <span class="eyebrow">Social</span>
      <h1>People</h1>
      <p>Follow athletes and see their activities in your home feed.</p>
    </div>
    <button class="metadata-save" type="button" onclick={loadRequests}
      ><UserPlus size={16} /> Requests</button
    >
  </header>
  {#if showRequests}
    <section class="settings-panel" aria-label="Follow requests">
      <h2>Incoming requests</h2>
      {#if requests.length === 0}<p class="muted-copy">
          No pending requests.
        </p>{/if}
      {#each requests as request (request.id)}
        <div class="person-row">
          <UserAvatar
            name={userDisplayName(request.user)}
            src={request.user.avatarUrl}
            size={42}
          />
          <div class="person-copy">
            <strong>{userDisplayName(request.user)}</strong>
          </div>
          <button
            class="metadata-save"
            type="button"
            onclick={() => accept(request.id)}
            ><Check size={16} /> Accept</button
          ><button
            class="metadata-cancel"
            type="button"
            onclick={() => ignore(request.id)}><X size={16} /> Ignore</button
          >
        </div>
      {/each}
    </section>
  {/if}
  <form
    class="search"
    role="search"
    onsubmit={(event) => {
      event.preventDefault();
      void search();
    }}
  >
    <UserRound size={18} /><input
      bind:value={query}
      placeholder="Search by name"
      aria-label="Search people"
    /><button type="submit">Search</button>
  </form>
  {#if error}<p class="form-error">{error}</p>{/if}
  <section class="people-list" aria-label="People">
    {#each people as person (person.user.id)}
      <article class="person-row">
        <UserAvatar
          name={userDisplayName(person.user)}
          src={person.user.avatarUrl}
          size={42}
        />
        <div class="person-copy">
          <a href={`/people/${person.user.id}`}
            ><strong>{userDisplayName(person.user)}</strong></a
          >
        </div>
        <button
          class="metadata-save"
          type="button"
          disabled={person.relation.blockedViewer ||
            person.relation.blockedByViewer}
          onclick={() => toggleFollow(person)}
          >{person.relation.following
            ? "Following"
            : person.relation.outgoingRequest
              ? "Requested"
              : "Follow"}</button
        >
      </article>
    {/each}
    {#if !loading && people.length === 0}<div class="empty-state">
        <h2>No people found</h2>
        <p>Try a different name.</p>
      </div>{/if}
  </section>
</div>
