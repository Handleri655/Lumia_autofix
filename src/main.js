const CONTACT_EMAIL = "info@lumiaautofix.fi";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const SERVICES_PREVIEW = 12;

async function fetchServices() {
  try {
    const res = await fetch("/api/services");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.services) ? data.services : [];
  } catch (err) {
    console.error("Palveluiden lataus epäonnistui:", err);
    return [];
  }
}

async function fetchOffers() {
  try {
    const res = await fetch("/api/offers");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.offers) ? data.offers : [];
  } catch (err) {
    console.error("Tarjousten lataus epäonnistui:", err);
    return [];
  }
}

async function fillOffers() {
  const section = document.getElementById("tarjoukset");
  const el = document.getElementById("offers-list");
  const navLink = document.querySelector('.nav a[data-section="tarjoukset"]');
  if (!section || !el) return;

  const offers = await fetchOffers();
  el.replaceChildren();

  if (!offers.length) {
    section.hidden = true;
    if (navLink) navLink.hidden = true;
    return;
  }

  section.hidden = false;
  if (navLink) navLink.hidden = false;

  const frag = document.createDocumentFragment();
  for (const offer of offers) {
    const article = document.createElement("article");
    article.className = "offer-card surface";

    const title = document.createElement("h3");
    title.textContent = offer.title;

    article.appendChild(title);

    if (offer.priceText) {
      const price = document.createElement("p");
      price.className = "offer-price";
      price.textContent = offer.priceText;
      article.appendChild(price);
    }

    if (offer.description) {
      const desc = document.createElement("p");
      desc.className = "offer-desc";
      desc.textContent = offer.description;
      article.appendChild(desc);
    }

    const cta = document.createElement("a");
    cta.className = "offer-link";
    cta.href = "#yhteys";
    cta.textContent = "Kysy tarjouksesta";
    article.appendChild(cta);

    frag.appendChild(article);
  }
  el.appendChild(frag);
}

async function fillServices() {
  const el = document.getElementById("services-list");
  const toggle = document.getElementById("services-toggle");
  if (!el) return;

  const services = await fetchServices();
  el.replaceChildren();

  if (!services.length) {
    const li = document.createElement("li");
    li.className = "service-empty";
    li.textContent = "Palveluita ei voitu ladata juuri nyt.";
    el.appendChild(li);
    if (toggle) toggle.hidden = true;
    return;
  }

  const frag = document.createDocumentFragment();
  services.forEach((item, index) => {
    const li = document.createElement("li");
    if (index >= SERVICES_PREVIEW) li.classList.add("is-extra");

    const name = document.createElement("span");
    name.className = "service-name";
    name.textContent = item.name;

    const price = document.createElement("span");
    price.className = "service-price";
    price.textContent = item.priceText || "Pyydä tarjous";

    li.append(name, price);
    frag.appendChild(li);
  });
  el.appendChild(frag);

  if (!toggle || services.length <= SERVICES_PREVIEW) {
    if (toggle) toggle.hidden = true;
    return;
  }

  toggle.hidden = false;
  el.classList.add("is-collapsed");

  toggle.addEventListener("click", () => {
    const collapsed = el.classList.toggle("is-collapsed");
    toggle.textContent = collapsed ? "Näytä kaikki palvelut" : "Näytä vähemmän";
  });
}

const BRANDS = [
  "Alfa Romeo",
  "Aston Martin",
  "Audi",
  "Bentley",
  "BMW",
  "Buick",
  "BYD",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Citroen",
  "Cupra",
  "Dacia",
  "Daewoo",
  "Daihatsu",
  "Daimler",
  "Datsun",
  "DFSK",
  "Dodge",
  "Dongfeng",
  "DS",
  "Ferrari",
  "Fiat",
  "Fisker",
  "Ford",
  "GMC",
  "Honda",
  "Hummer",
  "Hyundai",
  "Infiniti",
  "Isuzu",
  "Iveco",
  "Jaguar",
  "Jeep",
  "KGM",
  "KIA",
  "Lada",
  "Lamborghini",
  "Lancia",
  "Land Rover",
  "Lexus",
  "Lincoln",
  "Lotus",
  "Maserati",
  "Maxus",
  "Mazda",
  "Mercedes-Benz",
  "Mercury",
  "MG",
  "Mini",
  "Mitsubishi",
  "Moskvitsh",
  "Nissan",
  "Oldsmobile",
  "Opel",
  "Peugeot",
  "Plymouth",
  "Polestar",
  "Pontiac",
  "Porsche",
  "RAM",
  "Renault",
  "Rolls-Royce",
  "Rover",
  "Saab",
  "Seat",
  "Seres",
  "Skoda",
  "Skywell",
  "Smart",
  "SsangYong",
  "Subaru",
  "Suzuki",
  "Tesla",
  "Toyota",
  "Triumph",
  "Vauxhall",
  "Volkswagen",
  "Volvo",
  "Voyah",
];

