/* Guía de bolsillo · Práctica Intermedia
   Service worker: sirve la guía desde caché primero (funciona sin conexión)
   y, cuando hay red, revisa en segundo plano si cambió. Si cambió, la guarda
   y avisa a la página para ofrecer actualizar.

   Solo actúa sobre la guía y sus archivos. El resto del repositorio
   (consola de supervisión, guías antiguas, otras páginas) pasa de largo. */

"use strict";

const CACHE = "guia-bolsillo";

const ARCHIVOS = [
  "guia.html",
  "manifest.webmanifest",
  "icono-180.png",
  "icono-192.png",
  "icono-512.png"
];

function igual(a, b) {
  try { return a.normalize("NFC") === b.normalize("NFC"); }
  catch (e) { return a === b; }
}

function esNuestro(url) {
  let ruta;
  try { ruta = decodeURIComponent(new URL(url).pathname); }
  catch (e) { ruta = new URL(url).pathname; }
  const nombre = ruta.split("/").pop();
  return ARCHIVOS.some(a => igual(a, nombre));
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

function avisarCambio() {
  self.clients.matchAll({ includeUncontrolled: true }).then(cs =>
    cs.forEach(c => c.postMessage({ tipo: "actualizada" }))
  );
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;
  if (!esNuestro(req.url)) return;

  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req, { ignoreSearch: true }).then(guardado => {
        const desdeRed = fetch(req)
          .then(res => {
            if (res && res.ok) {
              const copia = res.clone();
              if (guardado) {
                Promise.all([guardado.clone().text(), copia.clone().text()])
                  .then(([viejo, nuevo]) => {
                    if (viejo !== nuevo) cache.put(req, copia).then(avisarCambio);
                  })
                  .catch(() => {});
              } else {
                cache.put(req, copia);
              }
            }
            return res;
          })
          .catch(() => guardado);
        return guardado || desdeRed;
      })
    )
  );
});
