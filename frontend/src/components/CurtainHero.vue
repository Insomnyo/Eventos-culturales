<script setup>
defineEmits(['browse']);
</script>

<template>
  <!-- El telón se abre una sola vez al cargar: es el único movimiento "de autor" de la página. -->
  <section class="relative isolate overflow-hidden bg-ink text-white">
    <div class="curtain-panel curtain-left" aria-hidden="true"></div>
    <div class="curtain-panel curtain-right" aria-hidden="true"></div>
    <div class="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_0%,rgba(201,154,59,.38),transparent_60%)]" aria-hidden="true"></div>

    <div class="container-page hero-reveal py-20 sm:py-28">
      <h1 class="max-w-3xl text-4xl leading-[1.08] sm:text-6xl">Esta semana, la ciudad sube el telón.</h1>
      <p class="mt-5 max-w-xl text-lg text-plum-200">Obras de teatro, conciertos de bandas sinfónicas y charlas abiertas. Reservá tu lugar en un minuto, sin costo.</p>
      <div class="mt-8 flex flex-wrap gap-3">
        <button class="btn-gold" @click="$emit('browse')">Ver la cartelera</button>
        <router-link to="/registro" class="btn border border-white/30 text-white hover:bg-white/10">Crear mi cuenta</router-link>
      </div>
    </div>
  </section>
</template>
