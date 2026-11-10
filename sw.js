/* Офлайн-режим: страница, стили, скрипт и фото лежат в кэше телефона. */
const VERSION = "th27-v2";
const CORE = [
  "./", "index.html", "css/style.css", "js/app.js", "manifest.webmanifest",
  "img/favicon.svg", "img/icon-192.png", "img/icon-512.png", "img/apple-touch-icon.png",
  "img/phiphi.jpg", "img/grand_palace.jpg", "img/wat_arun.jpg", "img/yaowarat.jpg", "img/safari.jpg",
  "img/lumphini.jpg", "img/floating.jpg", "img/buddha.jpg", "img/chalong.jpg", "img/kata.jpg",
  "img/patong.jpg", "img/town.jpg", "img/promthep.jpg",
  "img/food_padthai.jpg", "img/food_tomyum.jpg", "img/food_mango.jpg"
];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* копию ответа снимаем сразу: позже его тело уже прочитано страницей и clone() не сработает */
const put = (req, res) => {
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
  }
  return res;
};
/* фото и шрифты не меняются: сначала кэш */
async function cacheFirst(req) {
  return (await caches.match(req)) || put(req, await fetch(req));
}
/* страница и код: сначала сеть (чтобы обновления приходили сразу), при плохой связи через 3 с берём кэш */
async function networkFirst(req) {
  const cached = await caches.match(req, { ignoreSearch: true });
  const net = fetch(req).then(res => put(req, res));
  if (!cached) return net.catch(() => caches.match("index.html"));
  const slow = new Promise(r => setTimeout(() => r(cached), 3000));
  return Promise.race([net.catch(() => cached), slow]);
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const font = FONT_HOSTS.includes(url.hostname);
  if (url.origin !== self.location.origin && !font) return;       /* чужие запросы (курс валют) не трогаем */
  if (font || /\.(jpe?g|png|svg|webp)$/i.test(url.pathname)) e.respondWith(cacheFirst(req));
  else e.respondWith(networkFirst(req));
});
