<script setup>
import { computed, onMounted, ref } from 'vue';
import ConfirmModal from '@/components/ConfirmModal.vue';
import TicketCard from '@/components/TicketCard.vue';
import { api } from '@/services/api.js';
import { useAuthStore } from '@/stores/auth.js';
import { useToast } from '@/composables/useToast.js';

const auth = useAuthStore();
const toast = useToast();
const tickets = ref([]);
const loading = ref(true);
const errorMessage = ref('');
const toCancel = ref(null);
const cancelling = ref(false);

const isUpcoming = (t) => new Date(t.event.starts_at) > new Date();
const upcoming = computed(() => tickets.value.filter(isUpcoming));
const past = computed(() => tickets.value.filter((t) => !isUpcoming(t)));

async function load() {
  loading.value = true;
  errorMessage.value = '';
  try { tickets.value = (await api.myReservations()).items; }
  catch (err) { errorMessage.value = err.message; }
  finally { loading.value = false; }
}

async function confirmCancel() {
  cancelling.value = true;
  try {
    await api.cancelReservation(toCancel.value.id);
    tickets.value = tickets.value.filter((t) => t.id !== toCancel.value.id);
    toast.success('Reserva cancelada. El lugar quedó disponible.');
    toCancel.value = null;
  } catch (err) { toast.error(err.message); }
  finally { cancelling.value = false; }
}

onMounted(load);
</script>

<template>
  <div class="container-page pt-12">
    <h1 class="text-3xl text-plum-900">Mis entradas</h1>
    <p class="mt-1 text-ink/70">{{ auth.profile?.full_name }} · {{ auth.profile?.email }}</p>

    <router-link v-if="auth.profile && !auth.profile.dni" to="/perfil" class="mt-6 block rounded-xl bg-gold-300/30 p-4 text-sm text-earth-700 hover:bg-gold-300/50">
      <strong>Falta tu DNI.</strong> Completalo en <span class="underline">Mi perfil</span> para que figure en tus entradas y puedas ingresar al evento aunque olvides el código.
    </router-link>

    <div v-if="loading" class="mt-8 space-y-4" aria-hidden="true"><div v-for="n in 3" :key="n" class="skeleton h-32 rounded-2xl"></div></div>
    <div v-else-if="errorMessage" class="card mt-8 p-8 text-center" role="alert"><p>{{ errorMessage }}</p><button class="btn-primary mt-4" @click="load">Reintentar</button></div>
    <div v-else-if="!tickets.length" class="card mt-8 p-10 text-center">
      <p class="text-lg text-plum-900">Todavía no reservaste ninguna función</p>
      <p class="mt-1 text-sm text-ink/70">Cuando reserves, tus entradas con su código aparecen acá.</p>
      <router-link to="/" class="btn-primary mt-5">Ver la cartelera</router-link>
    </div>
    <template v-else>
      <section v-if="upcoming.length" class="mt-8 space-y-4" aria-label="Próximas funciones">
        <h2 class="text-xl text-plum-700">Próximas</h2>
        <TicketCard v-for="t in upcoming" :key="t.id" :reservation="t" :cancellable="t.attendance_status === 'pending' && t.event.status !== 'cancelled'" :dni="auth.profile?.dni" @cancel="toCancel = t" />
      </section>
      <section v-if="past.length" class="mt-10 space-y-4 opacity-80" aria-label="Funciones pasadas">
        <h2 class="text-xl text-plum-700">Pasadas</h2>
        <TicketCard v-for="t in past" :key="t.id" :reservation="t" :dni="auth.profile?.dni" :upcoming="false" />
      </section>
    </template>

    <ConfirmModal :open="Boolean(toCancel)" title="¿Cancelar esta reserva?" confirm-text="Sí, cancelar" cancel-text="Mantener" danger :loading="cancelling" @confirm="confirmCancel" @cancel="toCancel = null">
      <p>Vas a liberar tu lugar para <strong>{{ toCancel?.event.title }}</strong>. Otra persona podrá tomarlo.</p>
    </ConfirmModal>
  </div>
</template>
