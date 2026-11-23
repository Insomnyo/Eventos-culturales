<script setup>
import { computed, ref } from 'vue';
import { useAuthStore } from '@/stores/auth.js';
import { useToast } from '@/composables/useToast.js';
import { collectErrors, profileSchema } from '@/utils/validation.js';
import { formatDateOnly, formatDni, ROLE_LABELS } from '@/utils/format.js';

const auth = useAuthStore();
const toast = useToast();

const editing = ref(false);
const saving = ref(false);
const errors = ref({});
const formError = ref('');
const form = ref({ fullName: '', dni: '', phone: '', city: '', bio: '' });

const profile = computed(() => auth.profile);
const initial = computed(() => (profile.value?.full_name ?? '?').trim().charAt(0).toUpperCase());

function startEditing() {
  form.value = {
    fullName: profile.value.full_name ?? '',
    dni: profile.value.dni ?? '',
    phone: profile.value.phone ?? '',
    city: profile.value.city ?? '',
    bio: profile.value.bio ?? '',
  };
  errors.value = {};
  formError.value = '';
  editing.value = true;
}

function cancel() {
  editing.value = false;
  errors.value = {};
  formError.value = '';
}

async function save() {
  formError.value = '';
  const check = collectErrors(profileSchema, form.value);
  errors.value = check.errors ?? {};
  if (check.errors) return;

  saving.value = true;
  try {
    // El DNI es un identificador: solo se envía si la cuenta todavía no lo tiene (se completa una única vez).
    const { dni, ...rest } = check.data;
    await auth.updateProfile(!profile.value.dni && dni ? { ...rest, dni } : rest);
    editing.value = false;
    toast.success('Perfil actualizado.');
  } catch (err) {
    formError.value = err.message;
    if (Array.isArray(err.details)) err.details.forEach((d) => { errors.value[d.field] ??= d.message; });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="container-page max-w-2xl pt-12">
    <h1 class="text-3xl text-plum-900">Mi perfil</h1>

    <div v-if="!profile" class="card mt-8 p-8 text-center text-ink/70" role="alert">No pudimos cargar tu perfil. Probá recargar la página.</div>

    <template v-else>
      <!-- Cabecera -->
      <div class="card mt-8 flex items-center gap-5 p-6">
        <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-plum-700 font-display text-3xl text-gold-300" aria-hidden="true">{{ initial }}</div>
        <div class="min-w-0">
          <p class="truncate font-display text-2xl text-plum-900">{{ profile.full_name }}</p>
          <div class="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span class="rounded-full bg-plum-100 px-2.5 py-0.5 font-semibold text-plum-700">{{ ROLE_LABELS[profile.role] }}</span>
            <span v-if="profile.email_verified" class="rounded-full bg-ok/15 px-2.5 py-0.5 font-semibold text-ok">Email verificado</span>
            <span v-else class="rounded-full bg-gold-300/40 px-2.5 py-0.5 font-semibold text-earth-700">Email sin verificar</span>
          </div>
        </div>
      </div>

      <!-- Vista -->
      <section v-if="!editing" class="card mt-6 p-6" aria-label="Datos del perfil">
        <div class="flex items-center justify-between">
          <h2 class="text-xl text-plum-900">Mis datos</h2>
          <button class="btn-primary !py-2" @click="startEditing">Editar perfil</button>
        </div>
        <dl class="mt-5 grid gap-5 sm:grid-cols-2">
          <div><dt class="text-xs font-semibold text-earth-600">Nombre y apellido</dt><dd class="mt-0.5">{{ profile.full_name }}</dd></div>
          <div><dt class="text-xs font-semibold text-earth-600">DNI</dt><dd class="mt-0.5" :class="profile.dni ? '' : 'text-ink/40'">{{ profile.dni ? formatDni(profile.dni) : 'Sin completar' }}</dd></div>
          <div><dt class="text-xs font-semibold text-earth-600">Email</dt><dd class="mt-0.5 break-all">{{ profile.email }}</dd></div>
          <div><dt class="text-xs font-semibold text-earth-600">Teléfono</dt><dd class="mt-0.5" :class="profile.phone ? '' : 'text-ink/40'">{{ profile.phone || 'Sin completar' }}</dd></div>
          <div><dt class="text-xs font-semibold text-earth-600">Ciudad</dt><dd class="mt-0.5" :class="profile.city ? '' : 'text-ink/40'">{{ profile.city || 'Sin completar' }}</dd></div>
          <div class="sm:col-span-2"><dt class="text-xs font-semibold text-earth-600">Sobre mí</dt><dd class="mt-0.5 whitespace-pre-line" :class="profile.bio ? '' : 'text-ink/40'">{{ profile.bio || 'Sin completar' }}</dd></div>
          <div v-if="profile.created_at"><dt class="text-xs font-semibold text-earth-600">Miembro desde</dt><dd class="mt-0.5">{{ formatDateOnly(profile.created_at) }}</dd></div>
        </dl>
      </section>

      <!-- Edición -->
      <form v-else class="card mt-6 space-y-5 p-6" novalidate aria-label="Editar perfil" @submit.prevent="save">
        <h2 class="text-xl text-plum-900">Editar perfil</h2>
        <p v-if="formError" class="rounded-lg bg-danger/10 p-3 text-sm text-danger" role="alert">{{ formError }}</p>

        <div>
          <label class="label" for="fullName">Nombre y apellido</label>
          <input id="fullName" v-model="form.fullName" class="field" maxlength="80" autocomplete="name" required />
          <p v-if="errors.fullName" class="field-error">{{ errors.fullName }}</p>
        </div>

        <div>
          <label class="label" for="email">Email</label>
          <input id="email" :value="profile.email" class="field cursor-not-allowed bg-plum-100/50" disabled aria-describedby="email-help" />
          <p id="email-help" class="mt-1 text-xs text-ink/60">El email no se puede cambiar desde acá porque es el que identifica tu cuenta.</p>
        </div>

        <div>
          <label class="label" for="dni">DNI</label>
          <input id="dni" v-model="form.dni" class="field" :class="profile.dni ? 'cursor-not-allowed bg-plum-100/50' : ''" inputmode="numeric" autocomplete="off" maxlength="12" :disabled="Boolean(profile.dni)" placeholder="12345678" aria-describedby="dni-help" />
          <p id="dni-help" class="mt-1 text-xs text-ink/60">
            {{ profile.dni ? 'El DNI identifica tu cuenta y figura en tus entradas, por eso no se puede modificar. Si hay un error, contactá a un administrador.' : 'Completalo una sola vez, sin puntos: figurará en tus entradas y te permitirá ingresar al evento si olvidás el código. Después no se podrá cambiar.' }}
          </p>
          <p v-if="errors.dni" class="field-error">{{ errors.dni }}</p>
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label class="label" for="phone">Teléfono <span class="font-normal text-ink/50">(opcional)</span></label>
            <input id="phone" v-model="form.phone" class="field" type="tel" maxlength="30" autocomplete="tel" placeholder="+54 362 4000000" />
            <p v-if="errors.phone" class="field-error">{{ errors.phone }}</p>
          </div>
          <div>
            <label class="label" for="city">Ciudad <span class="font-normal text-ink/50">(opcional)</span></label>
            <input id="city" v-model="form.city" class="field" maxlength="80" autocomplete="address-level2" />
            <p v-if="errors.city" class="field-error">{{ errors.city }}</p>
          </div>
        </div>

        <div>
          <label class="label" for="bio">Sobre mí <span class="font-normal text-ink/50">(opcional)</span></label>
          <textarea id="bio" v-model="form.bio" class="field min-h-28" maxlength="300"></textarea>
          <p class="mt-1 text-right text-xs text-ink/50">{{ form.bio.length }}/300</p>
          <p v-if="errors.bio" class="field-error">{{ errors.bio }}</p>
        </div>

        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" class="btn-ghost" :disabled="saving" @click="cancel">Cancelar</button>
          <button class="btn-primary" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar cambios' }}</button>
        </div>
      </form>
    </template>
  </div>
</template>
