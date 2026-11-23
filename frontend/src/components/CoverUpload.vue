<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { COVER_RULES } from '@/utils/validation.js';

const props = defineProps({ currentUrl: { type: String, default: null } });
const emit = defineEmits(['select']);
const preview = ref(props.currentUrl);
const error = ref('');
let objectUrl = null;

watch(() => props.currentUrl, (url) => { if (!objectUrl) preview.value = url; });
onBeforeUnmount(() => objectUrl && URL.revokeObjectURL(objectUrl));

function onChange(event) {
  const file = event.target.files?.[0];
  error.value = '';
  if (!file) return;
  // Validación en el cliente solo por UX; el backend revalida tipo real (magic bytes) y tamaño.
  if (!COVER_RULES.types.includes(file.type)) { error.value = 'Usá una imagen JPG, PNG o WebP.'; event.target.value = ''; return; }
  if (file.size > COVER_RULES.maxBytes) { error.value = 'La imagen no puede superar los 2 MB.'; event.target.value = ''; return; }
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  preview.value = objectUrl;
  emit('select', file);
}
</script>

<template>
  <div>
    <span class="label">Imagen de portada</span>
    <label class="group flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-plum-200 bg-white text-center transition hover:border-plum-500">
      <img v-if="preview" :src="preview" alt="Vista previa de la portada" class="aspect-[16/9] w-full object-cover" />
      <div v-else class="p-10 text-sm text-ink/60">Tocá para elegir una imagen<br /><span class="text-xs">JPG, PNG o WebP · hasta 2 MB</span></div>
      <input type="file" class="sr-only" accept="image/jpeg,image/png,image/webp" @change="onChange" />
    </label>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
  </div>
</template>
