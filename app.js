const STORAGE_KEY = "pokemon-collection-v2";
const SETS_CACHE_KEY = "pokemon-collection-v2-sets";
const TCG_API = "https://api.pokemontcg.io/v2";

const typeColors = {
  Electric: "#f2bf27", Fire: "#f36b3f", Water: "#3d8fe3", Grass: "#45a86b",
  Psychic: "#cf69c8", Normal: "#9da5ae", Dragon: "#6a70d6", Dark: "#3d4652",
  Fairy: "#ee85b8", Fighting: "#c65542", Ghost: "#6d5aa6", Poison: "#9a61b8", Flying: "#7fa6d9"
};

const pokedex = [
  { id: 1,   name: "Bulbasaur",  types: ["Grass"],           region: "Kanto",  lore: "Een rustige partner die energie opslaat in de knop op zijn rug en sterker wordt in zonlicht." },
  { id: 4,   name: "Charmander", types: ["Fire"],            region: "Kanto",  lore: "Zijn staartvlam reageert op stemming en gezondheid, waardoor trainers hem goed leren lezen." },
  { id: 6,   name: "Charizard",  types: ["Fire", "Flying"],  region: "Kanto",  lore: "Charizard staat bekend om vurige kracht en kaarten die vaak het pronkstuk van een collectie worden." },
  { id: 7,   name: "Squirtle",   types: ["Water"],           region: "Kanto",  lore: "Trekt zich snel terug in zijn schild en gebruikt waterstoten met verrassende precisie." },
  { id: 25,  name: "Pikachu",    types: ["Electric"],        region: "Kanto",  lore: "Slaat elektriciteit op in zijn wangen en werkt het best met een trainer die zijn tempo aanvoelt." },
  { id: 39,  name: "Jigglypuff", types: ["Normal", "Fairy"], region: "Kanto",  lore: "Zijn zang kan een hele kamer stil krijgen, meestal gevolgd door diepe slaap." },
  { id: 94,  name: "Gengar",     types: ["Ghost", "Poison"], region: "Kanto",  lore: "Duikt op in schaduwen en lijkt plezier te halen uit slim getimede verrassingen." },
  { id: 130, name: "Gyarados",   types: ["Water", "Flying"], region: "Kanto",  lore: "Een zeldzame evolutie met enorme kracht en een reputatie die elke verzamelmap extra gewicht geeft." },
  { id: 143, name: "Snorlax",    types: ["Normal"],          region: "Kanto",  lore: "Slaapt bijna overal en staat bekend als een vriendelijke reus met een onverstoorbare rust." },
  { id: 149, name: "Dragonite",  types: ["Dragon", "Flying"],region: "Kanto",  lore: "Vliegt met hoge snelheid over zee en helpt verdwaalde mensen en Pokemon terug naar veiligheid." },
  { id: 150, name: "Mewtwo",     types: ["Psychic"],         region: "Kanto",  lore: "Een krachtige en mysterieuze Pokemon die vaak het middelpunt is van legendarische collecties." },
  { id: 197, name: "Umbreon",    types: ["Dark"],            region: "Johto",  lore: "Zijn ringen lichten op in het donker, waardoor hij een opvallende kaart blijft in elke binder." },
  { id: 448, name: "Lucario",    types: ["Fighting"],        region: "Sinnoh", lore: "Voelt aura's aan en staat symbool voor focus, discipline en sterke trainerbanden." }
];

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

const seedCards = [
  { id: newId(), pokemon: "Pikachu",   set: "Celebrations",   number: "005/025",    rarity: "Holo Rare",   condition: "Near Mint", quantity: 2, value: 9.5,  status: "owned",    collection: "Lars", addedAt: "2026-06-10" },
  { id: newId(), pokemon: "Charizard", set: "Obsidian Flames", number: "223/197",   rarity: "Secret Rare", condition: "Excellent",  quantity: 1, value: 72,   status: "owned",    collection: "Lars", addedAt: "2026-06-18" },
  { id: newId(), pokemon: "Bulbasaur", set: "Pokemon 151",     number: "001/165",   rarity: "Common",      condition: "Near Mint", quantity: 3, value: 1.2,  status: "owned",    collection: "Lore", addedAt: "2026-06-22" },
  { id: newId(), pokemon: "Mewtwo",    set: "Crown Zenith",    number: "GG44/GG70", rarity: "Ultra Rare",  condition: "Near Mint", quantity: 1, value: 58,   status: "wishlist", collection: "Lars", addedAt: "2026-06-24" },
  { id: newId(), pokemon: "Umbreon",   set: "Evolving Skies",  number: "215/203",   rarity: "Secret Rare", condition: "Near Mint", quantity: 1, value: 640,  status: "wishlist", collection: "Lore", addedAt: "2026-06-25" }
];

