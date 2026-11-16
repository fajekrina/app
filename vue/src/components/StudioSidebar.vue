<script setup lang="ts">
/**
 * The Studio's left panels (list + review requests), collapsible so the builder can use the
 * whole width. The choice is remembered per browser.
 */
import { ref } from 'vue'

const KEY = 'sdui-r:studio-sidebar'
const read = () => { try { return localStorage.getItem(KEY) !== 'closed' } catch { return true } }
const open = ref(read())
function toggle() {
  open.value = !open.value
  try { localStorage.setItem(KEY, open.value ? 'open' : 'closed') } catch { /* private mode: not remembered */ }
}
</script>

<template>
  <aside class="d-flex gap-2">
    <div v-if="open" id="studio-sidebar" class="builder-pane d-flex flex-column gap-3 overflow-y-auto overflow-x-hidden" style="width: 260px; min-width: 0">
      <slot />
    </div>
    <button
      type="button"
      class="builder-pane btn btn-light border px-1"
      style="width: 1.5rem"
      aria-controls="studio-sidebar"
      :aria-expanded="open"
      :title="open ? 'Tutup panel kiri' : 'Buka panel kiri'"
      @click="toggle"
    >{{ open ? '«' : '»' }}</button>
  </aside>
</template>
