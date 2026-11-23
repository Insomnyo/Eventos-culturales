import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api, refreshSession, setSessionLostHandler } from '@/services/api.js';

export const useAuthStore = defineStore('auth', () => {
  const profile = ref(null);   // { id, email, full_name, role, email_verified } — el rol viene del backend (fuente de verdad)
  let initPromise = null;

  const isAuthenticated = computed(() => Boolean(profile.value));
  const role = computed(() => profile.value?.role ?? null);
  const isOrganizer = computed(() => ['organizer', 'admin'].includes(role.value));
  const isAdmin = computed(() => role.value === 'admin');
  const emailVerified = computed(() => Boolean(profile.value?.email_verified));

  async function loadProfile() {
    try { profile.value = (await api.me()).profile; } catch { profile.value = null; }
  }

  /** Se llama una sola vez al arrancar: si hay cookie de refresh válida, recupera la sesión. */
  function init() {
    initPromise ??= (async () => {
      setSessionLostHandler(() => { profile.value = null; });
      const session = await refreshSession();
      profile.value = session?.profile ?? null;
    })();
    return initPromise;
  }

  async function signUp({ email, dni, password, fullName, captchaToken }) {
    await api.register({ email, dni, password, fullName, captchaToken: captchaToken || undefined });
  }

  async function signIn({ identifier, password, captchaToken }) {
    const session = await api.login({ identifier, password, captchaToken: captchaToken || undefined });
    profile.value = session.profile;
  }

  /** Edita el propio perfil. El servidor devuelve el perfil actualizado. */
  async function updateProfile(data) {
    profile.value = (await api.updateProfile(data)).profile;
  }

  const resendVerification = (email, captchaToken) => api.resendVerification(email, captchaToken);

  /** Cierra la sesión: el servidor revoca el refresh token y borra la cookie. */
  async function signOut() {
    await api.logout();
    profile.value = null;
  }

  return { profile, isAuthenticated, role, isOrganizer, isAdmin, emailVerified, init, loadProfile, updateProfile, signUp, signIn, signOut, resendVerification };
});
