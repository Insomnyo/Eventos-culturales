<script setup>
import { computed } from 'vue';

// Estado visual de asistencia: pendiente / asistió / no asistió.
const props = defineProps({ status: { type: String, required: true } });
const config = {
  pending:  { label: 'Pendiente',   classes: 'bg-gold-300/40 text-earth-700', icon: '◔' },
  attended: { label: 'Asistió',     classes: 'bg-ok/15 text-ok',              icon: '✓' },
  no_show:  { label: 'No asistió',  classes: 'bg-danger/10 text-danger',      icon: '✕' },
};
const view = computed(() => config[props.status] ?? config.pending);
</script>

<template>
  <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" :class="view.classes">
    <span aria-hidden="true">{{ view.icon }}</span>{{ view.label }}
  </span>
</template>
