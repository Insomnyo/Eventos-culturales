<script setup>
import { onMounted, ref, watch } from 'vue';
import CurtainHero from '@/components/CurtainHero.vue';
import EventCard from '@/components/EventCard.vue';
import EventCardSkeleton from '@/components/EventCardSkeleton.vue';
import { api } from '@/services/api.js';
import { CATEGORY_LABELS } from '@/utils/format.js';

const events = ref([]);
const loading = ref(true);
const loadingMore = ref(false);
const errorMessage = ref('');
const category = ref('');
const search = ref('');
const page = ref(1);
const total = ref(0);
const listSection = ref(null);
let searchTimer;

async function load({ append = false } = {}) {
  errorMessage.value = '';
  append ? (loadingMore.value = true) : (loading.value = true);
  try {
    const params = { page: page.value };
    if (category.value) params.category = category.value;
    if (search.value.trim()) params.q = search.value.trim();
    const result = await api.listEvents(params);
    events.value = append ? [...events.value, ...result.items] : result.items;
    total.value = result.total;
  } catch (err) {
    errorMessage.value = err.message;
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function resetAndLoad() { page.value = 1; load(); }
watch(category, resetAndLoad);
watch(search, () => { clearTimeout(searchTimer); searchTimer = setTimeout(resetAndLoad, 350); });
function loadMore() { page.value += 1; load({ append: true }); }
const scrollToList = () => listSection.value?.scrollIntoView({ behavior: 'smooth' });

onMounted(load);
</script>

<template>
  <CurtainHero @browse="scrollToList" />

  <section ref="listSection" class="container-page pt-14">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <h2 class="text-3xl text-plum-900">Cartelera</h2>
      <div class="w-full sm:max-w-xs">
        <label for="buscar" class="sr-only">Buscar por título</label>
        <input id="buscar" v-model="search" type="search" maxlength="80" class="field" placeholder="Buscar por título" />
      </div>
    </div>

    <div class="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
      <button class="rounded-full px-4 py-1.5 text-sm font-medium transition" :class="category === '' ? 'bg-plum-700 text-white' : 'bg-white text-plum-700 hover:bg-plum-100'" :aria-pressed="category === ''" @click="category = ''">Todo</button>
      <button v-for="(label, key) in CATEGORY_LABELS" :key="key" class="rounded-full px-4 py-1.5 text-sm font-medium transition" :class="category === key ? 'bg-plum-700 text-white' : 'bg-white text-plum-700 hover:bg-plum-100'" :aria-pressed="category === key" @click="category = key">{{ label }}</button>
    </div>

    <div v-if="loading" class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"><EventCardSkeleton v-for="n in 6" :key="n" /></div>

    <div v-else-if="errorMessage" class="card mt-8 p-8 text-center" role="alert">
      <p class="text-lg text-plum-900">No pudimos cargar la cartelera</p>
      <p class="mt-1 text-sm text-ink/70">{{ errorMessage }}</p>
      <button class="btn-primary mt-4" @click="resetAndLoad">Reintentar</button>
    </div>

    <div v-else-if="!events.length" class="card mt-8 p-10 text-center">
      <p class="text-lg text-plum-900">No hay funciones con esos filtros</p>
      <p class="mt-1 text-sm text-ink/70">Probá quitar la categoría o buscar con otras palabras.</p>
    </div>

    <template v-else>
      <div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <EventCard v-for="event in events" :key="event.id" :event="event" />
      </div>
      <div v-if="events.length < total" class="mt-10 text-center">
        <button class="btn-ghost" :disabled="loadingMore" @click="loadMore">{{ loadingMore ? 'Cargando…' : 'Ver más funciones' }}</button>
      </div>
    </template>
  </section>
</template>
