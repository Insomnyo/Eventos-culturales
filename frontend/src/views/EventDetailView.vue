<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import ConfirmModal from '@/components/ConfirmModal.vue';
import CaptchaWidget from '@/components/CaptchaWidget.vue';
import { api } from '@/services/api.js';
import { useAuthStore } from '@/stores/auth.js';
import { useToast } from '@/composables/useToast.js';
import { CATEGORY_LABELS, formatDateLong, shortTicket } from '@/utils/format.js';

const props = defineProps({ id: { type: String, required: true } });
const route = useRoute();
const auth = useAuthStore();
const toast = useToast();

const event = ref(null);
const loading = ref(true);
const errorMessage = ref('');
const confirmOpen = ref(false);
const reserving = ref(false);
const captchaToken = ref('');
const captcha = ref(null);
const ticket = ref(null);          // resultado de la reserva (para mostrar el "sello")
const emailSent = ref(true);

const soldOut = computed(() => (event.value?.available_spots ?? 0) <= 0);
const needsCaptcha = computed(() => Boolean(import.meta.env.VITE_HCAPTCHA_SITE_KEY));
const canConfirm = computed(() => !needsCaptcha.value || Boolean(captchaToken.value));
const isFuture = computed(() => event.value && new Date(event.value.starts_at) > new Date());
const occupancy = computed(() => (event.value ? Math.round(((event.value.capacity - event.value.available_spots) / event.value.capacity) * 100) : 0));

async function load() {
  loading.value = true;
  errorMessage.value = '';
  try {
    event.value = (await api.getEvent(props.id)).event;
  } catch (err) {
    errorMessage.value = err.status === 404 ? 'Este evento no existe o ya no está disponible.' : err.message;
  } finally {
    loading.value = false;
  }
}

async function resendVerification() {
  try { await auth.resendVerification(auth.profile.email); toast.success('Te reenviamos el enlace de verificación.'); }
  catch (err) { toast.error(err.message); }
}

async function reserve() {
  reserving.value = true;
  try {
    const result = await api.reserve(props.id, captchaToken.value);
    ticket.value = result.reservation;
    emailSent.value = result.emailSent;
    event.value.available_spots = result.availableSpots;     // el servidor informa el cupo actualizado
    confirmOpen.value = false;
    toast.success('¡Lugar reservado!');
  } catch (err) {
    toast.error(err.message);
    if (['sold_out', 'limit_per_user_reached'].includes(err.code)) { confirmOpen.value = false; await load(); }
  } finally {
    reserving.value = false;
    captchaToken.value = '';
    captcha.value?.reset();
  }
}

onMounted(load);
</script>