let cards = loadCards();
let state = {
  view: "dashboard",
  sortAsc: true,
  lorePokemon: "Pikachu",
  selectedSetId: "",
  setQuery: "",
  activeOwner: "Lars"   // ← Lars / Lore switch
};
let tcgSets = loadCachedSets();
let setCards = [];
let setCardsById = {};
let setsLoaded = false;

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* ── Helpers ── */
function spriteUrl(name) {
  const entry = pokedex.find(p => p.name.toLowerCase() === name.toLowerCase());
  return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/" +
    ((entry && entry.id) || 25) + ".png";
}
function typeFor(name) {
  const entry = pokedex.find(p => p.name.toLowerCase() === name.toLowerCase());
  return (entry && entry.types[0]) || "Normal";
}
function typeForCard(card) {
  if (card && Array.isArray(card.types) && card.types.length) return card.types[0];
  return typeFor(card && card.pokemon ? card.pokemon : "");
}
function cardImageUrl(card, preferredSize = "small") {
  if (!card) return spriteUrl("Pikachu");
  if (preferredSize === "large" && card.imageLarge) return card.imageLarge;
  if (card.imageSmall) return card.imageSmall;
  if (card.imageLarge) return card.imageLarge;
  return spriteUrl(card.pokemon);
}
function formatMoney(value) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(value);
}
function loadCards() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || seedCards; } catch (e) { return seedCards; }
}
function saveCards() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}
function loadCachedSets() {
  try { return JSON.parse(localStorage.getItem(SETS_CACHE_KEY)) || []; } catch (e) { return []; }
}
function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}
function ownedKey(setName, number) {
  return normalizeText(setName) + "::" + normalizeText(number);
}
function collectionKeys() {
  const owned = new Set(), wishlist = new Set();
  activeCards().forEach(card => {
    const key = ownedKey(card.set, card.number);
    if (card.status === "owned") owned.add(key);
    if (card.status === "wishlist") wishlist.add(key);
  });
  return { owned, wishlist };
}

/* ── Active collection filter (Lars / Lore) ── */
function activeCards() {
  return cards.filter(c => c.collection === state.activeOwner);
}
function ownedCards() {
  return activeCards().filter(c => c.status === "owned");
}

/* ── View routing ── */
function setView(view) {
  state.view = view;
  $$(".view").forEach(el => el.classList.toggle("active-view", el.id === view));
  $$(".nav-tab").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  const titles = {
    dashboard: ["Overzicht", "Dashboard"],
    collection: ["Binder", "Collectie"],
    sets:       ["Catalogus", "Sets"],
    pokedex:    ["Database", "Pokedex"],
    manage:     ["Invoer", "Beheer"],
    lore:       ["Verhalen", "Lore"]
  };
  $("#viewKicker").textContent = titles[view][0];
  $("#viewTitle").textContent  = titles[view][1];
  window.scrollTo(0, 0);
  render();
}

/* ── Master render ── */
function render() {
  renderFilters();
  renderDashboard();
  renderCollection();
  renderSets();
  renderPokedex();
  renderManage();
  renderLore();
}

function renderFilters() {
  const types    = Array.from(new Set(pokedex.flatMap(p => p.types))).sort();
  const rarities = Array.from(new Set(cards.map(c => c.rarity))).sort();
  fillSelect("#typeFilter",   ["all"].concat(types),    "Alle types");
  fillSelect("#pokedexType",  ["all"].concat(types),    "Alle types");
  fillSelect("#rarityFilter", ["all"].concat(rarities), "Alle zeldzaamheden");
}
function fillSelect(selector, values, allLabel) {
  const select = $(selector);
  const current = select.value;
  select.innerHTML = values.map(v =>
    `<option value="${v}">${v === "all" ? allLabel : v}</option>`
  ).join("");
  select.value = values.includes(current) ? current : "all";
}

