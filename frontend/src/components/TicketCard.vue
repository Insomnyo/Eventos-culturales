<script setup>
import { formatDateLong, formatDateShort, formatDni, shortTicket } from '@/utils/format.js';
import StatusBadge from './StatusBadge.vue';

// `dni`: DNI del titular (todas las entradas de "Mis entradas" son de la misma persona).
defineProps({ reservation: { type: Object, required: true }, cancellable: Boolean, dni: { type: String, default: null }, upcoming: { type: Boolean, default: true } });
defineEmits(['cancel']);
</script>

<template>
  <article class="card flex overflow-hidden">
    <div class="flex-1 p-5">
      <router-link :to="{ name: 'event', params: { id: reservation.event.id } }" class="text-lg text-plum-700 hover:underline">{{ reservation.event.title }}</router-link>
      <p class="mt-1 text-sm capitalize text-ink/70">{{ formatDateLong(reservation.event.starts_at) }} h</p>
      <p class="text-sm text-ink/70">{{ reservation.event.location }}</p>
      <p v-if="upcoming && reservation.date_changed && reservation.event.status !== 'cancelled' && reservation.previous_starts_at" class="mt-2 rounded-lg bg-gold-300/30 px-3 py-2 text-sm text-earth-700">
        Cambió el día u horario. Antes era el <span class="font-medium">{{ formatDateShort(reservation.previous_starts_at) }}</span>; ahora es el nuevo de arriba. Si no podés ir, cancelá tu reserva para liberar el lugar.
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <span v-if="reservation.event.status === 'cancelled'" class="inline-flex items-center gap-1.5 rounded-full bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger"><span aria-hidden="true">✕</span>Evento cancelado</span>
        <template v-else>
          <span v-if="upcoming && reservation.date_changed" class="inline-flex items-center gap-1.5 rounded-full bg-gold-300/50 px-2.5 py-1 text-xs font-semibold text-earth-700"><span aria-hidden="true">◷</span>Fecha modificada</span>
          <StatusBadge :status="reservation.attendance_status" />
        </template>
        <button v-if="cancellable" class="text-sm font-medium text-danger underline-offset-2 hover:underline" @click="$emit('cancel')">Cancelar reserva</button>
      </div>
    </div>
    <!-- "Talón" del ticket -->
    <div class="relative flex w-40 shrink-0 flex-col items-center justify-center border-l-2 border-dashed border-gold-500 bg-plum-100 p-4 text-center">
      <span class="text-[11px] font-semibold text-earth-600">Tu código</span>
      <span class="mt-1 font-display text-2xl tracking-wider text-plum-900">{{ shortTicket(reservation.ticket_code) }}</span>
      <span class="mt-1 break-all text-[10px] text-ink/50">{{ reservation.ticket_code }}</span>
      <span v-if="dni" class="mt-2 text-[11px] font-semibold text-earth-700">DNI {{ formatDni(dni) }}</span>
    </div>
  </article>
</template>
