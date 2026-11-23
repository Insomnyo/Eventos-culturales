<script setup>
import { computed, onMounted, ref } from 'vue';
import ConfirmModal from '@/components/ConfirmModal.vue';
import { api } from '@/services/api.js';
import { useAuthStore } from '@/stores/auth.js';
import { useToast } from '@/composables/useToast.js';
import { formatDateOnly, ROLE_LABELS } from '@/utils/format.js';

const auth = useAuthStore();
const toast = useToast();

// ---- Cambiar rol por email ----
const email = ref('');
const role = ref('organizer');
const savingRole = ref(false);

async function submitRole() {
  savingRole.value = true;
  try {
    await api.changeRole(email.value.trim().toLowerCase(), role.value);
    toast.success('Rol actualizado. Se aplica en el próximo ingreso de esa persona.');
    email.value = '';
    await loadUsers();
  } catch (err) { toast.error(err.message); }
  finally { savingRole.value = false; }
}

// ---- Habilitar / deshabilitar organizadores y administradores ----
const users = ref([]);
const loadingUsers = ref(true);
const usersError = ref('');
const target = ref(null);          // cuenta sobre la que se está confirmando la acción
const reason = ref('');
const changing = ref(false);

const disabling = computed(() => Boolean(target.value?.is_active));
const myId = computed(() => auth.profile?.id);

async function loadUsers() {
  loadingUsers.value = true;
  usersError.value = '';
  try { users.value = (await api.adminUsers()).items; }
  catch (err) { usersError.value = err.message; }
  finally { loadingUsers.value = false; }
}

function askToggle(user) { target.value = user; reason.value = ''; }
function cancelToggle() { target.value = null; reason.value = ''; }

async function confirmToggle() {
  changing.value = true;
  const user = target.value;
  try {
    await api.setUserStatus(user.id, !user.is_active, disabling.value ? reason.value.trim() : undefined);
    toast.success(disabling.value ? 'Cuenta deshabilitada. Se cerraron sus sesiones.' : 'Cuenta habilitada.');
    cancelToggle();
    await loadUsers();
  } catch (err) {
    toast.error(err.message);
    if (['last_admin', 'no_change', 'user_not_found'].includes(err.code)) { cancelToggle(); await loadUsers(); }
  } finally { changing.value = false; }
}

onMounted(loadUsers);
</script>

<template>
  <div class="container-page max-w-3xl pt-12">
    <h1 class="text-3xl text-plum-900">Administración</h1>

    <!-- Cuentas de organizadores y administradores -->
    <section class="mt-6" aria-labelledby="cuentas-titulo">
      <h2 id="cuentas-titulo" class="text-xl text-plum-700">Organizadores y administradores</h2>
      <p class="mt-1 text-sm text-ink/70">Una cuenta deshabilitada no puede ingresar y se le cierran todas las sesiones al instante. Sus eventos y datos se conservan. Solo los administradores pueden hacerlo.</p>

      <div v-if="loadingUsers" class="mt-4 space-y-3" aria-hidden="true"><div v-for="n in 3" :key="n" class="skeleton h-16 rounded-2xl"></div></div>
      <div v-else-if="usersError" class="card mt-4 p-6 text-center" role="alert"><p class="text-danger">{{ usersError }}</p><button class="btn-primary mt-3" @click="loadUsers">Reintentar</button></div>
      <div v-else-if="!users.length" class="card mt-4 p-8 text-center text-ink/70">Todavía no hay organizadores ni administradores.</div>

      <ul v-else class="mt-4 space-y-3">
        <li v-for="u in users" :key="u.id" class="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center" :class="u.is_active ? '' : 'opacity-80'">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="truncate font-medium">{{ u.full_name }}</p>
              <span class="rounded-full bg-plum-100 px-2.5 py-0.5 text-xs font-semibold text-plum-700">{{ ROLE_LABELS[u.role] }}</span>
              <span v-if="u.is_active" class="rounded-full bg-ok/15 px-2.5 py-0.5 text-xs font-semibold text-ok">Activa</span>
              <span v-else class="rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-semibold text-danger">Deshabilitada</span>
            </div>
            <p class="truncate text-sm text-ink/60">{{ u.email }}</p>
            <p v-if="!u.is_active" class="mt-1 text-xs text-ink/60">
              Desde el {{ formatDateOnly(u.disabled_at) }}<template v-if="u.disabled_reason"> · Motivo: {{ u.disabled_reason }}</template>
            </p>
          </div>
          <span v-if="u.id === myId" class="text-sm text-ink/50">Tu cuenta</span>
          <button v-else-if="u.is_active" class="btn-ghost !px-4 !py-2 !text-danger" @click="askToggle(u)">Deshabilitar</button>
          <button v-else class="btn-ghost !px-4 !py-2 !text-ok" @click="askToggle(u)">Habilitar</button>
        </li>
      </ul>
    </section>

    <!-- Cambiar rol -->
    <section class="mt-12" aria-labelledby="rol-titulo">
      <h2 id="rol-titulo" class="text-xl text-plum-700">Cambiar el rol de una persona</h2>
      <p class="mt-1 text-sm text-ink/70">Promové a una persona ya registrada a organizador. Cada cambio queda en el registro de auditoría.</p>
      <form class="card mt-4 space-y-5 p-6" @submit.prevent="submitRole">
        <div>
          <label class="label" for="email">Email de la persona</label>
          <input id="email" v-model="email" type="email" class="field" required maxlength="254" />
        </div>
        <div>
          <label class="label" for="role">Rol</label>
          <select id="role" v-model="role" class="field">
            <option value="attendee">Asistente</option>
            <option value="organizer">Organizador</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <button class="btn-primary" :disabled="savingRole || !email">{{ savingRole ? 'Guardando…' : 'Guardar rol' }}</button>
      </form>
    </section>

    <ConfirmModal
      :open="Boolean(target)" :title="disabling ? '¿Deshabilitar esta cuenta?' : '¿Habilitar esta cuenta?'"
      :confirm-text="disabling ? 'Sí, deshabilitar' : 'Sí, habilitar'" :danger="disabling" :loading="changing"
      @confirm="confirmToggle" @cancel="cancelToggle"
    >
      <p v-if="disabling"><strong>{{ target?.full_name }}</strong> ({{ ROLE_LABELS[target?.role] }}) no va a poder ingresar y se cerrarán todas sus sesiones ahora mismo. Podés volver a habilitarla cuando quieras.</p>
      <p v-else><strong>{{ target?.full_name }}</strong> va a poder volver a ingresar con su email y contraseña.</p>
      <div v-if="disabling" class="mt-4">
        <label class="label" for="reason">Motivo <span class="font-normal text-ink/50">(opcional, queda registrado)</span></label>
        <input id="reason" v-model="reason" class="field" maxlength="200" />
      </div>
    </ConfirmModal>
  </div>
</template>
