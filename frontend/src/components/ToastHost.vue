<script setup>
import { useToast } from '@/composables/useToast.js';
const { toasts, dismiss } = useToast();
const styles = { success: 'bg-ok text-white', error: 'bg-danger text-white', info: 'bg-plum-900 text-white' };
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="pointer-events-auto flex max-w-md items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-lift" :class="styles[t.type]">
        <span>{{ t.message }}</span>
        <button class="-mr-1 shrink-0 opacity-70 hover:opacity-100" aria-label="Cerrar aviso" @click="dismiss(t.id)">✕</button>
      </div>
    </TransitionGroup>
  </div>
</template>
