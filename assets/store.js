(() => {
  const shopOrigin = "https://qualityhomecareproviders.com";
  const cartKey = "qhcp-preview-cart-v1";
  const currency = new Intl.NumberFormat("en-US", {style: "currency", currency: "USD"});
  const cartLinks = document.querySelectorAll(`.q-header a[href="${shopOrigin}/cart"]`);
  const validQuantity = quantity => Number.isInteger(quantity) && quantity >= 1 && quantity <= 99;

  function readCart() {
    try {
      const items = JSON.parse(localStorage.getItem(cartKey) || "[]");
      if (!Array.isArray(items)) return [];
      return items.filter(item => item && /^\d+$/.test(item.variant) &&
        validQuantity(item.quantity) && Number.isSafeInteger(item.cents) && item.cents >= 0 &&
        typeof item.title === "string" && typeof item.option === "string" &&
        typeof item.page === "string" && /^product-[^/\\?#]+\.html$/.test(item.page));
    } catch {
      return [];
    }
  }

  function updateCartLinks(items) {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    for (const link of cartLinks) {
      link.href = "cart.html";
      link.textContent = count ? `Cart (${count})` : "Cart";
    }
  }

  function saveCart(items) {
    try {
      localStorage.setItem(cartKey, JSON.stringify(items));
      updateCartLinks(items);
      return true;
    } catch {
      return false;
    }
  }

  function connectAddToCart(area, select, price, buy) {
    const add = document.createElement("button");
    add.type = "button";
    add.className = "q-btn";
    add.textContent = "Add to cart";
    const message = document.createElement("p");
    message.setAttribute("role", "status");
    const actions = document.createElement("div");
    actions.className = "q-actions";
    buy.before(actions);
    actions.append(add, buy);
    actions.after(message);
    buy.classList.add("q-btn-line");

    const syncAvailability = () => {
      add.disabled = select ? select.selectedOptions[0]?.dataset.available !== "true" :
        buy.textContent.startsWith("Check availability");
      message.textContent = "";
    };
    select?.addEventListener("change", syncAvailability);
    syncAvailability();

    add.addEventListener("click", () => {
      const choice = select?.selectedOptions[0];
      const variant = new URL(buy.href).searchParams.get("variant");
      const displayedPrice = price.textContent.trim();
      const page = decodeURIComponent(location.pathname.split("/").pop());
      if (!/^\d+$/.test(variant || "") || !/^\$[\d,]+\.\d{2}$/.test(displayedPrice)) {
        message.textContent = "This item could not be added. You can check availability on Shopify.";
        return;
      }
      const items = readCart();
      const existing = items.find(item => item.variant === variant);
      if (existing?.quantity === 99) {
        message.textContent = "The maximum quantity for this item is 99.";
        return;
      }
      if (existing) existing.quantity += 1;
      else items.push({
        variant,
        quantity: 1,
        cents: Number(displayedPrice.replace(/[^\d]/g, "")),
        title: area.querySelector("h1").textContent.trim(),
        option: choice?.textContent.trim() || "",
        page,
      });
      if (!saveCart(items)) {
        message.textContent = "Your browser could not save the cart. You can open this item on Shopify.";
        return;
      }
      const view = document.createElement("a");
      view.href = "cart.html";
      view.className = "q-text-link";
      view.textContent = "View cart";
      message.replaceChildren("Added to cart. ", view);
    });
  }

  function connectCart(cart) {
    const empty = cart.querySelector("[data-cart-empty]");
    const filled = cart.querySelector("[data-cart-filled]");
    const lines = cart.querySelector("[data-cart-lines]");
    const subtotal = cart.querySelector("[data-cart-total]");
    const checkout = cart.querySelector("[data-cart-checkout]");
    const message = cart.querySelector("[data-cart-message]");
    const money = cents => currency.format(cents / 100);

    function render(items = readCart()) {
      empty.hidden = items.length > 0;
      filled.hidden = items.length === 0;
      lines.replaceChildren();
      for (const item of items) {
        const row = document.createElement("li");
        row.className = "q-cart-line";
        row.innerHTML = '<div><a class="q-text-link"></a><p></p></div><label>Quantity <input type="number" min="1" max="99" step="1"></label><strong></strong><button type="button" class="q-btn q-btn-line">Remove</button>';
        const link = row.querySelector("a");
        link.href = encodeURIComponent(item.page);
        link.textContent = item.title;
        row.querySelector("p").textContent = item.option ? `${item.option} · ${money(item.cents)} each` : `${money(item.cents)} each`;
        row.querySelector("strong").textContent = money(item.cents * item.quantity);
        const quantity = row.querySelector("input");
        quantity.value = item.quantity;
        quantity.setAttribute("aria-label", `Quantity for ${item.title}`);
        quantity.addEventListener("change", () => {
          const amount = quantity.valueAsNumber;
          if (!validQuantity(amount)) {
            quantity.value = item.quantity;
            message.textContent = "Enter a whole number between 1 and 99.";
            return;
          }
          const next = readCart().map(entry => entry.variant === item.variant ? {...entry, quantity: amount} : entry);
          if (!saveCart(next)) {
            quantity.value = item.quantity;
            message.textContent = "The quantity could not be saved.";
            return;
          }
          item.quantity = amount;
          row.querySelector("strong").textContent = money(item.cents * amount);
          updateSummary(next);
          message.textContent = "Quantity updated.";
        });
        row.querySelector("button").addEventListener("click", () => {
          const next = readCart().filter(entry => entry.variant !== item.variant);
          if (!saveCart(next)) {
            message.textContent = "The item could not be removed.";
            return;
          }
          render(next);
          message.textContent = "Item removed.";
          (lines.querySelector("button") || empty.querySelector("a")).focus();
        });
        lines.append(row);
      }
      updateSummary(items);
    }

    function updateSummary(items) {
      subtotal.textContent = money(items.reduce((total, item) => total + item.cents * item.quantity, 0));
      if (items.length) checkout.href = `${shopOrigin}/cart/${items.map(item => `${item.variant}:${item.quantity}`).join(",")}`;
      else checkout.removeAttribute("href");
    }

    render();
    addEventListener("pageshow", () => render());
    addEventListener("storage", event => { if (event.key === cartKey) render(); });
  }

  updateCartLinks(readCart());
  addEventListener("pageshow", () => updateCartLinks(readCart()));
  addEventListener("storage", event => { if (event.key === cartKey) updateCartLinks(readCart()); });
  const cart = document.querySelector("[data-cart]");
  if (cart) connectCart(cart);

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
    if (buy && price) connectAddToCart(area, select, price, buy);
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
