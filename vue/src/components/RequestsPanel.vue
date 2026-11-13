<script setup lang="ts">
/** Pending review requests: the checker approves / rejects; the requester may withdraw. */
import { ref } from 'vue'
import type { RequestRow } from '../api/studio'

const props = defineProps<{
  title: string
  rows: RequestRow[]
  me: string
  canDecide: boolean
  onDecide: (id: number, decision: 'approve' | 'reject' | 'withdraw', reason?: string) => Promise<void>
}>()
const busy = ref<number>()
const error = ref<string>()

async function act(id: number, decision: 'approve' | 'reject' | 'withdraw') {
  const reason = decision === 'reject' ? window.prompt('Alasan penolakan') ?? undefined : undefined
  if (decision === 'reject' && !reason) return
  busy.value = id
  error.value = undefined
  try { await props.onDecide(id, decision, reason) } catch (e) { error.value = (e as Error).message } finally { busy.value = undefined }
}
</script>

<template>
  <section class="card card-body p-3 small">
    <h3 class="h6">{{ title }}</h3>
    <p v-if="rows.length === 0" class="text-secondary mb-0">Tidak ada pengajuan.</p>
    <ul class="list-unstyled mb-0">
      <li v-for="r in rows" :key="r.id" class="border rounded p-2 mb-2">
        <div><span class="font-monospace">{{ r.key }}</span> <span class="text-secondary">rev {{ r.revision }} · {{ r.requestedBy.replace(/^workforce:/, '') }}</span></div>
        <p v-if="r.note" class="mb-1">“{{ r.note }}”</p>
        <div class="d-flex gap-2 align-items-center">
          <template v-if="canDecide && r.requestedBy !== me">
            <button class="btn btn-sm btn-success" :disabled="busy === r.id" @click="act(r.id, 'approve')">Setujui &amp; terbitkan</button>
            <button class="btn btn-sm btn-outline-danger" :disabled="busy === r.id" @click="act(r.id, 'reject')">Tolak</button>
          </template>
          <template v-if="r.requestedBy === me">
            <button class="btn btn-sm btn-light" :disabled="busy === r.id" @click="act(r.id, 'withdraw')">Tarik</button>
            <span v-if="canDecide" class="text-secondary">maker-checker: orang lain yang menyetujui</span>
          </template>
        </div>
      </li>
    </ul>
    <p v-if="error" class="text-danger mt-2 mb-0">{{ error }}</p>
  </section>
</template>