function setupMarquee() {
  const host = document.getElementById("brand-marquee");
  if (!host) return;

  const track = document.createElement("div");
  track.className = "marquee-track";
  const sequence = [...BRANDS, ...BRANDS];
  for (const brand of sequence) {
    const span = document.createElement("span");
    span.textContent = brand;
    track.appendChild(span);
  }
  host.appendChild(track);
}

function setupHeader() {
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".menu-btn");
  const nav = document.querySelector(".nav");
  if (!header || !toggle || !nav) return;

  const links = [...nav.querySelectorAll("a[data-section]")];

  const onScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  toggle.addEventListener("click", () => {
    const open = !document.body.classList.contains("nav-open");
    document.body.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });

  links.forEach((link) => {
    link.addEventListener("click", () => {
      document.body.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });

  const sections = links
    .map((link) => document.getElementById(link.dataset.section))
    .filter(Boolean);

  if (!sections.length || !("IntersectionObserver" in window)) return;

  const io = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const id = visible.target.id;
      links.forEach((link) => {
        link.classList.toggle("is-active", link.dataset.section === id);
      });
    },
    { rootMargin: "-35% 0px -45% 0px", threshold: [0.1, 0.35, 0.6] },
  );

  sections.forEach((section) => io.observe(section));
}

function setupReveal() {
  const map = [
    ["#tarjoukset .section-intro", ""],
    [".offers-grid", "d1"],
    ["#palvelut .section-intro", ""],
    [".service-grid", "d1"],
    [".quote-panel", ""],
    ["#merkit .section-intro", ""],
    [".marquee", "d1"],
    ["#meista .section-intro", ""],
    [".facts", "d1"],
    [".perks", "d2"],
    [".reviews-head", ""],
    [".reviews-featured", "d1"],
    [".reviews-grid", "d2"],
    [".contact-copy", ""],
    [".contact-form", "d1"],
    [".map-panel", "d2"],
  ];

  const targets = [];
  for (const [selector, delay] of map) {
    document.querySelectorAll(selector).forEach((el) => {
      el.classList.add("reveal");
      if (delay) el.classList.add(delay);
      targets.push(el);
    });
  }

  if (!("IntersectionObserver" in window) || reduceMotion) {
    targets.forEach((el) => el.classList.add("is-in"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
  );

  targets.forEach((el) => io.observe(el));
}

function setupParallax() {
  const heroImg = document.querySelector(".hero-img");
  if (!heroImg || reduceMotion) return;

  let ticking = false;

  const update = () => {
    const shift = Math.min(window.scrollY * 0.22, 100);
    heroImg.style.transform = `scale(1.08) translate3d(0, ${shift}px, 0)`;
    ticking = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true },
  );

  update();
}

function setupContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const email = String(data.get("email") || "").trim();
    const message = String(data.get("message") || "").trim();
    if (!name || !phone || !email || !message) {
      form.reportValidity();
      return;
    }

    const subject = encodeURIComponent(`Yhteydenotto: ${name}`);
    const body = encodeURIComponent(
      `Nimi: ${name}\nPuhelin: ${phone}\nSähköposti: ${email}\n\n${message}`,
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  });
}

fillOffers();
fillServices();
setupMarquee();
setupHeader();
setupReveal();
setupParallax();
setupContactForm();

const year = document.getElementById("year");
if (year) year.textContent = String(new Date().getFullYear());
