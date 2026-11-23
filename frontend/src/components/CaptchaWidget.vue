<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

// hCaptcha. Si no hay site key configurada (desarrollo), el componente no renderiza nada y
// el backend omite la verificación SOLO fuera de producción.
const siteKey = import.meta.env.VITE_HCAPTCHA_SITE_KEY;
const model = defineModel({ type: String, default: '' });
const container = ref(null);
let widgetId = null;

function loadScript() {
  if (window.hcaptcha) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('hcaptcha-script');
    if (existing) { existing.addEventListener('load', resolve); return; }
    const script = document.createElement('script');
    script.id = 'hcaptcha-script';
    script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

onMounted(async () => {
  if (!siteKey) return;
  try {
    await loadScript();
    widgetId = window.hcaptcha.render(container.value, {
      sitekey: siteKey,
      callback: (token) => { model.value = token; },
      'expired-callback': () => { model.value = ''; },
      'error-callback': () => { model.value = ''; },
    });
  } catch { /* si falla la carga, el formulario mostrará el error del servidor al enviar */ }
});
onBeforeUnmount(() => { if (widgetId !== null && window.hcaptcha) window.hcaptcha.remove(widgetId); });

/** Cada token sirve una sola vez: se reinicia tras cada intento. */
function reset() {
  model.value = '';
  if (widgetId !== null && window.hcaptcha) window.hcaptcha.reset(widgetId);
}
defineExpose({ reset, enabled: Boolean(siteKey) });
</script>

<template>
  <div v-if="siteKey" ref="container" class="min-h-[78px]"></div>
</template>
