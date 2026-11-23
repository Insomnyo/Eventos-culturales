<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';
import { useToast } from '@/composables/useToast.js';
import NotificationBell from './NotificationBell.vue';

const auth = useAuthStore();
const router = useRouter();
const toast = useToast();
const menuOpen = ref(false);

async function logout() {
  menuOpen.value = false;
  await auth.signOut();
  toast.info('Sesión cerrada.');
  router.push({ name: 'home' });
}
</script>

<template>
  <header class="sticky top-0 z-40 bg-plum-900/95 text-white backdrop-blur">
    <div class="container-page flex h-16 items-center justify-between">
      <router-link to="/" class="flex items-center gap-2.5" @click="menuOpen = false">
        <svg viewBox="0 0 32 32" class="h-8 w-8" aria-hidden="true"><path d="M4 4h11v24C8 28 4 23 4 16zM28 4H17v24c7 0 11-5 11-12z" fill="#c99a3b" /></svg>
        <span class="font-display text-2xl text-gold-300">Telón</span>
      </router-link>

      <div class="flex items-center gap-1">
        <!-- La campana queda siempre visible (también en celular), fuera del menú desplegable -->
        <NotificationBell v-if="auth.isAuthenticated" />

        <button class="rounded-lg p-2 hover:bg-white/10 md:hidden" :aria-expanded="menuOpen" aria-label="Abrir menú" @click="menuOpen = !menuOpen">
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>

        <nav class="hidden items-center gap-1 md:flex" aria-label="Principal">
          <router-link to="/" class="rounded-lg px-3 py-2 text-sm hover:bg-white/10">Cartelera</router-link>
          <template v-if="auth.isAuthenticated">
            <router-link to="/mis-entradas" class="rounded-lg px-3 py-2 text-sm hover:bg-white/10">Mis entradas</router-link>
            <router-link v-if="auth.isOrganizer" to="/organizador" class="rounded-lg px-3 py-2 text-sm hover:bg-white/10">Panel del organizador</router-link>
            <router-link v-if="auth.isAdmin" to="/admin" class="rounded-lg px-3 py-2 text-sm hover:bg-white/10">Administración</router-link>
            <router-link to="/perfil" class="rounded-lg px-3 py-2 text-sm hover:bg-white/10">Mi perfil</router-link>
            <button class="ml-2 rounded-lg border border-white/25 px-3 py-2 text-sm hover:bg-white/10" @click="logout">Salir</button>
          </template>
          <template v-else>
            <router-link to="/ingresar" class="rounded-lg px-3 py-2 text-sm hover:bg-white/10">Ingresar</router-link>
            <router-link to="/registro" class="btn-gold ml-2 !py-2">Crear cuenta</router-link>
          </template>
        </nav>
      </div>
    </div>

    <Transition name="page">
      <nav v-if="menuOpen" class="container-page flex flex-col gap-1 pb-4 md:hidden" aria-label="Móvil">
        <router-link to="/" class="rounded-lg px-3 py-2.5 hover:bg-white/10" @click="menuOpen = false">Cartelera</router-link>
        <template v-if="auth.isAuthenticated">
          <router-link to="/mis-entradas" class="rounded-lg px-3 py-2.5 hover:bg-white/10" @click="menuOpen = false">Mis entradas</router-link>
          <router-link v-if="auth.isOrganizer" to="/organizador" class="rounded-lg px-3 py-2.5 hover:bg-white/10" @click="menuOpen = false">Panel del organizador</router-link>
          <router-link v-if="auth.isAdmin" to="/admin" class="rounded-lg px-3 py-2.5 hover:bg-white/10" @click="menuOpen = false">Administración</router-link>
          <router-link to="/perfil" class="rounded-lg px-3 py-2.5 hover:bg-white/10" @click="menuOpen = false">Mi perfil</router-link>
          <button class="rounded-lg px-3 py-2.5 text-left hover:bg-white/10" @click="logout">Salir</button>
        </template>
        <template v-else>
          <router-link to="/ingresar" class="rounded-lg px-3 py-2.5 hover:bg-white/10" @click="menuOpen = false">Ingresar</router-link>
          <router-link to="/registro" class="btn-gold mt-1" @click="menuOpen = false">Crear cuenta</router-link>
        </template>
      </nav>
    </Transition>
  </header>
</template>
