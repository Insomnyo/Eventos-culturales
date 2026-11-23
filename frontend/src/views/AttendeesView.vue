<script setup>
import { computed, onMounted, ref } from 'vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/services/api.js';
import { useToast } from '@/composables/useToast.js';
import { formatDateLong, formatDni, shortTicket } from '@/utils/format.js';
import { dniSchema } from '@/utils/validation.js';

const props = defineProps({ id: { type: String, required: true } });
const toast = useToast();

const event = ref(null);
const attendees = ref([]);
const loading = ref(true);
const errorMessage = ref('');
const filter = ref('all');
const busyId = ref(null);
const ticketInput = ref('');
const checkingIn = ref(false);
const dniInput = ref('');
const checkingDni = ref(false);
const lastDniCheckIn = ref(null);   // último ingreso por DNI: se deja a la vista para comparar con el documento

const counts = computed(() => ({
  total: attendees.value.length,
  pending: attendees.value.filter((a) => a.attendance_status === 'pending').length,
  attended: attendees.value.filter((a) => a.attendance_status === 'attended').length,
  no_show: attendees.value.filter((a) => a.attendance_status === 'no_show').length,
}));
const visible = computed(() => (filter.value === 'all' ? attendees.value : attendees.value.filter((a) => a.attendance_status === filter.value)));

async function load() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const result = await api.attendees(props.id);
    event.value = result.event;
    attendees.value = result.attendees;
  } catch (err) { errorMessage.value = err.message; }
  finally { loading.value = false; }
}

async function mark(attendee, status) {
  busyId.value = attendee.id;
  try {
    const { reservation } = await api.setAttendance(props.id, attendee.id, status);
    Object.assign(attendee, reservation);
  } catch (err) { toast.error(err.message); }
  finally { busyId.value = null; }
}

async function checkInByCode() {
  const code = ticketInput.value.trim();
  if (!code) return;
  checkingIn.value = true;
  try {
    const { reservation } = await api.checkInByTicket(code);
    const match = attendees.value.find((a) => a.id === reservation.id);
    if (match) Object.assign(match, reservation);
    toast.success(`Check-in registrado: ${reservation.attendee?.full_name ?? 'asistente'}`);
    ticketInput.value = '';
  } catch (err) { toast.error(err.message); }
  finally { checkingIn.value = false; }
}

async function checkInByDni() {
  const parsed = dniSchema.safeParse(dniInput.value);
  if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
  checkingDni.value = true;
  lastDniCheckIn.value = null;
  try {
    const { reservation, remaining, total } = await api.checkInByDni(props.id, parsed.data);
    const match = attendees.value.find((a) => a.id === reservation.id);
    if (match) Object.assign(match, reservation);
    lastDniCheckIn.value = { name: reservation.attendee.full_name, dni: reservation.attendee.dni, remaining, total };
    dniInput.value = '';
  } catch (err) { toast.error(err.message); }
  finally { checkingDni.value = false; }
}

const FILTERS = [['all', 'Todos'], ['pending', 'Pendientes'], ['attended', 'Asistieron'], ['no_show', 'No asistieron']];
onMounted(load);
</script>

