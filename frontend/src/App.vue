<script setup>
import AppHeader from '@/components/AppHeader.vue';
import ToastHost from '@/components/ToastHost.vue';
import { useIdleLogout } from '@/composables/useIdleLogout.js';

useIdleLogout(30);
</script>

<template>
  <a href="#contenido" class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">Saltar al contenido</a>
  <AppHeader />
  <main id="contenido" class="min-h-[70vh]">
    <router-view v-slot="{ Component, route }">
      <Transition name="page" mode="out-in">
        <component :is="Component" :key="route.path" />
      </Transition>
    </router-view>
  </main>
  <footer class="mt-24 bg-plum-900 py-10 text-sm text-plum-200">
    <div class="container-page flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p class="font-display text-lg text-gold-300">Telón</p>
      <p>Inscripciones gratuitas a eventos culturales. Tus datos se usan solo para gestionar tus reservas.</p>
    </div>
  </footer>
  <ToastHost />
</template>
