(() => {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  for (const carousel of document.querySelectorAll("[data-carousel]")) {
    const track = carousel.querySelector("[data-track]");
    const controls = carousel.querySelector("[data-carousel-controls]");
    let visible = false;
    let timer;
    const move = direction => {
      const first = track.children[0];
      const second = track.children[1];
      if (!first || !second) return;
      const step = second.offsetLeft - first.offsetLeft;
      const max = track.scrollWidth - track.clientWidth;
      const current = track.scrollLeft;
      let next = current + step * direction;
      if (direction > 0 && current >= max - 4) next = 0;
      if (direction < 0 && current < 4) next = max;
      track.scrollTo({left: Math.max(0, Math.min(max, next)), behavior: reducedMotion.matches ? "instant" : "smooth"});
    };
    const schedule = () => {
      clearInterval(timer);
      if (visible && !reducedMotion.matches && !document.hidden &&
          !carousel.matches(":hover") && !carousel.contains(document.activeElement)) {
        timer = setInterval(() => move(1), 6500);
      }
    };
    controls.hidden = false;
    carousel.querySelector("[data-prev]").addEventListener("click", () => move(-1));
    carousel.querySelector("[data-next]").addEventListener("click", () => move(1));
    for (const event of ["mouseenter","mouseleave","focusin","focusout"]) {
      carousel.addEventListener(event, () => requestAnimationFrame(schedule));
    }
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); }, {threshold:.15}).observe(carousel);
    reducedMotion.addEventListener("change", schedule);
    document.addEventListener("visibilitychange", schedule);
    schedule();
  }

  for (const area of document.querySelectorAll("[data-product]")) {
    const select = area.querySelector("[data-variant]");
    const price = area.querySelector("[data-price]");
    const buy = area.querySelector("[data-buy]");
    const image = area.querySelector("[data-main-image]");
    for (const button of area.querySelectorAll("[data-gallery]")) {
      button.addEventListener("click", () => {
        image.src = button.dataset.gallery;
        for (const item of area.querySelectorAll("[data-gallery]")) {
          item.setAttribute("aria-pressed", String(item === button));
        }
      });
    }
    if (!select) continue;
    const update = () => {
      const choice = select.selectedOptions[0];
      price.textContent = choice.dataset.price;
      buy.href = choice.dataset.url;
      buy.textContent = choice.dataset.available === "true" ? "View option on Shopify ↗" : "Check availability on Shopify ↗";
    };
    select.addEventListener("change", update);
  }

  const form = document.querySelector("[data-catalog]");
  if (!form) return;
  const cards = [...document.querySelectorAll("[data-catalog-card]")];
  const term = form.elements.q;
  const collection = form.elements.collection;
  const sort = form.elements.sort;
  const status = document.querySelector("[data-count]");
  const pages = document.querySelector("[data-pagination]");
  const size = 15;
  const normalize = text => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  let current = 1;
  function fromUrl() {
    const params = new URLSearchParams(location.search);
    term.value = params.get("q") || "";
    collection.value = params.get("collection") || "";
    sort.value = params.get("sort") || "name";
    current = Number.parseInt(params.get("page"), 10) || 1;
  }
  function toUrl(method) {
    const params = new URLSearchParams();
    if (term.value.trim()) params.set("q", term.value.trim());
    if (collection.value) params.set("collection", collection.value);
    if (sort.value && sort.value !== "name") params.set("sort", sort.value);
    if (current !== 1) params.set("page", current);
    const query = params.toString();
    try { history[method](null, "", location.pathname + (query ? "?" + query : "")); } catch (_) { /* file previews can restrict history */ }
  }
  function addButton(label, page, options = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (options.name) button.setAttribute("aria-label", options.name);
    if (options.current) button.setAttribute("aria-current", "page");
    if (options.disabled) button.disabled = true;
    button.addEventListener("click", () => {
      current = page;
      render();
      toUrl("pushState");
      status.focus();
    });
    pages.append(button);
  }
  function render() {
    const tokens = normalize(term.value).split(/\s+/).filter(Boolean);
    const ordered = [...cards];
    if (sort.value === "low" || sort.value === "high") {
      const direction = sort.value === "low" ? 1 : -1;
      ordered.sort((a,b) => direction * (Number(a.dataset.price) - Number(b.dataset.price)));
    }
    const matches = ordered.filter(card => (!collection.value || card.dataset.collections.split(" ").includes(collection.value)) &&
      tokens.every(token => normalize(card.dataset.keywords).includes(token)));
    const totalPages = Math.max(1, Math.ceil(matches.length / size));
    current = Math.max(1, Math.min(totalPages, current));
    const start = (current - 1) * size;
    const visible = new Set(matches.slice(start, start + size));
    const grid = cards[0].parentElement;
    for (const card of ordered) { card.hidden = !visible.has(card); grid.append(card); }
    status.textContent = matches.length ? `${start + 1}–${Math.min(start + size, matches.length)} of ${matches.length} products` : "No products found. Try a different search or collection.";
    pages.replaceChildren();
    if (totalPages < 2) return;
    addButton("←", current - 1, {name:"Previous page",disabled:current === 1});
    for (let index = 1; index <= totalPages; index++) addButton(String(index), index, {name:"Page " + index,current:index === current});
    addButton("→", current + 1, {name:"Next page",disabled:current === totalPages});
  }
  form.addEventListener("submit", event => {
    event.preventDefault();
    current = 1;
    render();
    toUrl("pushState");
  });
  term.addEventListener("input", () => { current = 1; render(); toUrl("replaceState"); });
  for (const field of [collection, sort]) field.addEventListener("change", () => { current = 1; render(); toUrl("pushState"); });
  addEventListener("popstate", () => { fromUrl(); render(); });
  fromUrl();
  render();
})();
