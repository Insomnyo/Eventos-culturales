import { ref } from 'vue';
import { useToast } from './useToast.js';

/** Envuelve una acción async con estado de carga y toast de error (mensajes ya seguros desde la API). */
export function useAsyncAction(action, { errorPrefix = '' } = {}) {
  const loading = ref(false);
  const toast = useToast();
  async function run(...args) {
    loading.value = true;
    try {
      return await action(...args);
    } catch (err) {
      toast.error(`${errorPrefix}${err.message ?? 'Ocurrió un error.'}`);
      return undefined;
    } finally {
      loading.value = false;
    }
  }
  return { loading, run };
}
