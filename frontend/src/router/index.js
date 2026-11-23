import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';

const routes = [
  { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
  { path: '/eventos/:id', name: 'event', component: () => import('@/views/EventDetailView.vue'), props: true },
  { path: '/ingresar', alias: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guestOnly: true } },
  { path: '/registro', name: 'register', component: () => import('@/views/RegisterView.vue'), meta: { guestOnly: true } },
  { path: '/verificar-email', name: 'verify-email', component: () => import('@/views/VerifyEmailView.vue') },
  { path: '/perfil', name: 'my-profile', component: () => import('@/views/MyProfileView.vue'), meta: { requiresAuth: true } },
  { path: '/mis-entradas', name: 'tickets', component: () => import('@/views/ProfileView.vue'), meta: { requiresAuth: true } },
  { path: '/organizador', name: 'organizer', component: () => import('@/views/OrganizerDashboardView.vue'), meta: { requiresAuth: true, roles: ['organizer', 'admin'] } },
  { path: '/organizador/eventos/nuevo', name: 'event-new', component: () => import('@/views/EventFormView.vue'), meta: { requiresAuth: true, roles: ['organizer', 'admin'] } },
  { path: '/organizador/eventos/:id/editar', name: 'event-edit', component: () => import('@/views/EventFormView.vue'), props: true, meta: { requiresAuth: true, roles: ['organizer', 'admin'] } },
  { path: '/organizador/eventos/:id/inscriptos', name: 'attendees', component: () => import('@/views/AttendeesView.vue'), props: true, meta: { requiresAuth: true, roles: ['organizer', 'admin'] } },
  { path: '/admin', name: 'admin', component: () => import('@/views/AdminView.vue'), meta: { requiresAuth: true, roles: ['admin'] } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, _from, saved) => saved ?? (to.hash ? { el: to.hash, behavior: 'smooth' } : { top: 0 }),
});

/**
 * Redirección post-login SEGURA: solo rutas internas ("/algo"). Evita "open redirect"
 * (ej. ?redirect=//sitio-malicioso.com o https://...).
 */
export function safeRedirect(target) {
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') && !target.includes('\\') ? target : '/';
}

// Guards de autenticación y rol. IMPORTANTE: son comodidad de UX; la seguridad real la imponen
// el backend (RBAC + propiedad del recurso) y RLS en la base de datos.
router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.init();
  if (to.meta.requiresAuth && !auth.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } };
  if (to.meta.guestOnly && auth.isAuthenticated) return { name: 'home' };
  if (to.meta.roles && !to.meta.roles.includes(auth.role)) return { name: 'home' };
  return true;
});

export default router;
