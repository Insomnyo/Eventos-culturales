<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import CoverUpload from '@/components/CoverUpload.vue';
import { api } from '@/services/api.js';
import { useToast } from '@/composables/useToast.js';
import { CATEGORY_LABELS, toLocalInputValue } from '@/utils/format.js';
import { collectErrors, eventFormSchema } from '@/utils/validation.js';

const props = defineProps({ id: { type: String, default: null } });
const router = useRouter();
const toast = useToast();

const isEdit = computed(() => Boolean(props.id));
const form = ref({ title: '', description: '', category: '', startsAtLocal: '', location: '', capacity: 100, status: 'published' });
const errors = ref({});
const formError = ref('');
const loading = ref(false);
const loadingEvent = ref(false);
const coverFile = ref(null);
const currentCoverUrl = ref(null);

onMounted(async () => {
  if (!isEdit.value) return;
  loadingEvent.value = true;
  try {
    const { event } = await api.getEvent(props.id);
    form.value = {
      title: event.title, description: event.description, category: event.category,
      startsAtLocal: toLocalInputValue(event.starts_at), location: event.location, capacity: event.capacity, status: event.status,
    };
    currentCoverUrl.value = event.cover_url;
  } catch (err) {
    toast.error(err.message);
    router.replace({ name: 'organizer' });
  } finally { loadingEvent.value = false; }
});

async function submit() {
  formError.value = '';
  const check = collectErrors(eventFormSchema, form.value);
  errors.value = check.errors ?? {};
  if (check.errors) return;

  const { startsAtLocal, ...rest } = check.data;
  const payload = { ...rest, starts_at: new Date(startsAtLocal).toISOString() };
  if (!isEdit.value && payload.status === 'cancelled') payload.status = 'draft';

  loading.value = true;
  try {
    const { event } = isEdit.value ? await api.updateEvent(props.id, payload) : await api.createEvent(payload);
    if (coverFile.value) {
      try { await api.uploadCover(event.id, coverFile.value); }
      catch (err) { toast.error(`El evento se guardó, pero la imagen no: ${err.message}`); }
    }
    toast.success(isEdit.value ? 'Cambios guardados.' : 'Evento creado.');
    router.push({ name: 'organizer' });
  } catch (err) {
    formError.value = err.message;
    if (Array.isArray(err.details)) err.details.forEach((d) => { errors.value[d.field] ??= d.message; });
  } finally { loading.value = false; }
}
</script>

<template>
  <div class="container-page max-w-3xl pt-12">
    <h1 class="text-3xl text-plum-900">{{ isEdit ? 'Editar evento' : 'Nuevo evento' }}</h1>

    <div v-if="loadingEvent" class="mt-8 space-y-4" aria-hidden="true"><div v-for="n in 4" :key="n" class="skeleton h-14 rounded-xl"></div></div>

    <form v-else class="card mt-8 space-y-5 p-6 sm:p-8" novalidate @submit.prevent="submit">
      <p v-if="formError" class="rounded-lg bg-danger/10 p-3 text-sm text-danger" role="alert">{{ formError }}</p>

      <div>
        <label class="label" for="title">Título</label>
        <input id="title" v-model="form.title" class="field" maxlength="120" required />
        <p v-if="errors.title" class="field-error">{{ errors.title }}</p>
      </div>
      <div>
        <label class="label" for="description">Descripción</label>
        <textarea id="description" v-model="form.description" class="field min-h-36" maxlength="4000" required></textarea>
        <p class="mt-1 text-xs text-ink/50">Texto simple. No se permite HTML.</p>
        <p v-if="errors.description" class="field-error">{{ errors.description }}</p>
      </div>

      <div class="grid gap-5 sm:grid-cols-2">
        <div>
          <label class="label" for="category">Categoría</label>
          <select id="category" v-model="form.category" class="field" required>
            <option value="" disabled>Elegí una opción</option>
            <option v-for="(label, key) in CATEGORY_LABELS" :key="key" :value="key">{{ label }}</option>
          </select>
          <p v-if="errors.category" class="field-error">{{ errors.category }}</p>
        </div>
        <div>
          <label class="label" for="startsAt">Fecha y hora</label>
          <input id="startsAt" v-model="form.startsAtLocal" class="field" type="datetime-local" required />
          <p v-if="errors.startsAtLocal" class="field-error">{{ errors.startsAtLocal }}</p>
        </div>
      </div>

      <div>
        <label class="label" for="location">Lugar</label>
        <input id="location" v-model="form.location" class="field" maxlength="200" required />
        <p v-if="errors.location" class="field-error">{{ errors.location }}</p>
      </div>

      <div class="grid gap-5 sm:grid-cols-2">
        <div>
          <label class="label" for="capacity">Cupo máximo (aforo)</label>
          <input id="capacity" v-model.number="form.capacity" class="field" type="number" min="1" max="5000" required />
          <p v-if="errors.capacity" class="field-error">{{ errors.capacity }}</p>
        </div>
        <div>
          <label class="label" for="status">Estado</label>
          <select id="status" v-model="form.status" class="field">
            <option value="published">Publicado</option>
            <option value="draft">Borrador</option>
            <option v-if="isEdit" value="cancelled">Cancelado</option>
          </select>
        </div>
      </div>

      <CoverUpload :current-url="currentCoverUrl" @select="coverFile = $event" />

      <div class="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <router-link :to="{ name: 'organizer' }" class="btn-ghost">Cancelar</router-link>
        <button class="btn-primary" :disabled="loading">{{ loading ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear evento' }}</button>
      </div>
    </form>
  </div>
</template>