<template>
  <div class="container-page pt-8">
    <div v-if="loading" class="grid gap-8 lg:grid-cols-[1.4fr_1fr]" aria-hidden="true">
      <div class="skeleton aspect-[16/9] rounded-2xl"></div>
      <div class="space-y-4"><div class="skeleton h-8 w-4/5 rounded"></div><div class="skeleton h-5 w-2/3 rounded"></div><div class="skeleton h-40 rounded-2xl"></div></div>
    </div>

    <div v-else-if="errorMessage" class="card mx-auto max-w-lg p-10 text-center" role="alert">
      <p class="text-xl text-plum-900">{{ errorMessage }}</p>
      <router-link to="/" class="btn-primary mt-5">Volver a la cartelera</router-link>
    </div>

    <article v-else-if="event" class="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <div class="overflow-hidden rounded-2xl bg-plum-900 shadow-card">
          <img v-if="event.cover_url" :src="event.cover_url" :alt="`Portada de ${event.title}`" class="aspect-[16/9] w-full object-cover" />
          <div v-else class="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-plum-700 via-plum-900 to-ink"><span class="font-display text-8xl text-gold-500/70">{{ CATEGORY_LABELS[event.category]?.charAt(0) }}</span></div>
        </div>
        <h2 class="mt-6 text-sm font-semibold text-earth-600">{{ CATEGORY_LABELS[event.category] }}</h2>
        <h1 class="mt-1 text-3xl text-plum-900 sm:text-4xl">{{ event.title }}</h1>
        <!-- Vue escapa el texto interpolado: el contenido del organizador nunca se interpreta como HTML (anti-XSS). -->
        <p class="mt-5 max-w-prose whitespace-pre-line leading-relaxed text-ink/85">{{ event.description }}</p>
      </div>

      <aside class="lg:sticky lg:top-24 lg:self-start">
        <div class="card space-y-5 p-6">
          <div>
            <p class="text-xs font-semibold text-earth-600">Cuándo</p>
            <p class="capitalize">{{ formatDateLong(event.starts_at) }} h</p>
          </div>
          <div>
            <p class="text-xs font-semibold text-earth-600">Dónde</p>
            <p>{{ event.location }}</p>
          </div>
          <div>
            <div class="flex items-baseline justify-between text-sm">
              <span class="font-semibold" :class="soldOut ? 'text-danger' : 'text-ok'">{{ soldOut ? 'Agotado' : `${event.available_spots} lugares disponibles` }}</span>
              <span class="text-ink/60">de {{ event.capacity }}</span>
            </div>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-plum-100"><div class="h-full rounded-full bg-gold-500 transition-all duration-700" :style="{ width: occupancy + '%' }"></div></div>
          </div>

          <!-- Estados del botón de reserva -->
          <div v-if="event.status === 'cancelled'" class="rounded-lg bg-danger/10 p-3 text-sm text-danger">Este evento fue cancelado.</div>
          <div v-else-if="event.status === 'draft'" class="rounded-lg bg-gold-300/30 p-3 text-sm text-earth-700">Borrador: todavía no es visible para el público.</div>
          <router-link v-else-if="!auth.isAuthenticated" :to="{ name: 'login', query: { redirect: route.fullPath } }" class="btn-primary w-full">Ingresá para reservar</router-link>
          <div v-else-if="!auth.emailVerified" class="rounded-lg bg-gold-300/30 p-3 text-sm text-earth-700">
            Verificá tu email para poder reservar. Te enviamos un enlace al registrarte.
            <button class="mt-2 block font-semibold underline" @click="resendVerification">Reenviar enlace</button>
          </div>
          <button v-else-if="isFuture" class="btn-gold w-full" :disabled="soldOut" @click="confirmOpen = true">{{ soldOut ? 'Sin lugares' : 'Reservar mi lugar' }}</button>
          <p v-else class="text-sm text-ink/60">Este evento ya comenzó.</p>

          <!-- Sello de confirmación: la animación responde a la acción de reservar -->
          <div v-if="ticket" class="relative rounded-xl border-2 border-dashed border-gold-500 bg-plum-100 p-5 text-center" role="status">
            <div class="animate-stamp-in inline-block rounded-md border-2 border-ok px-3 py-1 font-display text-lg text-ok">Confirmada</div>
            <p class="mt-3 text-xs font-semibold text-earth-600">Tu código</p>
            <p class="font-display text-3xl tracking-wider text-plum-900">{{ shortTicket(ticket.ticket_code) }}</p>
            <p class="mt-1 break-all text-[11px] text-ink/50">{{ ticket.ticket_code }}</p>
            <p class="mt-3 text-sm text-ink/70">{{ emailSent ? 'Te enviamos la entrada por email.' : 'No pudimos enviar el email, pero tu entrada está en "Mis entradas".' }}</p>
            <router-link to="/mis-entradas" class="btn-ghost mt-3">Ver mis entradas</router-link>
          </div>
        </div>
      </aside>
    </article>

    <ConfirmModal :open="confirmOpen" title="¿Reservar tu lugar?" confirm-text="Sí, reservar" :loading="reserving" :confirm-disabled="!canConfirm" @confirm="reserve" @cancel="confirmOpen = false">
      <p>Vas a reservar <strong>1 entrada</strong> gratuita para <strong>{{ event?.title }}</strong>. Podés cancelar desde “Mis entradas” hasta el inicio del evento.</p>
      <div class="mt-4"><CaptchaWidget ref="captcha" v-model="captchaToken" /></div>
    </ConfirmModal>
  </div>
</template>