<template>
  <div class="container-page pt-12">
    <router-link :to="{ name: 'organizer' }" class="text-sm font-medium text-plum-700 hover:underline">← Volver al panel</router-link>

    <div v-if="loading" class="mt-6 space-y-3" aria-hidden="true"><div class="skeleton h-10 w-2/3 rounded"></div><div v-for="n in 5" :key="n" class="skeleton h-14 rounded-xl"></div></div>
    <div v-else-if="errorMessage" class="card mt-6 p-8 text-center" role="alert"><p>{{ errorMessage }}</p><button class="btn-primary mt-4" @click="load">Reintentar</button></div>

    <template v-else>
      <h1 class="mt-3 text-3xl text-plum-900">{{ event.title }}</h1>
      <p class="capitalize text-ink/70">{{ formatDateLong(event.starts_at) }} h · {{ counts.total }} de {{ event.capacity }} lugares ocupados</p>

      <div class="mt-6 grid grid-cols-3 gap-3">
        <div class="card p-4"><p class="font-display text-3xl text-earth-700">{{ counts.pending }}</p><p class="text-sm text-ink/70">Pendientes</p></div>
        <div class="card p-4"><p class="font-display text-3xl text-ok">{{ counts.attended }}</p><p class="text-sm text-ink/70">Asistieron</p></div>
        <div class="card p-4"><p class="font-display text-3xl text-danger">{{ counts.no_show }}</p><p class="text-sm text-ink/70">No asistieron</p></div>
      </div>

      <form class="card mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end" @submit.prevent="checkInByCode">
        <div class="flex-1">
          <label class="label" for="ticket">Check-in por código de entrada</label>
          <input id="ticket" v-model="ticketInput" class="field" placeholder="Pegá o escaneá el código completo" autocomplete="off" />
        </div>
        <button class="btn-gold" :disabled="checkingIn || !ticketInput.trim()">{{ checkingIn ? 'Verificando…' : 'Registrar ingreso' }}</button>
      </form>

      <form class="card mt-4 space-y-3 p-4" @submit.prevent="checkInByDni">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div class="flex-1">
            <label class="label" for="dni-checkin">¿Olvidó su entrada? Ingreso por DNI</label>
            <input id="dni-checkin" v-model="dniInput" class="field" inputmode="numeric" autocomplete="off" maxlength="12" placeholder="DNI sin puntos" />
          </div>
          <button class="btn-gold" :disabled="checkingDni || !dniInput.trim()">{{ checkingDni ? 'Buscando…' : 'Registrar por DNI' }}</button>
        </div>
        <div v-if="lastDniCheckIn" class="rounded-lg bg-ok/10 p-3 text-sm" role="status">
          <p class="font-semibold text-ok">✓ Ingreso registrado: {{ lastDniCheckIn.name }} · DNI {{ formatDni(lastDniCheckIn.dni) }}</p>
          <p class="mt-0.5 text-ink/70">Comprobá que el nombre coincida con el documento. {{ lastDniCheckIn.remaining ? `Le quedan ${lastDniCheckIn.remaining} entrada(s) por ingresar.` : 'Ya ingresó con todas sus entradas.' }}</p>
        </div>
        <p class="text-xs text-ink/50">Marca una entrada pendiente por vez. El DNI no está verificado: pedí siempre el documento y compará el nombre.</p>
      </form>

      <div class="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filtrar inscriptos">
        <button v-for="[key, label] in FILTERS" :key="key" class="rounded-full px-4 py-1.5 text-sm font-medium transition" :class="filter === key ? 'bg-plum-700 text-white' : 'bg-white text-plum-700 hover:bg-plum-100'" :aria-pressed="filter === key" @click="filter = key">{{ label }}</button>
      </div>

      <div v-if="!visible.length" class="card mt-4 p-10 text-center text-ink/70">{{ attendees.length ? 'No hay inscriptos con ese estado.' : 'Todavía no hay inscriptos para este evento.' }}</div>

      <div v-else class="card mt-4 overflow-x-auto">
        <table class="w-full min-w-[720px] text-left text-sm">
          <thead class="border-b border-plum-100 text-xs text-ink/60"><tr><th class="p-4">Asistente</th><th class="p-4">DNI</th><th class="p-4">Entrada</th><th class="p-4">Estado</th><th class="p-4 text-right">Acción</th></tr></thead>
          <tbody>
            <tr v-for="a in visible" :key="a.id" class="border-b border-plum-100 last:border-0">
              <td class="p-4"><p class="font-medium">{{ a.attendee?.full_name }}</p><p class="text-xs text-ink/60">{{ a.attendee?.email }}</p></td>
              <td class="p-4 font-mono text-xs">{{ a.attendee?.dni ? formatDni(a.attendee.dni) : '—' }}</td>
              <td class="p-4 font-mono text-xs">{{ shortTicket(a.ticket_code) }}</td>
              <td class="p-4"><StatusBadge :status="a.attendance_status" /></td>
              <td class="p-4">
                <div class="flex justify-end gap-2">
                  <button class="btn-ghost !px-3 !py-1.5 !text-ok" :disabled="busyId === a.id || a.attendance_status === 'attended'" @click="mark(a, 'attended')">Asistió</button>
                  <button class="btn-ghost !px-3 !py-1.5 !text-danger" :disabled="busyId === a.id || a.attendance_status === 'no_show'" @click="mark(a, 'no_show')">No asistió</button>
                  <button class="btn-ghost !px-3 !py-1.5" :disabled="busyId === a.id || a.attendance_status === 'pending'" @click="mark(a, 'pending')">Deshacer</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