/* ── Dashboard ── */
function renderDashboard() {
  const owned = ownedCards();
  const totalCards    = owned.reduce((s, c) => s + Number(c.quantity), 0);
  const uniquePokemon = new Set(owned.map(c => c.pokemon.toLowerCase())).size;
  const totalValue    = owned.reduce((s, c) => s + Number(c.value) * Number(c.quantity), 0);
  const wishlist      = activeCards().filter(c => c.status === "wishlist").length;
  const completion    = Math.round((uniquePokemon / pokedex.length) * 100);

  $("#metricCards").textContent    = totalCards;
  $("#metricPokemon").textContent  = uniquePokemon;
  $("#metricValue").textContent    = formatMoney(totalValue);
  $("#metricWishlist").textContent = wishlist;
  $("#completionLabel").textContent = completion + "%";
  $("#completionBar").style.width   = completion + "%";

  const counts = {};
  owned.forEach(card => {
    const t = typeForCard(card);
    counts[t] = (counts[t] || 0) + Number(card.quantity);
  });
  $("#typeBreakdown").innerHTML = Object.entries(counts)
    .map(([t, n]) => `<span class="type-pill"><span class="type-dot" style="--type-color:${typeColors[t] || "#73808c"}"></span>${t} ${n}</span>`)
    .join("") || `<div class="empty-state">Nog geen typeverdeling.</div>`;

  $("#recentList").innerHTML = activeCards()
    .slice().sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
    .slice(0, 5).map(compactRow).join("");
}
function compactRow(card) {
  return `<div class="compact-row">
    <img class="sprite" src="${cardImageUrl(card)}" alt="${card.pokemon}" />
    <div><strong>${card.pokemon}</strong><p>${card.set} — ${card.rarity}</p></div>
    <span class="value">${formatMoney(Number(card.value))}</span>
  </div>`;
}

/* ── Collection ── */
function renderCollection() {
  const query  = $("#collectionSearch").value.trim().toLowerCase();
  const type   = $("#typeFilter").value;
  const rarity = $("#rarityFilter").value;
  const filtered = ownedCards()
    .filter(c => !query || (c.pokemon + " " + c.set + " " + c.number).toLowerCase().includes(query))
    .filter(c => type   === "all" || typeForCard(c) === type)
    .filter(c => rarity === "all" || c.rarity === rarity)
    .sort((a, b) => state.sortAsc ? a.pokemon.localeCompare(b.pokemon) : b.pokemon.localeCompare(a.pokemon));
  $("#collectionGrid").innerHTML = filtered.map(cardTemplate).join("") ||
    `<div class="empty-state">Geen kaarten gevonden.</div>`;
}
function cardTemplate(card) {
  const type = typeForCard(card);
  const tint = (typeColors[type] || "#d8e1ea") + "30";
  const image = cardImageUrl(card);
  return `<article class="pokemon-card" style="--card-tint:${tint}">
    <span class="type-pill"><span class="type-dot" style="--type-color:${typeColors[type] || "#73808c"}"></span>${type}</span>
    <img src="${image}" alt="${card.pokemon}" />
    <h3>${card.pokemon}</h3>
    <p>${card.set} — ${card.number || "zonder nummer"}</p>
    <p>${card.rarity} · ${card.condition} · x${card.quantity}</p>
    <div class="card-footer">
      <span class="value">${formatMoney(Number(card.value) * Number(card.quantity))}</span>
      <button class="text-action" data-detail="${card.id}" type="button">Details</button>
    </div>
  </article>`;
}

/* ── Pokédex ── */
function renderPokedex() {
  const query = $("#pokedexSearch").value.trim().toLowerCase();
  const type  = $("#pokedexType").value;
  const ownedNames = new Set(ownedCards().map(c => c.pokemon.toLowerCase()));
  const filtered = pokedex
    .filter(e => !query || e.name.toLowerCase().includes(query))
    .filter(e => type === "all" || e.types.includes(type));
  $("#pokedexGrid").innerHTML = filtered.map(entry => {
    const mt    = entry.types[0];
    const owned = ownedNames.has(entry.name.toLowerCase());
    return `<article class="pokemon-card" style="--card-tint:${(typeColors[mt] || "#d8e1ea") + "30"}">
      <span class="type-pill"><span class="type-dot" style="--type-color:${typeColors[mt] || "#73808c"}"></span>#${String(entry.id).padStart(3,"0")}</span>
      <img src="${spriteUrl(entry.name)}" alt="${entry.name}" />
      <h3>${entry.name}</h3>
      <p>${entry.region} · ${entry.types.join(" / ")}</p>
      <div class="card-footer">
        <span class="rarity-pill">${owned ? "✓ In collectie" : "Nog zoeken"}</span>
        <button class="text-action" data-lore="${entry.name}" type="button">Lore</button>
      </div>
    </article>`;
  }).join("") || `<div class="empty-state">Geen Pokemon gevonden.</div>`;
}

