<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CaptchaWidget from '@/components/CaptchaWidget.vue';
import { useAuthStore } from '@/stores/auth.js';
import { useToast } from '@/composables/useToast.js';
import { safeRedirect } from '@/router/index.js';
import { collectErrors, loginSchema } from '@/utils/validation.js';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const toast = useToast();

const form = ref({ identifier: '', password: '' });
const errors = ref({});
const formError = ref('');
const loading = ref(false);
const captchaToken = ref('');
const captcha = ref(null);

async function submit() {
  formError.value = '';
  const check = collectErrors(loginSchema, form.value);
  errors.value = check.errors ?? {};
  if (check.errors) return;
  loading.value = true;
  try {
    await auth.signIn({ ...check.data, captchaToken: captchaToken.value });
    toast.success('¡Bienvenido/a!');
    router.push(safeRedirect(route.query.redirect));
  } catch (err) {
    // Mensaje genérico para credenciales; bloqueos y límites muestran el aviso del servidor.
    formError.value = [403, 429, 0].includes(err.status) ? err.message : 'Email o contraseña incorrectos.';
    captchaToken.value = '';
    captcha.value?.reset();
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="container-page flex justify-center pt-14">
    <form class="card w-full max-w-md space-y-5 p-8" novalidate @submit.prevent="submit">
      <h1 class="text-3xl text-plum-900">Ingresar</h1>
      <p v-if="route.query.verified" class="rounded-lg bg-ok/10 p-3 text-sm text-ok" role="status">¡Email verificado! Ya podés ingresar.</p>
      <p v-if="formError" class="rounded-lg bg-danger/10 p-3 text-sm text-danger" role="alert">{{ formError }}</p>

      <div>
        <label class="label" for="identifier">DNI o email</label>
        <input id="identifier" v-model="form.identifier" class="field" type="text" inputmode="email" autocomplete="username" placeholder="12345678 o tu@email.com" required />
        <p v-if="errors.identifier" class="field-error">{{ errors.identifier }}</p>
      </div>
      <div>
        <label class="label" for="password">Contraseña</label>
        <input id="password" v-model="form.password" class="field" type="password" autocomplete="current-password" required />
        <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
      </div>
      <CaptchaWidget ref="captcha" v-model="captchaToken" />
      <button class="btn-primary w-full" :disabled="loading">{{ loading ? 'Ingresando…' : 'Ingresar' }}</button>
      <p class="text-center text-sm text-ink/70">¿No tenés cuenta? <router-link to="/registro" class="font-semibold text-plum-700 underline">Crear cuenta</router-link></p>
    </form>
  </div>
</template>
