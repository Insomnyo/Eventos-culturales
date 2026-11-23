<script setup>
import { computed, ref } from 'vue';
import CaptchaWidget from '@/components/CaptchaWidget.vue';
import { useAuthStore } from '@/stores/auth.js';
import { useToast } from '@/composables/useToast.js';
import { collectErrors, passwordStrength, registerSchema } from '@/utils/validation.js';

const auth = useAuthStore();
const toast = useToast();

const form = ref({ fullName: '', dni: '', email: '', password: '' });
const errors = ref({});
const formError = ref('');
const loading = ref(false);
const done = ref(false);
const captchaToken = ref('');
const captcha = ref(null);

const strength = computed(() => passwordStrength(form.value.password));
const strengthLabel = computed(() => ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte'][strength.value]);
const strengthColor = computed(() => ['bg-danger', 'bg-danger', 'bg-warn', 'bg-gold-500', 'bg-ok'][strength.value]);

async function submit() {
  formError.value = '';
  const check = collectErrors(registerSchema, form.value);
  errors.value = check.errors ?? {};
  if (check.errors) return;
  loading.value = true;
  try {
    await auth.signUp({ ...check.data, captchaToken: captchaToken.value });
    done.value = true;     // misma pantalla exista o no el email: no se revela si ya hay una cuenta
  } catch (err) {
    formError.value = err.details?.[0]?.message ?? err.message ?? 'No pudimos crear la cuenta. Revisá los datos e intentá de nuevo.';
    captchaToken.value = '';
    captcha.value?.reset();
  } finally {
    loading.value = false;
  }
}

async function resend() {
  try { await auth.resendVerification(form.value.email); toast.success('Te reenviamos el enlace.'); }
  catch { toast.error('No pudimos reenviar el email. Probá en unos minutos.'); }
}
</script>

<template>
  <div class="container-page flex justify-center pt-14">
    <div v-if="done" class="card w-full max-w-md p-8 text-center" role="status">
      <h1 class="text-3xl text-plum-900">Revisá tu correo</h1>
      <p class="mt-3 text-ink/80">Te enviamos un enlace de verificación a <strong>{{ form.email }}</strong>. Necesitás verificar tu email para poder reservar lugares. Si estás probando en tu computadora sin SMTP, el enlace aparece en la consola del backend.</p>
      <button class="btn-ghost mt-5" @click="resend">Reenviar enlace</button>
    </div>

    <form v-else class="card w-full max-w-md space-y-5 p-8" novalidate @submit.prevent="submit">
      <h1 class="text-3xl text-plum-900">Crear cuenta</h1>
      <p v-if="formError" class="rounded-lg bg-danger/10 p-3 text-sm text-danger" role="alert">{{ formError }}</p>

      <div>
        <label class="label" for="fullName">Nombre y apellido</label>
        <input id="fullName" v-model="form.fullName" class="field" autocomplete="name" maxlength="80" required />
        <p v-if="errors.fullName" class="field-error">{{ errors.fullName }}</p>
      </div>
      <div>
        <label class="label" for="dni">DNI</label>
        <input id="dni" v-model="form.dni" class="field" inputmode="numeric" autocomplete="off" maxlength="12" placeholder="12345678" required aria-describedby="dni-help" />
        <p id="dni-help" class="mt-1 text-xs text-ink/60">Sin puntos. Figura en tu entrada y te permite ingresar al evento si olvidás el código. No se puede cambiar después.</p>
        <p v-if="errors.dni" class="field-error">{{ errors.dni }}</p>
      </div>
      <div>
        <label class="label" for="email">Email</label>
        <input id="email" v-model="form.email" class="field" type="email" autocomplete="email" required />
        <p v-if="errors.email" class="field-error">{{ errors.email }}</p>
      </div>
      <div>
        <label class="label" for="password">Contraseña</label>
        <input id="password" v-model="form.password" class="field" type="password" autocomplete="new-password" required aria-describedby="pw-help" />
        <div class="mt-2 flex gap-1" aria-hidden="true"><span v-for="n in 4" :key="n" class="h-1.5 flex-1 rounded-full transition-colors" :class="n <= strength ? strengthColor : 'bg-plum-100'"></span></div>
        <p id="pw-help" class="mt-1 text-xs text-ink/60">{{ form.password ? strengthLabel + ' · ' : '' }}Mínimo 10 caracteres, con mayúscula, minúscula y número.</p>
        <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
      </div>
      <CaptchaWidget ref="captcha" v-model="captchaToken" />
      <button class="btn-primary w-full" :disabled="loading">{{ loading ? 'Creando cuenta…' : 'Crear cuenta' }}</button>
      <p class="text-center text-sm text-ink/70">¿Ya tenés cuenta? <router-link to="/ingresar" class="font-semibold text-plum-700 underline">Ingresar</router-link></p>
    </form>
  </div>
</template>
