import { reactive } from 'vue';

// Estado global simple de notificaciones (fuera de Pinia: no necesita persistencia ni devtools).
const toasts = reactive([]);
let nextId = 1;

export function useToast() {
  function push(message, type = 'info', timeout = 4500) {
    const id = nextId++;
    toasts.push({ id, message, type });
    setTimeout(() => dismiss(id), timeout);
  }
  const dismiss = (id) => {
    const index = toasts.findIndex((t) => t.id === id);
    if (index >= 0) toasts.splice(index, 1);
  };
  return {
    toasts, dismiss,
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error', 6500),
    info: (m) => push(m, 'info'),
  };
}
