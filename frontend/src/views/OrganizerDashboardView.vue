<script setup>
import { onMounted, ref } from 'vue';
import ConfirmModal from '@/components/ConfirmModal.vue';
import { api } from '@/services/api.js';
import { useToast } from '@/composables/useToast.js';
import { CATEGORY_LABELS, formatDateLong } from '@/utils/format.js';

const toast = useToast();
const events = ref([]);
const loading = ref(true);
const errorMessage = ref('');
const toDelete = ref(null);
const deleting = ref(false);

const STATUS = {
  published: ['Publicado', 'bg-ok/15 text-ok'],
  draft: ['Borrador', 'bg-gold-300/40 text-earth-700'],
  cancelled: ['Cancelado', 'bg-danger/10 text-danger'],
};

async function load() {
  loading.value = true;
  errorMessage.value = '';
  try { events.value = (await api.organizerEvents()).items; }
  catch (err) { errorMessage.value = err.message; }
  finally { loading.value = false; }
}

async function confirmDelete() {
  deleting.value = true;
  try {
    await api.deleteEvent(toDelete.value.id);
    events.value = events.value.filter((e) => e.id !== toDelete.value.id);
    toast.success('Evento eliminado.');
    toDelete.value = null;
  } catch (err) { toast.error(err.message); }
  finally { deleting.value = false; }
}

const reserved = (e) => e.capacity - e.available_spots;
const percent = (e) => Math.round((reserved(e) / e.capacity) * 100);

onMounted(load);
</script>

<template>
  <div class="container-page pt-12">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-3xl text-plum-900">Panel del organizador</h1>
      <router-link :to="{ name: 'event-new' }" class="btn-primary">Crear evento</router-link>
    </div>

    <div v-if="loading" class="mt-8 space-y-4" aria-hidden="true"><div v-for="n in 3" :key="n" class="skeleton h-28 rounded-2xl"></div></div>
    <div v-else-if="errorMessage" class="card mt-8 p-8 text-center" role="alert"><p>{{ errorMessage }}</p><button class="btn-primary mt-4" @click="load">Reintentar</button></div>
    <div v-else-if="!events.length" class="card mt-8 p-10 text-center">
      <p class="text-lg text-plum-900">Todavía no creaste eventos</p>
      <p class="mt-1 text-sm text-ink/70">Publicá tu primera función y empezá a recibir inscripciones.</p>
      <router-link :to="{ name: 'event-new' }" class="btn-primary mt-5">Crear mi primer evento</router-link>
    </div>

    <ul v-else class="mt-8 space-y-4">
      <li v-for="e in events" :key="e.id" class="card flex flex-col gap-4 p-5 md:flex-row md:items-center">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="truncate text-lg text-plum-900">{{ e.title }}</h2>
            <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="STATUS[e.status][1]">{{ STATUS[e.status][0] }}</span>
          </div>
          <p class="mt-1 text-sm capitalize text-ink/70">{{ formatDateLong(e.starts_at) }} h · {{ CATEGORY_LABELS[e.category] }}</p>
          <div class="mt-3 max-w-sm">
            <div class="flex justify-between text-xs text-ink/70"><span>{{ reserved(e) }} de {{ e.capacity }} lugares</span><span>{{ percent(e) }}%</span></div>
            <div class="mt-1 h-2 overflow-hidden rounded-full bg-plum-100"><div class="h-full rounded-full bg-gold-500 transition-all duration-700" :style="{ width: percent(e) + '%' }"></div></div>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <router-link :to="{ name: 'attendees', params: { id: e.id } }" class="btn-gold !px-4">Inscriptos</router-link>
          <router-link :to="{ name: 'event-edit', params: { id: e.id } }" class="btn-ghost !px-4">Editar</router-link>
          <button class="btn-ghost !px-4 !text-danger" @click="toDelete = e">Eliminar</button>
        </div>
      </li>
    </ul>

    <ConfirmModal :open="Boolean(toDelete)" title="¿Eliminar este evento?" confirm-text="Sí, eliminar" danger :loading="deleting" @confirm="confirmDelete" @cancel="toDelete = null">
      <p>Se eliminará <strong>{{ toDelete?.title }}</strong> junto con todas sus inscripciones. Esta acción no se puede deshacer. Si solo querés darlo de baja, cambiá su estado a “Cancelado”.</p>
    </ConfirmModal>
  </div>
</template>
