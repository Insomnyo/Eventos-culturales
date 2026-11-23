import { onBeforeUnmount, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';
import { useToast } from './useToast.js';

/** Cierra la sesión tras un período de inactividad (por defecto 30 minutos). */
export function useIdleLogout(minutes = 30) {
  const auth = useAuthStore();
  const router = useRouter();
  const toast = useToast();
  const events = ['pointerdown', 'keydown', 'scroll', 'visibilitychange'];
  let timer;

  const reset = () => {
    clearTimeout(timer);
    if (!auth.isAuthenticated) return;
    timer = setTimeout(async () => {
      if (!auth.isAuthenticated) return;
      await auth.signOut();
      toast.info('Cerramos tu sesión por inactividad.');
      router.push({ name: 'login' });
    }, minutes * 60 * 1000);
  };

  onMounted(() => { events.forEach((e) => window.addEventListener(e, reset, { passive: true })); reset(); });
  onBeforeUnmount(() => { events.forEach((e) => window.removeEventListener(e, reset)); clearTimeout(timer); });
}
