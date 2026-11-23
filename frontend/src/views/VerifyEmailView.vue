<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '@/services/api.js';
import { useAuthStore } from '@/stores/auth.js';

const route = useRoute();
const auth = useAuthStore();
const state = ref('loading');   // loading | ok | error
const message = ref('');

onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token : '';
  if (!token) { state.value = 'error'; message.value = 'El enlace no es válido.'; return; }
  try {
    await api.verifyEmail(token);
    state.value = 'ok';
    if (auth.isAuthenticated) await auth.loadProfile();   // actualiza el estado "verificado" si ya había sesión
  } catch (err) {
    state.value = 'error';
    message.value = err.message;
  }
});
</script>

<template>
  <div class="container-page flex justify-center pt-16">
    <div class="card w-full max-w-md p-8 text-center" role="status">
      <template v-if="state === 'loading'">
        <div class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-plum-100 border-t-plum-700" aria-hidden="true"></div>
        <p class="mt-4 text-ink/70">Verificando tu email…</p>
      </template>
      <template v-else-if="state === 'ok'">
        <p class="font-display text-5xl text-ok">✓</p>
        <h1 class="mt-2 text-3xl text-plum-900">¡Email verificado!</h1>
        <p class="mt-2 text-ink/70">Ya podés reservar lugares en los eventos.</p>
        <router-link :to="auth.isAuthenticated ? '/' : '/ingresar'" class="btn-primary mt-6">{{ auth.isAuthenticated ? 'Ver la cartelera' : 'Ingresar' }}</router-link>
      </template>
      <template v-else>
        <h1 class="text-3xl text-plum-900">No pudimos verificar el email</h1>
        <p class="mt-2 text-ink/70" role="alert">{{ message }}</p>
        <p class="mt-2 text-sm text-ink/60">Ingresá a tu cuenta y pedí un nuevo enlace desde cualquier evento.</p>
        <router-link to="/ingresar" class="btn-primary mt-6">Ir a ingresar</router-link>
      </template>
    </div>
  </div>
</template>
