import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router/index.js';
import { useAuthStore } from './stores/auth.js';
import './assets/main.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);

// Un error de render nunca debe mostrar detalles internos al usuario.
app.config.errorHandler = (err) => { console.error('[app]', err); };

// Se resuelve la sesión antes de montar para evitar un parpadeo "deslogueado → logueado".
useAuthStore().init().finally(() => app.mount('#app'));
