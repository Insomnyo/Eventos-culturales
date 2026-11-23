<script setup>
import { nextTick, ref, watch } from 'vue';

const props = defineProps({
  open: Boolean,
  title: { type: String, required: true },
  confirmText: { type: String, default: 'Confirmar' },
  cancelText: { type: String, default: 'Cancelar' },
  danger: Boolean,
  loading: Boolean,
  confirmDisabled: Boolean,
});
const emit = defineEmits(['confirm', 'cancel']);
const panel = ref(null);

// Foco dentro del modal al abrir (accesibilidad) y cierre con Escape.
watch(() => props.open, async (isOpen) => {
  if (isOpen) { await nextTick(); panel.value?.focus(); }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-4 backdrop-blur-sm sm:items-center" @click.self="emit('cancel')" @keydown.esc="emit('cancel')">
        <div ref="panel" tabindex="-1" role="dialog" aria-modal="true" :aria-label="title" class="modal-panel card w-full max-w-md p-6 outline-none">
          <h2 class="text-2xl text-plum-900">{{ title }}</h2>
          <div class="mt-3 text-sm text-ink/80"><slot /></div>
          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button class="btn-ghost" :disabled="loading" @click="emit('cancel')">{{ cancelText }}</button>
            <button :class="danger ? 'btn-danger' : 'btn-primary'" :disabled="loading || confirmDisabled" @click="emit('confirm')">
              <span v-if="loading" class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true"></span>
              {{ loading ? 'Procesando…' : confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
