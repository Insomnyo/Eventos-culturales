import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/services/api.js';

const POLL_MS = 60_000;

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref([]);
  const unreadCount = ref(0);
  const loading = ref(false);
  const error = ref('');
  let timer = null;

  /** Consulta liviana (solo el contador). Los errores de red se ignoran: se reintenta en el próximo ciclo. */
  async function refreshCount() {
    try { unreadCount.value = (await api.unreadCount()).unreadCount; } catch { /* sin conexión o sesión terminada */ }
  }

  async function load() {
    loading.value = true;
    error.value = '';
    try {
      const data = await api.notifications(20);
      items.value = data.items;
      unreadCount.value = data.unreadCount;
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  }

  async function markRead(notification) {
    if (notification.read_at) return;
    notification.read_at = new Date().toISOString();            // actualización optimista
    unreadCount.value = Math.max(0, unreadCount.value - 1);
    try { unreadCount.value = (await api.markNotificationRead(notification.id)).unreadCount; }
    catch { notification.read_at = null; await refreshCount(); }
  }

  async function markAllRead() {
    const now = new Date().toISOString();
    items.value.forEach((n) => { n.read_at ??= now; });
    unreadCount.value = 0;
    try { await api.markAllNotificationsRead(); } catch { await load(); }
  }

  /** Consulta el contador cada minuto (y al volver a la pestaña). Se detiene al cerrar sesión. */
  function startPolling() {
    stopPolling();
    refreshCount();
    timer = setInterval(() => { if (!document.hidden) refreshCount(); }, POLL_MS);
    document.addEventListener('visibilitychange', onVisible);
  }
  function stopPolling() {
    clearInterval(timer);
    timer = null;
    document.removeEventListener('visibilitychange', onVisible);
  }
  function onVisible() { if (!document.hidden) refreshCount(); }

  function reset() { stopPolling(); items.value = []; unreadCount.value = 0; error.value = ''; }

  return { items, unreadCount, loading, error, refreshCount, load, markRead, markAllRead, startPolling, stopPolling, reset };
});
