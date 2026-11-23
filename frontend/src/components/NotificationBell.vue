<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationsStore } from '@/stores/notifications.js';
import { formatDateShort, formatRelative } from '@/utils/format.js';

const store = useNotificationsStore();
const router = useRouter();
const open = ref(false);
const root = ref(null);
const panel = ref(null);

const badge = computed(() => (store.unreadCount > 9 ? '9+' : String(store.unreadCount)));

async function toggle() {
  open.value = !open.value;
  if (open.value) {
    await store.load();
    await nextTick();
    panel.value?.focus();
  }
}
const close = () => { open.value = false; };

// Texto del aviso. Todo se muestra con interpolación de Vue (escapado): el título lo escribió un organizador.
function describe(n) {
  if (n.type === 'event_cancelled') return { icon: '✕', tone: 'bg-danger/10 text-danger', title: 'Evento cancelado', text: `Se canceló «${n.event_title}».` };
  return {
    icon: '◷', tone: 'bg-gold-300/40 text-earth-700', title: 'Cambió el día u horario',
    text: `«${n.event_title}» ahora es el ${formatDateShort(n.new_starts_at)} (antes: ${formatDateShort(n.old_starts_at)}).`,
  };
}

async function open_(n) {
  await store.markRead(n);
  if (n.event_id) { close(); router.push({ name: 'event', params: { id: n.event_id } }); }
}

const onOutside = (e) => { if (open.value && root.value && !root.value.contains(e.target)) close(); };
const onKey = (e) => { if (e.key === 'Escape' && open.value) close(); };

onMounted(() => {
  store.startPolling();
  document.addEventListener('pointerdown', onOutside);
  document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  store.reset();
  document.removeEventListener('pointerdown', onOutside);
  document.removeEventListener('keydown', onKey);
});
</script>

<template>
  <div ref="root" class="relative">
    <button
      class="relative rounded-lg p-2 hover:bg-white/10"
      :aria-label="store.unreadCount ? `Notificaciones: ${store.unreadCount} sin leer` : 'Notificaciones'"
      :aria-expanded="open" aria-haspopup="dialog" @click="toggle"
    >
      <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" /><path d="M10 19a2 2 0 0 0 4 0" />
      </svg>
      <span v-if="store.unreadCount" class="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-500 px-1 text-[11px] font-bold text-ink">{{ badge }}</span>
    </button>

    <Transition name="page">
      <div
        v-if="open" ref="panel" tabindex="-1" role="dialog" aria-label="Notificaciones"
        class="fixed inset-x-3 top-[4.25rem] z-50 flex max-h-[75vh] flex-col overflow-hidden rounded-2xl bg-white text-ink shadow-lift outline-none sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
      >
        <div class="flex items-center justify-between border-b border-plum-100 px-4 py-3">
          <h2 class="text-lg text-plum-900">Notificaciones</h2>
          <button v-if="store.unreadCount" class="text-sm font-medium text-plum-700 hover:underline" @click="store.markAllRead()">Marcar todas como leídas</button>
        </div>

        <div class="overflow-y-auto">
          <div v-if="store.loading && !store.items.length" class="space-y-3 p-4" aria-hidden="true">
            <div v-for="n in 3" :key="n" class="skeleton h-16 rounded-xl"></div>
          </div>
          <div v-else-if="store.error" class="p-6 text-center text-sm" role="alert">
            <p class="text-danger">{{ store.error }}</p>
            <button class="btn-ghost mt-3 !py-1.5" @click="store.load()">Reintentar</button>
          </div>
          <div v-else-if="!store.items.length" class="p-8 text-center text-sm text-ink/60">
            <p class="font-display text-3xl text-plum-200">◌</p>
            <p class="mt-2">No tenés notificaciones.</p>
            <p class="mt-1 text-xs">Te avisamos acá si se cancela o cambia de horario un evento al que te anotaste.</p>
          </div>
          <ul v-else>
            <li v-for="n in store.items" :key="n.id">
              <button
                class="flex w-full gap-3 border-b border-plum-100 px-4 py-3 text-left transition last:border-0 hover:bg-plum-100/60"
                :class="n.read_at ? '' : 'bg-plum-100/40'" @click="open_(n)"
              >
                <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold" :class="describe(n).tone" aria-hidden="true">{{ describe(n).icon }}</span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-2">
                    <span class="text-sm font-semibold">{{ describe(n).title }}</span>
                    <span v-if="!n.read_at" class="h-2 w-2 rounded-full bg-gold-500" aria-label="Sin leer"></span>
                  </span>
                  <span class="mt-0.5 block text-sm text-ink/80">{{ describe(n).text }}</span>
                  <span class="mt-1 block text-xs text-ink/50">{{ formatRelative(n.created_at) }}</span>
                </span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </Transition>
  </div>
</template>