/* ── Beheer ── */
function renderManage() {
  $("#manageList").innerHTML = activeCards().map(card =>
    `<div class="manage-row">
      <img class="sprite" src="${cardImageUrl(card)}" alt="${card.pokemon}" />
      <div><strong>${card.pokemon}</strong><p>${card.status === "owned" ? "Collectie" : "Wishlist"} · ${card.set} · x${card.quantity}</p></div>
      <button data-delete="${card.id}" type="button" aria-label="Verwijderen">✕</button>
    </div>`
  ).join("");
}

/* ── Lore ── */
function renderLore() {
  const entry = pokedex.find(p => p.name === state.lorePokemon) || pokedex[4];
  $("#loreSprite").src        = spriteUrl(entry.name);
  $("#loreName").textContent  = entry.name;
  $("#loreText").textContent  = entry.lore;
  $("#loreList").innerHTML = pokedex.map(item =>
    `<div class="lore-row" data-lore="${item.name}">
      <img class="sprite" src="${spriteUrl(item.name)}" alt="${item.name}" />
      <div><strong>${item.name}</strong><p>${item.region} · ${item.types.join(" / ")}</p></div>
    </div>`
  ).join("");
}

/* ── Sets ── */
async function loadSets(force) {
  if (setsLoaded && !force) return;
  const status = $("#setsStatus");
  if (status) status.textContent = tcgSets.length
    ? "Sets worden bijgewerkt…"
    : "Sets worden geladen uit de Pokemon TCG API…";
  try {
    const res = await fetch(TCG_API + "/sets?orderBy=-releaseDate");
    if (!res.ok) throw new Error();
    const payload = await res.json();
    tcgSets = payload.data || [];
    localStorage.setItem(SETS_CACHE_KEY, JSON.stringify(tcgSets));
    setsLoaded = true;
  } catch (e) {
    if (status) status.textContent = tcgSets.length
      ? "Offline cache gebruikt voor sets."
      : "Sets konden niet worden geladen. Controleer je internetverbinding.";
  }
  renderSets();
}

