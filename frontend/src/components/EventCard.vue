<script setup>
import { computed } from 'vue';
import { CATEGORY_LABELS, formatDay, formatMonthShort, formatTime } from '@/utils/format.js';

const props = defineProps({ event: { type: Object, required: true } });
const soldOut = computed(() => props.event.available_spots <= 0);
const lastSpots = computed(() => !soldOut.value && props.event.available_spots <= 10);
</script>

<template>
  <router-link :to="{ name: 'event', params: { id: event.id } }" class="group card block overflow-hidden transition duration-200 hover:-translate-y-1 hover:shadow-lift">
    <div class="relative aspect-[16/10] overflow-hidden bg-plum-700">
      <img v-if="event.cover_url" :src="event.cover_url" :alt="`Portada de ${event.title}`" loading="lazy" class="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
      <div v-else class="flex h-full w-full items-center justify-center bg-gradient-to-br from-plum-700 via-plum-900 to-ink">
        <span class="font-display text-6xl text-gold-500/70">{{ (CATEGORY_LABELS[event.category] ?? '?').charAt(0) }}</span>
      </div>
      <div class="absolute left-3 top-3 rounded-xl bg-white px-3 py-1.5 text-center leading-tight shadow-card">
        <div class="font-display text-xl text-plum-700">{{ formatDay(event.starts_at) }}</div>
        <div class="text-[11px] font-semibold text-earth-600">{{ formatMonthShort(event.starts_at) }}</div>
      </div>
      <span class="absolute right-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-medium text-white">{{ CATEGORY_LABELS[event.category] }}</span>
    </div>
    <div class="space-y-2 p-5">
      <h3 class="line-clamp-2 text-lg leading-snug text-ink">{{ event.title }}</h3>
      <p class="text-sm text-ink/70">{{ formatTime(event.starts_at) }} h · {{ event.location }}</p>
      <p class="pt-1 text-sm font-semibold" :class="soldOut ? 'text-danger' : lastSpots ? 'text-warn' : 'text-ok'">
        {{ soldOut ? 'Agotado' : lastSpots ? `¡Quedan ${event.available_spots}!` : `${event.available_spots} lugares disponibles` }}
      </p>
    </div>
  </router-link>
</template>
