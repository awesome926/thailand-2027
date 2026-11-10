(() => {
"use strict";

/* ================= утилиты ================= */
const root = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* приватный режим */ } }
};
const RM = matchMedia("(prefers-reduced-motion: reduce)");
const reduce = () => RM.matches;
const fmt = n => Math.round(n).toLocaleString("ru-RU");
const plural = (n, f) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? f[2] : b === 1 ? f[0] : b >= 2 && b <= 4 ? f[1] : f[2]; };
/* число из поля: понимает и запятую, и точку, и пробелы */
const num = s => { const v = parseFloat(String(s).replace(/[\s ]/g, "").replace(",", ".")); return Number.isFinite(v) && v >= 0 ? v : NaN; };

/* одно уведомление за раз */
const toastBox = $("#toasts");
let toastT;
function toast(text) {
  clearTimeout(toastT);
  toastBox.replaceChildren();
  const d = document.createElement("div");
  d.className = "toast"; d.textContent = text;
  toastBox.append(d);
  toastT = setTimeout(() => { d.classList.add("out"); setTimeout(() => d.remove(), 300); }, 2400);
}

async function copyText(t, okMsg) {
  try {
    if (!navigator.clipboard || !window.isSecureContext) throw new Error("no clipboard");
    await navigator.clipboard.writeText(t);
    toast(okMsg);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = t; ta.readOnly = true; ta.style.cssText = "position:fixed;left:0;top:0;opacity:0";
    document.body.append(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
    toast(ok ? okMsg : "Не получилось скопировать");
  }
}

/* плавный счётчик чисел */
function tween(el, to, { dur = 900, suffix = "" } = {}) {
  const from = parseFloat(el.dataset.v);
  el.dataset.v = to;
  cancelAnimationFrame(el._raf); clearTimeout(el._t);
  const done = () => { el.textContent = fmt(to) + suffix; };
  if (reduce() || !Number.isFinite(from) || from === to || document.hidden) { done(); return; }
  const t0 = performance.now();
  const step = now => {
    const k = clamp((now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
    el.textContent = fmt(from + (to - from) * e) + suffix;
    if (k < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
  el._t = setTimeout(() => { cancelAnimationFrame(el._raf); done(); }, dur + 150);
}

/* ================= появление при прокрутке ================= */
/* верх зоны наблюдения вытянут далеко вверх: блоки, оказавшиеся выше экрана (прыжок по ссылке, восстановление прокрутки), тоже считаются видимыми */
const revealIO = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
  let i = 0;
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const el = e.target;
    if (e.boundingClientRect.bottom < 0) el.classList.add("now");      /* уже выше экрана: показываем без анимации */
    else el.style.setProperty("--i", Math.min(i++, 7));                 /* соседние блоки выезжают лесенкой */
    el.classList.add("in");
    revealIO.unobserve(el);
    el.dispatchEvent(new CustomEvent("reveal"));
  }
}, { threshold: 0.08, rootMargin: "100000px 0px -6% 0px" }) : null;
function watch(scope = document) {
  for (const el of $$(".rv:not(.in)", scope)) {
    if (revealIO) revealIO.observe(el);
    else { el.classList.add("in"); el.dispatchEvent(new CustomEvent("reveal")); }
  }
}

/* ================= тема ================= */
const themeBtn = $("#theme");
const darkMQ = matchMedia("(prefers-color-scheme: dark)");
const curTheme = () => root.dataset.theme || (darkMQ.matches ? "dark" : "light");
function syncThemeUI() {
  const dark = curTheme() === "dark";
  themeBtn.setAttribute("aria-pressed", dark);
  themeBtn.setAttribute("aria-label", dark ? "Включить светлую тему" : "Включить тёмную тему");
}
function setTheme(t) { root.dataset.theme = t; store.set("theme", t); syncThemeUI(); }
themeBtn.addEventListener("click", () => {
  const next = curTheme() === "dark" ? "light" : "dark";
  if (!document.startViewTransition || reduce()) { setTheme(next); return; }
  const r = themeBtn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.startViewTransition(() => setTheme(next)).ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${R}px at ${x}px ${y}px)`] },
      { duration: 650, easing: "cubic-bezier(.4,0,.2,1)", pseudoElement: "::view-transition-new(root)" }
    );
  }).catch(() => {});
});
darkMQ.addEventListener("change", syncThemeUI);
syncThemeUI();

/* ================= курс и рубли ================= */
const DEF_RATE = 2.6;
let rate = store.get("rate", DEF_RATE);
if (!(rate > 0)) rate = DEF_RATE;
const rateStr = () => String(rate).replace(".", ",");
const niceRub = v => v < 50 ? Math.round(v) : v < 1000 ? Math.round(v / 10) * 10 : Math.round(v / 50) * 50;
/* "≈ 1 000-1 300 бат с человека" -> "≈ 2 600–3 400 ₽" */
function rubOf(price) {
  const m = String(price).match(/(\d[\d\s ]*?)(?:\s*[-–]\s*(\d[\d\s ]*?))?\s*бат/);
  if (!m) return "";
  const a = +m[1].replace(/\D/g, ""), b = m[2] ? +m[2].replace(/\D/g, "") : null;
  const r = v => fmt(niceRub(v * rate));
  return "≈ " + (b ? `${r(a)}–${r(b)}` : r(a)) + " ₽";
}
function refreshRubles(animate) {
  for (const el of $$(".rubc")) {
    const t = rubOf(el.dataset.price);
    if (el.textContent === t) continue;
    el.textContent = t;
    if (animate) { el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick"); }
  }
}

/* ================= бюджет ================= */
const LIMIT = 150000, DEF_TIX = 95000, NIGHT = 3500;
const BUD = [
  { k: "fly", name: "Перелёт Москва ↔ Бангкок", amt: DEF_TIX, note: "", color: "var(--lagoon)" },
  { k: "fly2", name: "Перелёт Бангкок → Пхукет", amt: 7000, note: "AirAsia, Nok Air, Thai Lion, часто бывают акции", color: "color-mix(in srgb,var(--lagoon) 55%,var(--bg))" },
  { k: "stay", name: "Жильё, 11 ночей", amt: 18000, note: "≈ 1 600 ₽ в сутки, гестхаус с комнатой на троих", color: "var(--gold)" },
  { k: "food", name: "Еда", amt: 17000, note: "≈ 1 400 ₽ в день на троих, уличная еда и фудкорты", color: "var(--chili)" },
  { k: "fun", name: "Входные и развлечения", amt: 6000, note: "Дворец, Safari World или аквапарк, один остров", color: "color-mix(in srgb,var(--chili) 55%,var(--bg))" },
  { k: "move", name: "Транспорт по городам", amt: 4000, note: "метро, Grab, Bolt, паромы", color: "color-mix(in srgb,var(--gold) 55%,var(--bg))" },
  { k: "ins", name: "Страховка и SIM", amt: 3000, note: "страховка обязательна", color: "var(--muted)" }
];
const tix = $("#tix"), tixOut = $("#tixOut"), tixReset = $("#tixReset"), bar = $("#bar"), segs = $("#segs"), legend = $("#legend");
let tickets = store.get("tickets", DEF_TIX);
if (!(tickets >= +tix.min && tickets <= +tix.max)) tickets = DEF_TIX;
let barShown = false;

segs.innerHTML = BUD.map((b, i) => `<i class="seg" data-k="${b.k}" style="--i:${i};background:${b.color}"></i>`).join("");
legend.innerHTML = BUD.map(b => `<div class="lg" data-k="${b.k}"><span class="dot" style="background:${b.color}"></span><span class="t">${esc(b.name)}<small>${esc(b.note)}</small></span><span class="v"></span></div>`).join("");

function renderBudget() {
  BUD[0].amt = tickets;
  BUD[0].note = `3 билета, ≈ ${fmt(Math.round(tickets / 3 / 100) * 100)} на человека`;
  const total = BUD.reduce((s, b) => s + b.amt, 0), scale = Math.max(total, LIMIT);
  for (const b of BUD) {
    if (barShown) $(`.seg[data-k="${b.k}"]`, segs).style.width = (b.amt / scale * 100) + "%";
    const row = $(`.lg[data-k="${b.k}"]`, legend);
    $(".v", row).textContent = fmt(b.amt) + " ₽";
    if (b.k === "fly") $("small", row).textContent = b.note;
  }
  bar.classList.toggle("over", total > LIMIT);
  bar.style.setProperty("--x", (LIMIT / scale * 100) + "%");
  tween($("#total"), total, { dur: 500, suffix: " ₽" });
  const diff = LIMIT - total, v = $("#verdict");
  v.classList.toggle("bad", diff < 0);
  v.textContent = diff > 0 ? `в бюджете, запас ${fmt(diff)} ₽`
    : diff === 0 ? "ровно в бюджет, запаса нет"
    : `перебор ${fmt(-diff)} ₽ · это ≈ ${Math.ceil(-diff / NIGHT)} ${plural(Math.ceil(-diff / NIGHT), ["ночь", "ночи", "ночей"])}`;
  tixOut.textContent = fmt(tickets) + " ₽";
  tix.style.setProperty("--val", ((tickets - tix.min) / (tix.max - tix.min) * 100) + "%");
  tixReset.hidden = tickets === DEF_TIX;
}
tix.value = tickets;
$("#total").dataset.v = LIMIT;
renderBudget();
tix.addEventListener("input", () => { tickets = +tix.value; store.set("tickets", tickets); renderBudget(); });
tixReset.addEventListener("click", () => { tickets = DEF_TIX; tix.value = tickets; store.set("tickets", tickets); renderBudget(); tix.focus(); });
$("#budCard").addEventListener("reveal", () => {
  barShown = true; renderBudget();
  setTimeout(() => $$(".seg", segs).forEach(s => s.style.setProperty("--i", 0)), 1700);   /* дальше полоска двигается без задержек */
}, { once: true });
/* подсветка пары «сегмент ↔ строка» */
function hl(k) {
  bar.classList.toggle("hl", !!k);
  for (const el of $$("[data-k]", $("#budCard"))) el.classList.toggle("hl", el.dataset.k === k);
}
for (const box of [segs, legend]) {
  box.addEventListener("pointerover", e => { const t = e.target.closest("[data-k]"); if (t) hl(t.dataset.k); });
  box.addEventListener("pointerleave", () => hl(null));
  box.addEventListener("click", e => { const t = e.target.closest("[data-k]"); if (t) hl(t.classList.contains("hl") && !matchMedia("(hover:hover)").matches ? null : t.dataset.k); });
}

/* ================= конвертер ================= */
const thb = $("#thb"), rub = $("#rub"), rateIn = $("#rate"), rateNote = $("#rateNote"), rateBtn = $("#rateFetch");
const plain = v => String(Math.round(v * 100) / 100).replace(".", ",");
function flash(input) { const f = input.closest(".field"); f.classList.remove("flash"); void f.offsetWidth; f.classList.add("flash"); }
function fromThb(mark) { const v = num(thb.value); rub.value = Number.isFinite(v) ? plain(Math.round(v * rate)) : ""; if (mark) flash(rub); }
function fromRub() { const v = num(rub.value); thb.value = Number.isFinite(v) ? plain(Math.round(v / rate)) : ""; }
function setRate(v, { silent } = {}) {
  rate = Math.round(v * 1000) / 1000;
  store.set("rate", rate);
  if (!silent) rateIn.value = rateStr();
  rateIn.classList.remove("err");
  fromThb(true);
  refreshRubles(true);
}
rateIn.value = rateStr();
fromThb();
thb.addEventListener("input", () => fromThb());
rub.addEventListener("input", fromRub);
rateIn.addEventListener("input", () => {
  const v = num(rateIn.value);
  if (v > 0 && v < 1000) setRate(v, { silent: true }); else rateIn.classList.add("err");   /* пока поле пустое, старый курс не затираем */
});
rateIn.addEventListener("blur", () => { rateIn.value = rateStr(); rateIn.classList.remove("err"); });
for (const el of [thb, rub, rateIn]) el.addEventListener("focus", () => el.select());
$("#quick").innerHTML = [[40, "проезд"], [60, "пад тай"], [300, "массаж, час"], [500, "Большой дворец"], [1200, "Safari World"]]
  .map(q => `<button type="button" data-v="${q[0]}">${q[0]} ฿ · ${q[1]}</button>`).join("");
$("#quick").addEventListener("click", e => { const b = e.target.closest("button"); if (b) { thb.value = b.dataset.v; fromThb(true); } });

function rateStamp() {
  const at = store.get("rateAt", 0);
  if (!at) return;
  const d = new Date(at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  rateNote.textContent = `Курс из сети от ${d}: ${rateStr()} ₽ за бат. Он биржевой, в обменнике выйдет чуть хуже. Все цены в батах ниже пересчитаны в рубли.`;
}
rateStamp();
rateBtn.addEventListener("click", async () => {
  rateBtn.disabled = true; rateBtn.classList.add("busy");
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/THB", { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const v = (await r.json())?.rates?.RUB;
    if (!(v > 0)) throw new Error("no rate");
    setRate(Math.round(v * 100) / 100);
    store.set("rateAt", Date.now());
    rateStamp();
    toast(`Курс обновлён: ${rateStr()} ₽ за бат`);
  } catch {
    toast(navigator.onLine === false ? "Нет интернета. Введи курс вручную" : "Не вышло получить курс. Введи вручную");
  } finally { rateBtn.disabled = false; rateBtn.classList.remove("busy"); }
});

/* ================= маршрут ================= */
const M = q => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
const DIM = { grand_palace: [960, 641], wat_arun: [760, 507], yaowarat: [760, 504], food_padthai: [760, 760], safari: [760, 570], lumphini: [760, 420], floating: [760, 507], buddha: [760, 505], chalong: [760, 587], kata: [760, 570], patong: [760, 570], town: [760, 570], promthep: [960, 640], phiphi: [960, 640] };
/* img: имя файла в /img, либо эмодзи-заглушка, если фото нет */
const P = (name, desc, addr, price, q, img, alt) => ({ name, desc, addr, price, q, img, alt });
const CITIES = [
  { id: "bkk", name: "Бангкок", sub: "Дни 1-5 · храмы, рынки, сафари", tag: "5 дней", img: "grand_palace", days: [
    { n: 1, t: "Прилёт и отдых", d: "Заселяемся и отсыпаемся после перелёта. SIM-карту (AIS или True) покупай сразу в аэропорту, около 300-600 бат за пакет на 2 недели.", p: [
      P("Аэропорт Суварнабхуми (BKK)", "В город дешевле всего ехать на электричке Airport Rail Link до станции Phaya Thai.", "Bang Phli, Samut Prakan 10540", "≈ 45 бат с человека", "Suvarnabhumi Airport", "🛬")] },
    { n: 2, t: "Дворец и главные храмы", d: "Одевайтесь закрыто: плечи и колени. Иначе во дворец не пустят. Если на улице говорят «дворец сегодня закрыт», это развод, иди к кассе сам.", p: [
      P("Большой дворец и храм Изумрудного Будды", "Главная достопримечательность страны. Приходи к открытию, пока не жарко.", "Na Phra Lan Rd, Phra Nakhon, Bangkok 10200", "500 бат, дети до 120 см бесплатно", "Grand Palace Bangkok", "grand_palace"),
      P("Ват Пхо, храм Лежащего Будды", "Золотой Будда длиной 46 метров, в пяти минутах пешком от дворца. Тут же знаменитая школа тайского массажа.", "2 Sanam Chai Rd, Phra Nakhon, Bangkok 10200", "300 бат", "Wat Pho Bangkok", "🛕"),
      P("Ват Арун, храм Рассвета", "Переплыви реку на маленьком пароме от пирса Tha Tien. Самый красивый вид на закате.", "158 Wang Doem Rd, Bangkok Yai, Bangkok 10600", "100 бат + паром ≈ 5 бат", "Wat Arun Bangkok", "wat_arun")] },
    { n: 3, t: "Чайна-таун и шопинг", d: "Днём торговые центры с кондиционером, вечером улица еды.", p: [
      P("Яоварат, Чайна-таун", "Вечером это главная уличная еда Бангкока: креветки, фрукты, десерты. Бери то, что видишь на тарелках у местных.", "Yaowarat Rd, Samphanthawong, Bangkok 10100", "еда от 40-100 бат", "Yaowarat Road Bangkok", "yaowarat"),
      P("MBK Center", "Огромный ТЦ с дешёвыми футболками, сувенирами и электроникой. Торгуйся.", "444 Phayathai Rd, Pathum Wan, Bangkok 10330", "вход бесплатный", "MBK Center Bangkok", "🛍️"),
      P("ICONSIAM и фудкорт SookSiam", "Огромный ТЦ на реке. Внизу фудкорт SookSiam с едой со всей страны. До него ходит бесплатный катер от пирса Sathorn.", "299 Charoen Nakhon Rd, Khlong San, Bangkok 10600", "еда от 60-120 бат", "ICONSIAM Bangkok", "🚤"),
      P("Thip Samai, Пад Тай", "Знаменитая лавка Пад Тая, вечером очередь. Скажи «май пхет».", "313 Maha Chai Rd, Phra Nakhon, Bangkok 10200", "≈ 100-200 бат", "Thip Samai Pad Thai Bangkok", "food_padthai", "Тарелка Пад Тая")] },
    { n: 4, t: "Сафари и парк", d: "Лучший день для сестры. Выезжай утром, парк большой.", p: [
      P("Safari World", "Сафари на машине или автобусе среди жирафов и тигров, плюс шоу дельфинов и морских львов.", "99 Panya Intra Rd, Khlong Sam Wa, Bangkok 10510", "≈ 1 000-1 300 бат с человека, проверь на сайте", "Safari World Bangkok", "safari"),
      P("Парк Лумпини", "Бесплатный большой парк в центре, по нему гуляют вараны. Хорошо, чтобы передохнуть от жары.", "Rama IV Rd, Pathum Wan, Bangkok 10330", "бесплатно", "Lumphini Park Bangkok", "lumphini")] },
    { n: 5, t: "Плавучий рынок или отдых", d: "Если денег впритык, пропусти рынок и отдохни, а вечером собери вещи.", p: [
      P("Плавучий рынок Дамноенсадуак", "Лодки с фруктами и едой. Около 100 км от Бангкока, поездка на полдня.", "Damnoen Saduak, Ratchaburi 70130", "≈ 600-1 000 бат на троих", "Damnoen Saduak Floating Market", "floating")] }
  ] },
  { id: "hkt", name: "Пхукет", sub: "Дни 6-12 · пляжи, острова, закаты", tag: "7 дней", img: "buddha", days: [
    { n: 6, t: "Перелёт на Пхукет", d: "Жильё бери на Кате или Кароне: там тише и спокойнее, чем в Патонге, и лучше для семьи.", p: [
      P("Аэропорт Пхукета (HKT)", "Такси в аэропорту дорогое. Дешевле автобус, минивэн или Grab/Bolt.", "222 Moo 6, Mai Khao, Thalang, Phuket 83110", "автобус ≈ 100-200 бат, такси от 800", "Phuket International Airport", "🛬")] },
    { n: 7, t: "Пляжный день", d: "Сначала смотри на флаг у спасателей. Красный: в воду не заходим.", p: [
      P("Пляж Ката", "Самый семейный пляж с пологим заходом. Массаж прямо на берегу, для мамы.", "Kata, Mueang Phuket 83100", "бесплатно · массаж ≈ 300-400 бат/час", "Kata Beach Phuket", "kata"),
      P("Пляж Карон", "Длиннее и спокойнее Каты, рядом ночной рынок.", "Karon, Mueang Phuket 83100", "бесплатно", "Karon Beach Phuket", "🏖️")] },
    { n: 8, t: "Храмы и закат", d: "Скромная одежда в храмах. На мыс приезжай за час до заката.", p: [
      P("Большой Будда", "Белая статуя высотой 45 метров на холме, вид на половину острова.", "Nakkerd Hills, Chalong, Mueang Phuket 83130", "бесплатно, пожертвование по желанию", "Big Buddha Phuket", "buddha"),
      P("Ват Чалонг", "Самый известный и самый красивый храм Пхукета.", "70 Chaofa Rd, Chalong, Mueang Phuket 83130", "бесплатно", "Wat Chalong Phuket", "chalong"),
      P("Мыс Промтхеп", "Лучшее место для заката на всём острове.", "Rawai, Mueang Phuket 83130", "бесплатно", "Promthep Cape Phuket", "promthep")] },
    { n: 9, t: "Старый город и аквапарк", d: "Если сегодня воскресенье, вечером на Thalang Road проходит большой ночной рынок, с 16:00 до 22:00.", p: [
      P("Старый город Пхукета", "Цветные дома в китайско-португальском стиле, кафе, лавки, стрит-арт.", "Thalang Rd, Talat Yai, Mueang Phuket 83000", "бесплатно", "Thalang Road Old Phuket Town", "town"),
      P("Аквапарк Splash Jungle", "Горки подходят и в 14, и в 6 лет. Цену и часы на 2027 проверь на сайте.", "Mai Khao, Thalang, Phuket 83110", "≈ 1 000-1 500 бат с человека", "Splash Jungle Water Park Phuket", "💦")] },
    { n: 10, t: "Острова Пхи-Пхи", d: "Самый дорогой и самый красивый день. В июне бывают волны и отмены рейсов. Бери большой паром, а не маленький спидбот, особенно с шестилеткой.", p: [
      P("Острова Пхи-Пхи и бухта Мая", "Паром отходит от причала Rassada. Если штормит, замени на пляж и не рискуй.", "Rassada Pier, Rassada, Mueang Phuket 83000", "паром ≈ 600-700 бат туда-обратно с человека", "Rassada Pier Phuket", "phiphi")] },
    { n: 11, t: "Шопинг, массаж, рынок", d: "Спокойный день перед вылетом. Массаж выбирай по отзывам в Google Maps.", p: [
      P("Jungceylon, Патонг", "Большой ТЦ: кафе, кино, детский уголок, сувениры.", "181 Rat-U-Thit 200 Pi Rd, Patong, Kathu 83150", "вход бесплатный", "Jungceylon Patong", "patong", "Пляж Патонг"),
      P("Рынок Banzaan", "Рядом с Jungceylon: свежие морепродукты и дешёвые фрукты, наверху готовят.", "Rat-U-Thit 200 Pi Rd, Patong, Kathu 83150", "еда от 60-150 бат", "Banzaan Fresh Market Patong", "🦐")] },
    { n: 12, t: "Вылет домой", d: "Заранее реши, как ехать в аэропорт: автобус, Grab или Bolt. Домой можно лететь через Бангкок или прямо с Пхукета, смотри, какие билеты дешевле.", p: [] }
  ] }
];
const TRIP_DAYS = 12;

const placeHTML = p => {
  const d = DIM[p.img];
  const pic = d
    ? `<div class="ph"><img loading="lazy" decoding="async" src="img/${p.img}.jpg" width="${d[0]}" height="${d[1]}" alt="${esc(p.alt || p.name)}"></div>`
    : `<div class="ph none"><span aria-hidden="true">${p.img}</span></div>`;
  return `<article class="card place rv">${pic}<div class="bd"><h5>${esc(p.name)}</h5><p>${esc(p.desc)}</p>
    <div class="meta"><span class="price">${esc(p.price)}</span><span class="rubc" data-price="${esc(p.price)}">${rubOf(p.price)}</span></div>
    <div class="addr">${ic("pin")}<span>${esc(p.addr)}</span></div>
    <div class="btns"><a class="btn map" href="${M(p.q)}" target="_blank" rel="noopener">${ic("pin")}На карте</a><button type="button" class="btn cp" data-a="${esc(p.addr)}">${ic("copy")}Адрес</button></div>
  </div><i class="glow" aria-hidden="true"></i></article>`;
};
const dayHTML = d => `<div class="day rv" id="day${d.n}" data-n="${d.n}"><span class="day-dot" aria-hidden="true">${d.n}</span>
  <div class="day-h"><h4>День ${d.n}. ${esc(d.t)}</h4><span class="ddate"></span></div><p>${esc(d.d)}</p><div class="places">${d.p.map(placeHTML).join("")}</div></div>`;
const FLIGHT = `<div class="flight rv" role="img" aria-label="Перелёт из Бангкока на Пхукет, около полутора часов"><b>BKK<small>Бангкок</small></b><span class="fl-line">${ic("plane")}</span><b>HKT<small>Пхукет</small></b><span class="fl-note">≈ 1,5 часа в воздухе</span></div>`;

$("#days").innerHTML = CITIES.map((c, i) => `${i ? FLIGHT : ""}<div class="city rv" id="${c.id}"><img loading="lazy" decoding="async" src="img/${c.img}.jpg" width="${DIM[c.img][0]}" height="${DIM[c.img][1]}" alt=""><div class="city-in"><div><h3>${c.name}</h3><span>${c.sub}</span></div><span class="tag">${c.tag}</span></div></div><div class="days">${c.days.map(dayHTML).join("")}</div>`).join("");
$("#daystrip").innerHTML = `<small>День</small>` + CITIES.map((c, i) => (i ? ic("plane") : "") + c.days.map(d => `<a href="#day${d.n}" class="${c.id}" data-n="${d.n}" aria-label="День ${d.n}. ${esc(d.t)}">${d.n}</a>`).join("")).join("");

const nPlaces = CITIES.reduce((s, c) => s + c.days.reduce((t, d) => t + d.p.length, 0), 0);
$("#np").textContent = nPlaces;
$("#npl").textContent = `${plural(nPlaces, ["место", "места", "мест"])} на карте`;
document.addEventListener("click", e => { const b = e.target.closest(".cp"); if (b) copyText(b.dataset.a, "Адрес скопирован, покажи таксисту"); });

/* лёгкий наклон карточек за курсором, только для мыши */
if (matchMedia("(hover:hover) and (pointer:fine)").matches) {
  const area = $("#days");
  let cur = null;
  const reset = c => { c.style.removeProperty("--rx"); c.style.removeProperty("--ry"); };
  area.addEventListener("pointermove", e => {
    const c = e.target.closest(".place");
    if (cur && cur !== c) reset(cur);
    cur = c;
    if (!c || reduce()) return;
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    c.style.setProperty("--ry", ((x - 0.5) * 5).toFixed(2) + "deg");
    c.style.setProperty("--rx", ((0.5 - y) * 5).toFixed(2) + "deg");
    c.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
    c.style.setProperty("--my", (y * 100).toFixed(1) + "%");
  });
  area.addEventListener("pointerleave", () => { if (cur) reset(cur); cur = null; });
}

/* ================= дата вылета, отсчёт, «сегодня» ================= */
const DEF_DEP = "2027-06-01";
const validDate = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + "T00:00:00").getTime());
let dep = store.get("depart", null);
if (!validDate(dep)) dep = null;
const depDate = () => { const [y, m, d] = (dep || DEF_DEP).split("-").map(Number); return new Date(y, m - 1, d); };
function tripState() {
  const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((depDate() - today) / 864e5);
  return diff > 0 ? { k: "before", n: diff } : diff > -TRIP_DAYS ? { k: "during", n: 1 - diff } : { k: "after" };
}
let cdFirst = true;
function renderTrip() {
  const st = tripState(), cd = $("#cd"), cdl = $("#cdl"), cta = $("#todayCta");
  const dLabel = depDate().toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  if (st.k === "before") {
    if (cdFirst) { cd.dataset.v = 0; cd.textContent = "0"; }
    tween(cd, st.n, { dur: 1500 });
    cdl.textContent = `${plural(st.n, ["день", "дня", "дней"])} до вылета (${dep ? "" : "≈ "}${dLabel})`;
  } else if (st.k === "during") {
    cd.textContent = `День ${st.n}`; cdl.textContent = `из ${TRIP_DAYS} · вы в Таиланде 🌴`;
  } else {
    cd.textContent = "✓"; cdl.textContent = "поездка состоялась";
  }
  cdFirst = false;
  cta.hidden = st.k !== "during";
  if (st.k === "during") { cta.href = "#day" + st.n; $("#todayTxt").textContent = `Сегодня день ${st.n}: открыть план`; }
  for (const el of $$(".day")) {
    const n = +el.dataset.n, isToday = st.k === "during" && st.n === n;
    el.classList.toggle("today", isToday);
    let label = "";
    if (dep) { const d = depDate(); d.setDate(d.getDate() + n - 1); label = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" }); }
    $(".ddate", el).textContent = isToday ? (label ? "сегодня · " + label : "сегодня") : label;
  }
  for (const a of $$("#daystrip a")) a.classList.toggle("today", st.k === "during" && st.n === +a.dataset.n);
}
setInterval(renderTrip, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) renderTrip(); });

const dateDlg = $("#dateDlg"), depIn = $("#depIn");
$("#cdBtn").addEventListener("click", () => {
  depIn.value = dep || DEF_DEP;
  if (dateDlg.showModal) dateDlg.showModal();
});
dateDlg.addEventListener("click", e => { if (e.target === dateDlg) dateDlg.close(); });   /* тап мимо окна закрывает без сохранения */
/* действие берём из нажатой кнопки формы; Esc и тап мимо ничего не меняют */
$("form", dateDlg).addEventListener("submit", e => {
  const v = e.submitter?.value;
  if (v === "ok" && validDate(depIn.value)) { dep = depIn.value; store.set("depart", dep); toast("Дата вылета сохранена"); }
  else if (v === "reset") { dep = null; store.del("depart"); toast("Вернул примерную дату: 1 июня 2027"); }
  else return;
  renderTrip();
});

/* ================= «показать» и озвучка ================= */
const showDlg = $("#showDlg");
let showCur = null, showOpener = null;
const baseLen = s => Math.max(...s.split(/\s*\/\s*|\s*·\s*/).map(p => p.replace(/[ัิ-ฺ็-๎\s]/g, "").length));
function openShow(th, caption, opener) {
  showCur = th; showOpener = opener;
  const big = $("#showBig");
  big.textContent = th;
  big.style.setProperty("--len", Math.max(3, baseLen(th)));
  $("#showSmall").textContent = caption;
  showDlg.classList.remove("closing");
  if (showDlg.showModal) showDlg.showModal(); else showDlg.setAttribute("open", "");
  $("#showClose").focus();
}
function closeShow() {
  if (!showDlg.open || showDlg.classList.contains("closing")) return;
  const fin = () => {
    showDlg.classList.remove("closing");
    if (showDlg.close) showDlg.close(); else showDlg.removeAttribute("open");
    stopSpeak(); showOpener?.focus?.(); showOpener = null;      /* возвращаем фокус на кнопку, с которой открыли */
  };
  if (reduce()) { fin(); return; }
  showDlg.classList.add("closing");
  setTimeout(fin, 220);
}
showDlg.addEventListener("click", e => { if (!e.target.closest("#showSay")) closeShow(); });
showDlg.addEventListener("cancel", e => { e.preventDefault(); closeShow(); });
$("#showSay").addEventListener("click", e => speak(showCur, e.currentTarget));

const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
let voices = [];
if (synth) { const load = () => { voices = synth.getVoices(); }; load(); synth.addEventListener?.("voiceschanged", load); }
let speakBtn = null;
function stopSpeak() { if (synth) synth.cancel(); speakBtn?.classList.remove("playing"); speakBtn = null; }
function speak(text, btn) {
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") { toast("На этом устройстве нет озвучки. Жми «Показать»"); return; }
  const wasSame = speakBtn === btn && synth.speaking;
  stopSpeak();
  if (wasSame) return;
  const th = voices.find(v => /^th([-_]|$)/i.test(v.lang));
  if (!th && voices.length) { toast("Нет тайского голоса на этом устройстве. Жми «Показать»"); return; }
  const u = new SpeechSynthesisUtterance(text.replace(/\s*\/\s*/g, ", "));
  u.lang = "th-TH"; u.rate = 0.8;
  if (th) u.voice = th;
  speakBtn = btn; btn?.classList.add("playing");
  u.onend = u.onerror = () => { if (speakBtn === btn) { btn?.classList.remove("playing"); speakBtn = null; } };
  synth.speak(u);
}

/* ================= еда ================= */
const DISH = [["Пад Тай", "ผัดไทย", 0, "Жареная лапша с яйцом, креветками и арахисом. Соус чили обычно ставят отдельно."], ["Кхао Пад", "ข้าวผัด", 0, "Жареный рис с яйцом и курицей или креветками."], ["Кхао Ман Гай", "ข้าวมันไก่", 0, "Нежная курица с рисом и бульоном. Лучший вариант для сестры."], ["Гай Янг и Му Пинг", "ไก่ย่าง · หมูปิ้ง", 0, "Курица-гриль и свинина на шпажках, уличная классика."], ["Пад Си Ю", "ผัดซีอิ๊ว", 0, "Широкая лапша с овощами и соевым соусом."], ["Манго с клейким рисом", "ข้าวเหนียวมะม่วง", 0, "Главный десерт, пробовать обязательно."], ["Роти", "โรตี", 0, "Блинчик с бананом и шоколадом, очень популярен на Пхукете."], ["Массаман-карри", "แกงมัสมั่น", 1, "Самое мягкое карри, сладковатое, с картошкой."], ["Зелёное карри", "แกงเขียวหวาน", 2, "Остро по умолчанию."], ["Том Ям", "ต้มยำ", 3, "Кислый суп с креветками. Очень остро, проси «май пхет»."], ["Сом Там", "ส้มตำ", 3, "Салат из зелёной папайи. Очень остро, без просьбы не бери."]];
const SPICE = ["не остро", "чуть-чуть", "остро", "очень остро"];
const chili = on => `<svg class="${on ? "on" : "off"}" aria-hidden="true"><use href="#i-chili"/></svg>`;
const spice = n => `<span class="spice" role="img" aria-label="острота ${n} из 3">${chili(n >= 1)}${chili(n >= 2)}${chili(n >= 3)}<em style="color:${n ? "var(--chili)" : "var(--ok)"}">${SPICE[n]}</em></span>`;
const SPICE_TABS = [["all", "Все блюда"], ["mild", "Можно сестре"], ["hot", "Острое"]];
let spiceTab = "all";
$("#spiceTabs").innerHTML = SPICE_TABS.map(t => `<button type="button" data-t="${t[0]}" aria-pressed="${t[0] === spiceTab}">${t[1]}</button>`).join("");
function renderDishes() {
  const list = DISH.map((d, i) => [d, i]).filter(([d]) => spiceTab === "all" || (spiceTab === "mild" ? d[2] === 0 : d[2] >= 2));
  $("#dishes").innerHTML = list.map(([d, i], k) => `<div class="card dish" style="--i:${k}"><h5>${esc(d[0])}</h5><span class="th" lang="th">${d[1]}</span>${spice(d[2])}<p>${esc(d[3])}</p><button type="button" class="btn sm dish-show" data-i="${i}">${ic("show")}Показать официанту</button></div>`).join("");
}
$("#spiceTabs").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b || b.dataset.t === spiceTab) return;
  spiceTab = b.dataset.t;
  for (const x of $$("button", $("#spiceTabs"))) x.setAttribute("aria-pressed", x === b);
  renderDishes();
});
$("#dishes").addEventListener("click", e => { const b = e.target.closest(".dish-show"); if (b) { const d = DISH[b.dataset.i]; openShow(d[1], d[0], b); } });
renderDishes();

/* ================= фразы ================= */
/* [тема, по-русски, как сказать, по-тайски, важная]; массив из двух вариантов = [для парня, для девушки] */
const PH = [
  ["food", "Не остро", "Май пхет", "ไม่เผ็ด", 1], ["food", "Чуть-чуть остро", "Пхет нит дио", "เผ็ดนิดเดียว"], ["food", "Без перца чили", "Май сай прик", "ไม่ใส่พริก", 1], ["food", "Очень вкусно", "Аройи мак", "อร่อยมาก"], ["food", "Вода без газа", "Нам плао", "น้ำเปล่า"], ["food", "Без льда", "Май сай нам кхэнг", "ไม่ใส่น้ำแข็ง"], ["food", "Счёт, пожалуйста", "Чек бин", "เช็คบิล"],
  ["basic", "Здравствуйте", ["Сават ди кхап", "Сават ди ка"], ["สวัสดีครับ", "สวัสดีค่ะ"]], ["basic", "Спасибо", ["Кхоп кхун кхап", "Кхоп кхун ка"], ["ขอบคุณครับ", "ขอบคุณค่ะ"]], ["basic", "Ничего страшного", "Май пен рай", "ไม่เป็นไร"], ["basic", "Где туалет?", "Хонг нам ю най?", "ห้องน้ำอยู่ไหน"], ["basic", "Помогите!", "Чуай дуай!", "ช่วยด้วย"],
  ["shop", "Сколько стоит?", "Тхао рай?", "เท่าไหร่"], ["shop", "Слишком дорого", "Пхэн пай", "แพงไป"], ["shop", "Скидку можно?", "Лот ной дай май?", "ลดหน่อยได้ไหม"], ["shop", "Пакет не нужен", "Май ао тхунг", "ไม่เอาถุง"],
  ["taxi", "Включите счётчик", "Кхо пёт митэ", "ขอเปิดมิเตอร์"], ["taxi", "Едем сюда (покажи адрес)", "Пай тхи ни", "ไปที่นี่"], ["taxi", "Остановите здесь", "Чот тхи ни", "จอดที่นี่"]
];
const TABS = [["all", "Все"], ["food", "Еда"], ["basic", "Основное"], ["shop", "Магазин"], ["taxi", "Такси"]];
let tab = "all", gender = store.get("gender", 0) === 1 ? 1 : 0;
const g = v => Array.isArray(v) ? v[gender] : v;
$("#tabs").innerHTML = TABS.map(t => `<button type="button" data-t="${t[0]}" aria-pressed="${t[0] === tab}">${t[1]}</button>`).join("");
function renderPh() {
  $("#plist").innerHTML = PH.map((p, i) => [p, i]).filter(([p]) => tab === "all" || p[0] === tab)
    .map(([p, i], k) => `<div class="card phr${p[4] ? " key" : ""}" style="--i:${Math.min(k, 12)}"><span class="ru">${esc(p[1])}</span><span class="say">${esc(g(p[2]))}</span><span class="th" lang="th">${g(p[3])}</span><span class="acts"><button type="button" class="btn say-btn" data-i="${i}" aria-label="Озвучить: ${esc(p[1])}">${ic("sound")}</button><button type="button" class="btn map show-btn" data-i="${i}">Показать</button></span></div>`).join("");
}
function syncWho() { for (const b of $$("button", $("#who"))) b.setAttribute("aria-pressed", +b.dataset.g === gender); }
/* кнопки вкладок не перерисовываются, поэтому фокус с клавиатуры не теряется */
$("#tabs").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b || b.dataset.t === tab) return;
  tab = b.dataset.t;
  for (const x of $$("button", $("#tabs"))) x.setAttribute("aria-pressed", x === b);
  stopSpeak(); renderPh();
});
$("#who").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b || +b.dataset.g === gender) return;
  gender = +b.dataset.g; store.set("gender", gender); syncWho(); stopSpeak(); renderPh();
});
$("#plist").addEventListener("click", e => {
  const s = e.target.closest(".say-btn"), b = e.target.closest(".show-btn");
  if (s) { const p = PH[s.dataset.i]; speak(g(p[3]), s); }
  else if (b) { const p = PH[b.dataset.i]; openShow(g(p[3]), `${p[1]} · ${g(p[2])}`, b); }
});
syncWho(); renderPh();
$("#nums").innerHTML = [[1, "нынг"], [2, "сонг"], [3, "сам"], [4, "си"], [5, "ха"], [6, "хок"], [7, "чет"], [8, "пэт"], [9, "кхао"], [10, "сип"], [100, "нынг рой"], [1000, "нынг пхан"]].map(n => `<span><b>${n[0]}</b>${n[1]}</span>`).join("");

/* ================= важное ================= */
const TIPS = [["📄", "Загранпаспорта", "У всех троих, включая шестилетнюю сестру. Срок действия не меньше 6 месяцев после вылета."], ["🛂", "Безвиз", "Сейчас для россиян 60 дней, но правила меняются. Проверь на сайте посольства Таиланда и МИД."], ["📝", "Карта прибытия TDAC", "Заполняется онлайн бесплатно перед вылетом. Только на официальном сайте, платные «помощники» это ловушка."], ["🏥", "Страховка", "С покрытием лечения на всех. Купи заранее, это недорого."], ["💵", "Деньги", "Российские карты там часто не работают. Вези наличные доллары и меняй в городе (SuperRich в Бангкоке), в аэропорту курс хуже."], ["🚕", "Такси", "Ставь Grab и Bolt: цена видна заранее. Тук-тук и обычное такси только со счётчиком или с ценой, о которой договорились заранее."], ["🛵", "Скутер и гидроцикл", "Скутер это частая причина травм туристов, с детьми не бери. За «повреждённый» гидроцикл часто требуют деньги, лучше не арендовать."], ["🦟", "Здоровье", "Летом есть комары и денге: репеллент обязателен. SPF 50, панамы, вода всегда с собой."]];
$("#tipsg").innerHTML = TIPS.map(t => `<div class="card tip rv"><span class="em" aria-hidden="true">${t[0]}</span><b>${esc(t[1])}</b><p>${esc(t[2])}</p></div>`).join("");

/* ================= чек-лист ================= */
const CL = [["pass", "Загранпаспорта у троих (срок 6+ месяцев)"], ["fly1", "Билеты Москва ↔ Бангкок"], ["fly2", "Билет Бангкок → Пхукет"], ["stay", "Жильё на все ночи (Booking, Agoda, Trip.com)"], ["ins", "Страховка на троих"], ["tdac", "Карта прибытия TDAC"], ["cash", "Наличные доллары"], ["maps", "Офлайн-карты Google Maps: Бангкок и Пхукет"], ["apps", "Приложения Grab и Bolt"], ["rain", "Дождевики, SPF 50, репеллент"], ["temple", "Одежда для храмов: плечи и колени закрыты"], ["copies", "Копии документов (бумага + фото)"], ["plug", "Универсальный переходник для розетки"], ["meds", "Аптечка: от живота, от температуры, пластыри"]];
const CL_IDS = CL.map(c => c[0]);
/* раньше галочки хранились по номерам строк; переносим их в новый формат по именам */
let done = store.get("check2", null);
if (!Array.isArray(done)) { const old = store.get("check", []); done = Array.isArray(old) ? old.map(i => CL_IDS[i]) : []; }
done = [...new Set(done.filter(id => CL_IDS.includes(id)))];
const clist = $("#clist"), ckReset = $("#ckReset");
clist.innerHTML = CL.map(c => `<label class="card ck rv"><input type="checkbox" data-id="${c[0]}"${done.includes(c[0]) ? " checked" : ""}><span class="box" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5 10 17.5 19 7"/></svg></span><span class="tx"><span>${esc(c[1])}</span></span></label>`).join("");
$("#prog").setAttribute("aria-valuemax", CL.length);
function prog(animate) {
  const n = done.length, pnum = $("#pnum");
  $("#pbar").style.width = (n / CL.length * 100) + "%";
  if (animate) tween(pnum, n, { dur: 400 }); else { pnum.dataset.v = n; pnum.textContent = n; }
  $("#ptext").textContent = n === CL.length ? `из ${CL.length} · всё готово, можно лететь ✈️` : `из ${CL.length} готово`;
  $("#prog").setAttribute("aria-valuenow", n);
  ckReset.hidden = n === 0;
}
clist.addEventListener("change", e => {
  const id = e.target.dataset.id; if (!id) return;
  done = e.target.checked ? [...new Set([...done, id])] : done.filter(x => x !== id);
  store.set("check2", done); prog(true);
  if (e.target.checked && done.length === CL.length) { confetti(); toast("Всё собрано. Хорошей поездки! 🌴"); }
});
let resetArm = 0;
ckReset.addEventListener("click", () => {
  if (Date.now() - resetArm > 3500) {
    resetArm = Date.now(); ckReset.textContent = "Точно сбросить всё?";
    setTimeout(() => { if (Date.now() - resetArm >= 3400) ckReset.textContent = "Сбросить"; }, 3500);
    return;
  }
  resetArm = 0; ckReset.textContent = "Сбросить";
  done = []; store.set("check2", done);
  for (const c of $$("input", clist)) c.checked = false;
  prog(true); toast("Чек-лист сброшен");
});
prog(false);

function confetti() {
  if (reduce()) return;
  const c = document.createElement("canvas"); c.className = "confetti"; document.body.append(c);
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = c.width = innerWidth * dpr, H = c.height = innerHeight * dpr;
  const ctx = c.getContext("2d"), cols = ["#F4C76A", "#13A89E", "#CB3B27", "#FFFFFF", "#0A766F", "#FF9D5C"];
  const P = Array.from({ length: 150 }, () => ({ x: W / 2 + (Math.random() - 0.5) * W * 0.4, y: H * 0.62, vx: (Math.random() - 0.5) * 26 * dpr, vy: -(9 + Math.random() * 19) * dpr, s: (5 + Math.random() * 7) * dpr, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4, c: cols[Math.random() * cols.length | 0], o: 1 }));
  const t0 = performance.now();
  const tick = now => {
    const t = now - t0; ctx.clearRect(0, 0, W, H);
    for (const p of P) {
      p.vy += 0.5 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      if (t > 1700) p.o = Math.max(0, p.o - 0.03);
      ctx.save(); ctx.globalAlpha = p.o; ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66); ctx.restore();
    }
    if (t < 2800) requestAnimationFrame(tick); else c.remove();
  };
  requestAnimationFrame(tick);
  setTimeout(() => c.remove(), 4500);
}

/* ================= прокрутка: параллакс, навигация, линия маршрута ================= */
const hero = $(".hero"), navEl = $(".nav"), chipsBox = $("#chips"), pill = $("#pill"), fab = $("#toTop");
const chips = $$(".chip"), secs = $$("main section[id]"), cityEls = $$(".city"), daysEls = $$(".days"), dayEls = $$(".day");
const stripLinks = new Map($$("#daystrip a").map(a => [+a.dataset.n, a]));
let heroH = 1, activeId, ticking = false;
function movePill(scrollTo = true) {
  const a = chips.find(c => c.classList.contains("on"));
  if (!a) { pill.style.opacity = 0; return; }
  pill.style.opacity = 1;
  pill.style.width = a.offsetWidth + "px";
  pill.style.transform = `translateX(${a.offsetLeft}px)`;
  if (scrollTo) chipsBox.scrollTo({ left: a.offsetLeft - chipsBox.clientWidth / 2 + a.offsetWidth / 2, behavior: reduce() ? "auto" : "smooth" });
}
function setActive(id) {
  if (id === activeId) return;
  activeId = id;
  for (const c of chips) {
    const on = c.hash === "#" + id;
    c.classList.toggle("on", on);
    if (on) c.setAttribute("aria-current", "true"); else c.removeAttribute("aria-current");
  }
  movePill();
}
function frame() {
  ticking = false;
  /* сначала всё измеряем, потом всё записываем: так браузер не пересчитывает вёрстку по нескольку раз за кадр */
  const y = window.scrollY, vh = innerHeight, max = root.scrollHeight - vh;
  const line = navEl.offsetHeight + vh * 0.3, mark = vh * 0.58;
  let id = null;
  for (const s of secs) if (s.getBoundingClientRect().top <= line) id = s.id;
  if (id && max > 0 && y >= max - 4) id = secs[secs.length - 1].id;      /* в самом низу подсвечиваем последний раздел */
  const fills = daysEls.map(d => { const r = d.getBoundingClientRect(); return r.bottom < -200 || r.top > vh + 200 ? null : clamp((mark - r.top - 30) / Math.max(1, r.height - 60)); });
  const passed = dayEls.map(d => d.getBoundingClientRect().top + 30 < mark);
  const par = reduce() ? [] : cityEls.map(c => { const r = c.getBoundingClientRect(); return r.bottom < 0 || r.top > vh ? null : ((r.top + r.height / 2) / vh - 0.5) * -1; });

  hero.style.setProperty("--p", clamp(y / heroH).toFixed(3));
  root.style.setProperty("--sp", (max > 0 ? clamp(y / max) : 0).toFixed(4));
  fab.classList.toggle("on", y > vh * 0.8);
  setActive(id);                                                          /* наверху страницы ни один раздел не подсвечен */
  fills.forEach((f, i) => { if (f != null) daysEls[i].style.setProperty("--f", f.toFixed(4)); });
  passed.forEach((p, i) => {
    const d = dayEls[i];
    if (p !== d.classList.contains("passed")) { d.classList.toggle("passed", p); stripLinks.get(+d.dataset.n)?.classList.toggle("passed", p); }
  });
  par.forEach((v, i) => { if (v != null) cityEls[i].style.setProperty("--py", v.toFixed(3)); });
}
const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
function measure() { heroH = hero.offsetHeight || 1; movePill(false); frame(); }
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", measure);
document.fonts?.ready.then(measure).catch(() => {});
fab.addEventListener("click", () => scrollTo({ top: 0, behavior: reduce() ? "auto" : "smooth" }));

/* ================= поделиться, офлайн ================= */
async function share() {
  const data = { title: document.title, text: "Наш план поездки в Таиланд", url: location.href.split("#")[0] };
  if (navigator.share) { try { await navigator.share(data); } catch { /* закрыли окно */ } }
  else copyText(data.url, "Ссылка скопирована");
}
$("#share").addEventListener("click", share);
$("#share2").addEventListener("click", share);

addEventListener("offline", () => toast("Нет сети. Сайт работает из памяти телефона"));
addEventListener("online", () => toast("Интернет вернулся"));
if ("serviceWorker" in navigator && window.isSecureContext) {
  addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready).then(() => {
      $("#offline").hidden = false;
      /* шрифты при первом заходе грузятся раньше, чем включается офлайн-кэш: докладываем в него те, что реально использованы */
      const warm = () => (document.fonts?.ready || Promise.resolve()).then(() => {
        for (const e of performance.getEntriesByType("resource"))
          if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(e.name)) fetch(e.name, { mode: "cors" }).catch(() => {});
      });
      if (navigator.serviceWorker.controller) warm();
      else navigator.serviceWorker.addEventListener("controllerchange", warm, { once: true });
      if (!store.get("offlineSeen", 0)) { store.set("offlineSeen", 1); toast("Сохранено: сайт откроется и без интернета"); }
    }).catch(() => {});
  });
}

/* ================= старт ================= */
renderTrip();
watch();
measure();
})();