async function loadSetCards(setId) {
  if (!setId) return;
  state.selectedSetId = setId;
  setCards = []; setCardsById = {};
  const title = $("#setCardsTitle"), grid = $("#setCardsGrid");
  const selected = tcgSets.find(s => s.id === setId);
  if (title) title.textContent = selected ? selected.name : "Set";
  if (grid)  grid.innerHTML = `<div class="empty-state">Kaarten worden geladen…</div>`;
  updateSetProgress(selected, []);
  try {
    let page = 1, all = [];
    while (true) {
      const url = `${TCG_API}/cards?q=set.id:${encodeURIComponent(setId)}&orderBy=number&pageSize=250&page=${page}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const payload = await res.json();
      const batch = payload.data || [];
      all = all.concat(batch);
      if (batch.length < 250) break;
      page++;
    }
    setCards = all;
    setCardsById = Object.fromEntries(all.map(c => [c.id, c]));
  } catch (e) {
    if (grid) grid.innerHTML = `<div class="empty-state">Kaarten konden niet worden geladen voor deze set.</div>`;
    return;
  }
  renderSets();
}

function filteredSets() {
  const q = state.setQuery;
  return tcgSets.filter(s =>
    !q || normalizeText(s.name + " " + s.series + " " + s.releaseDate).includes(normalizeText(q))
  );
}

function setOwnedStats(set) {
  const total = Number(set.total || set.printedTotal || 0);
  const ownedCount = activeCards().filter(c =>
    c.status === "owned" && normalizeText(c.set) === normalizeText(set.name)
  ).length;
  return { ownedCount, total };
}

function renderSets() {
  const setSearch = $("#setSearch"), setSelect = $("#setSelect");
  const status = $("#setsStatus"), grid = $("#setsGrid");
  if (!setSearch || !setSelect || !grid) return;
  if (!tcgSets.length && !setsLoaded) {
    if (status) status.textContent = "Sets worden geladen…";
    grid.innerHTML = `<div class="empty-state">Nog geen sets geladen.</div>`;
    updateSetProgress(null, []); return;
  }
  const sets = filteredSets();
  if (status) status.innerHTML = `${tcgSets.length} sets beschikbaar via de Pokemon TCG API. <span class="api-note">Kies een set om alle kaarten te zien.</span>`;
  const current = setSelect.value || state.selectedSetId;
  setSelect.innerHTML = `<option value="">Set kiezen</option>` +
    tcgSets.map(s => `<option value="${s.id}">${s.name} (${s.releaseDate || ""})</option>`).join("");
  setSelect.value = tcgSets.some(s => s.id === current) ? current : "";
  grid.innerHTML = sets.map(set => {
    const stats = setOwnedStats(set);
    return `<button class="set-card ${state.selectedSetId === set.id ? "active" : ""}" data-set-id="${set.id}" type="button">
      <img src="${(set.images && set.images.logo) || ""}" alt="${set.name}" />
      <div><strong>${set.name}</strong><p>${set.series || ""} · ${set.releaseDate || ""}</p></div>
      <span class="set-count">${stats.ownedCount}/${stats.total}</span>
    </button>`;
  }).join("") || `<div class="empty-state">Geen sets gevonden.</div>`;
  const selected = tcgSets.find(s => s.id === state.selectedSetId);
  renderSetCards(selected);
}

function updateSetProgress(set, cardsInSet) {
  const keys  = collectionKeys();
  const total = cardsInSet.length || Number(set && (set.total || set.printedTotal)) || 0;
  const owned = cardsInSet.length
    ? cardsInSet.filter(c => keys.owned.has(ownedKey(c.set.name, c.number))).length
    : 0;
  const percent = total ? Math.round((owned / total) * 100) : 0;
  const label = $("#setProgressLabel"), bar = $("#setProgressBar");
  if (label) label.textContent = owned + "/" + total;
  if (bar)   bar.style.width   = percent + "%";
}

function renderSetCards(set) {
  const title = $("#setCardsTitle"), grid = $("#setCardsGrid");
  if (!title || !grid) return;
  if (!set) {
    title.textContent = "Kies een set";
    grid.innerHTML = `<div class="empty-state">Selecteer links een set om de kaarten te laden.</div>`;
    updateSetProgress(null, []); return;
  }
  title.textContent = set.name;
  updateSetProgress(set, setCards);
  if (!setCards.length) {
    grid.innerHTML = `<div class="empty-state">Klik op deze set om alle kaarten te laden.</div>`;
    return;
  }
  const keys = collectionKeys();
  grid.innerHTML = setCards.map(card => {
    const key   = ownedKey(card.set.name, card.number);
    const owned = keys.owned.has(key);
    const wish  = keys.wishlist.has(key);
    const cls   = owned ? " owned" : wish ? " wishlist" : "";
    const image = (card.images && (card.images.small || card.images.large)) || spriteUrl(card.name);
    return `<article class="set-card-item${cls}">
      <img src="${image}" alt="${card.name}" />
      <h3>${card.name}</h3>
      <p>#${card.number} · ${card.rarity || "Onbekend"}</p>
      <p>${card.supertype || "Card"}</p>
      <div class="set-card-actions">
        <button data-add-card="${card.id}" type="button" ${owned ? "disabled" : ""}>${owned ? "In bezit" : "Heb ik"}</button>
        <button data-wish-card="${card.id}" type="button" ${wish || owned ? "disabled" : ""}>Wishlist</button>
      </div>
    </article>`;
  }).join("");
}

function addTcgCard(cardId, status) {
  const card = setCardsById[cardId];
  if (!card) return;
  const key = ownedKey(card.set.name, card.number);
  cards = cards.filter(item =>
    item.collection !== state.activeOwner || ownedKey(item.set, item.number) !== key
  );
  cards.unshift({
    id: newId(),
    pokemon: card.name,
    set: card.set.name,
    number: card.number,
    rarity: card.rarity || "Onbekend",
    condition: "Near Mint",
    quantity: 1,
    value: 0,
    imageSmall: card.images && card.images.small || "",
    imageLarge: card.images && card.images.large || "",
    tcgId: card.id,
    types: card.types || [],
    status,
    collection: state.activeOwner,
    addedAt: new Date().toISOString().slice(0, 10)
  });
  saveCards();
  render();
}

/* ── Detail dialog ── */
function showDetail(id) {
  const card = cards.find(c => c.id === id);
  if (!card) return;
  $("#detailContent").innerHTML = `<div class="detail-view">
    <img src="${cardImageUrl(card, "large")}" alt="${card.pokemon}" />
    <div>
      <p class="eyebrow">${card.status === "owned" ? "In collectie" : "Wishlist"} · ${card.collection || ""}</p>
      <h2>${card.pokemon}</h2>
      <p>${card.set} · ${card.number || "zonder nummer"}</p>
      <p>${card.rarity} · ${card.condition} · x${card.quantity}</p>
      <p class="value">${formatMoney(Number(card.value) * Number(card.quantity))}</p>
    </div>
  </div>`;
  $("#detailDialog").showModal();
}

/* ── Add card (form) ── */
function addCard(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  cards = [{
    id: newId(),
    pokemon:    data.pokemon.trim(),
    set:        data.set.trim(),
    number:     data.number.trim(),
    rarity:     data.rarity,
    condition:  data.condition,
    quantity:   Math.max(1, Number(data.quantity) || 1),
    value:      Math.max(0, Number(data.value) || 0),
    status:     data.status,
    collection: data.collection,
    addedAt:    new Date().toISOString().slice(0, 10)
  }].concat(cards);
  saveCards();
  event.currentTarget.reset();
  event.currentTarget.quantity.value = 1;
  event.currentTarget.value.value    = 0;
  render();
}

/* ── Export / Import ── */
function exportCards() {
  const blob = new Blob([JSON.stringify(cards, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pokemon-collection-v2.json";
  link.click();
  URL.revokeObjectURL(url);
}
function importCards(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function () {
    try {
      const incoming = JSON.parse(reader.result);
      if (!Array.isArray(incoming)) throw new Error("Geen collectie-array");
      cards = incoming.map(c => Object.assign({}, c, { id: c.id || newId() }));
      saveCards();
      render();
    } catch (e) {
      alert("Dit JSON-bestand kon niet worden ingelezen.");
    }
  };
  reader.readAsText(file);
}

/* ── Event binding ── */
function bindEvents() {
  // Nav tabs
  $$(".nav-tab").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));
  $$("[data-view-link]").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.viewLink)));

  // Owner switch (Lars / Lore)
  $$(".owner-toggle").forEach(btn => btn.addEventListener("click", () => {
    state.activeOwner = btn.dataset.owner;
    $$(".owner-toggle").forEach(b => b.classList.toggle("active", b.dataset.owner === state.activeOwner));
    render();
  }));

  // Collection filters
  $("#collectionSearch").addEventListener("input", renderCollection);
  $("#pokedexSearch").addEventListener("input",    renderPokedex);
  $("#typeFilter").addEventListener("change",      renderCollection);
  $("#rarityFilter").addEventListener("change",    renderCollection);
  $("#pokedexType").addEventListener("change",     renderPokedex);

  // Set search / select
  $("#setSearch").addEventListener("input", e => { state.setQuery = e.target.value; renderSets(); });
  $("#setSelect").addEventListener("change", e => loadSetCards(e.target.value));
  $("#refreshSetsBtn").addEventListener("click",  () => loadSets(true));

  // Sort toggle
  $("#sortToggle").addEventListener("click", () => {
    state.sortAsc = !state.sortAsc;
    $("#sortToggle").textContent = state.sortAsc ? "Naam A-Z" : "Naam Z-A";
    renderCollection();
  });

  // Form / export / import / reset
  $("#cardForm").addEventListener("submit",     addCard);
  $("#exportBtn").addEventListener("click",     exportCards);
  $("#importFile").addEventListener("change",   importCards);
  $("#resetBtn").addEventListener("click", () => {
    if (!confirm("Collectie terugzetten naar de startdata?")) return;
    cards = seedCards;
    saveCards();
    render();
  });

  // Dialog
  $("#closeDialog").addEventListener("click", () => $("#detailDialog").close());

  // Delegated clicks
  document.addEventListener("click", event => {
    const detail  = event.target.closest("[data-detail]");
    const lore    = event.target.closest("[data-lore]");
    const remove  = event.target.closest("[data-delete]");
    const setBtn  = event.target.closest("[data-set-id]");
    const addBtn  = event.target.closest("[data-add-card]");
    const wishBtn = event.target.closest("[data-wish-card]");
    if (detail)  showDetail(detail.dataset.detail);
    if (setBtn)  loadSetCards(setBtn.dataset.setId);
    if (addBtn)  addTcgCard(addBtn.dataset.addCard, "owned");
    if (wishBtn) addTcgCard(wishBtn.dataset.wishCard, "wishlist");
    if (lore) { state.lorePokemon = lore.dataset.lore; setView("lore"); }
    if (remove) { cards = cards.filter(c => c.id !== remove.dataset.delete); saveCards(); render(); }
  });
}

/* ── Boot ── */
bindEvents();
render();
loadSets(false);