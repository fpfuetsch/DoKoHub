<script lang="ts">
  export let data: { valid: boolean; groupId?: string; token?: string };
</script>

{#if !data.valid}
  <div class="p-4">
    <h2 class="text-lg font-semibold">Ungültiger Invite</h2>
    <p>Der Einladungslink ist ungültig oder abgelaufen.</p>
  </div>
{:else}
  <div class="p-4">
    <h2 class="text-lg font-semibold">Gruppe beitreten</h2>
    <p>Du wurdest eingeladen, der Gruppe beizutreten.</p>

    <form method="post">
      <input type="hidden" name="token" value="{data.token}" />
      <button type="submit" name="accept" class="btn btn-primary mt-4">Beitreten</button>
    </form>
  </div>
{/if}
