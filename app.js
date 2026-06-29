const STORAGE_KEY = "pokemon-collection-v2";
const SETS_CACHE_KEY = "pokemon-collection-v2-sets";
const POKEDEX_PICK_KEY = "pokemon-collection-v2-pokedex-picks";
const TCG_API = "https://api.pokemontcg.io/v2";

const typeColors = {
  Electric: "#f2bf27", Fire: "#f36b3f", Water: "#3d8fe3", Grass: "#45a86b",
  Psychic: "#cf69c8", Normal: "#9da5ae", Dragon: "#6a70d6", Dark: "#3d4652",
  Fairy: "#ee85b8", Fighting: "#c65542", Ghost: "#6d5aa6", Poison: "#9a61b8", Flying: "#7fa6d9",
  Bug: "#8fb84f", Ground: "#d59b55", Rock: "#a98952", Steel: "#8ba4b8", Ice: "#67c7d4"
};

const POKEDEX_TOTAL = 1025;
const featuredPokemon = [
  { id: 1, name: "Bulbasaur", types: ["Grass", "Poison"], region: "Kanto" },
  { id: 4, name: "Charmander", types: ["Fire"], region: "Kanto" },
  { id: 6, name: "Charizard", types: ["Fire", "Flying"], region: "Kanto" },
  { id: 7, name: "Squirtle", types: ["Water"], region: "Kanto" },
  { id: 25, name: "Pikachu", types: ["Electric"], region: "Kanto" },
  { id: 39, name: "Jigglypuff", types: ["Normal", "Fairy"], region: "Kanto" },
  { id: 94, name: "Gengar", types: ["Ghost", "Poison"], region: "Kanto" },
  { id: 130, name: "Gyarados", types: ["Water", "Flying"], region: "Kanto" },
  { id: 143, name: "Snorlax", types: ["Normal"], region: "Kanto" },
  { id: 149, name: "Dragonite", types: ["Dragon", "Flying"], region: "Kanto" },
  { id: 150, name: "Mewtwo", types: ["Psychic"], region: "Kanto" },
  { id: 197, name: "Umbreon", types: ["Dark"], region: "Johto" },
  { id: 448, name: "Lucario", types: ["Fighting", "Steel"], region: "Sinnoh" }
];
const featuredById = Object.fromEntries(featuredPokemon.map(p => [p.id, p]));
function regionForDexNumber(id) {
  if (id <= 151) return "Kanto"; if (id <= 251) return "Johto"; if (id <= 386) return "Hoenn";
  if (id <= 493) return "Sinnoh"; if (id <= 649) return "Unova"; if (id <= 721) return "Kalos";
  if (id <= 809) return "Alola"; if (id <= 905) return "Galar"; return "Paldea";
}
const pokedex = Array.from({ length: POKEDEX_TOTAL }, (_, index) => {
  const id = index + 1;
  return featuredById[id] || { id, name: `Pokemon #${String(id).padStart(3, "0")}`, types: ["Normal"], region: regionForDexNumber(id) };
});

function newId() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()); }

const seedCards = [
  { id: newId(), pokemon: "Pikachu", set: "Celebrations", number: "005/025", rarity: "Holo Rare", condition: "Near Mint", quantity: 2, status: "owned", collection: "Lars", addedAt: "2026-06-10" },
  { id: newId(), pokemon: "Charizard", set: "Obsidian Flames", number: "223/197", rarity: "Secret Rare", condition: "Excellent", quantity: 1, status: "owned", collection: "Lars", addedAt: "2026-06-18" },
  { id: newId(), pokemon: "Bulbasaur", set: "Pokemon 151", number: "001/165", rarity: "Common", condition: "Near Mint", quantity: 3, status: "owned", collection: "Lore", addedAt: "2026-06-22" },
  { id: newId(), pokemon: "Mewtwo", set: "Crown Zenith", number: "GG44/GG70", rarity: "Ultra Rare", condition: "Near Mint", quantity: 1, status: "wishlist", collection: "Lars", addedAt: "2026-06-24" },
  { id: newId(), pokemon: "Umbreon", set: "Evolving Skies", number: "215/203", rarity: "Secret Rare", condition: "Near Mint", quantity: 1, status: "wishlist", collection: "Lore", addedAt: "2026-06-25" }
];

let cards = loadCards();
let state = { view: "dashboard", sortAsc: true, selectedSetId: "", setQuery: "", activeOwner: "Lars" };
let tcgSets = loadCachedSets();
let setCards = [];
let setCardsById = {};
let cardSearchResults = [];
let cardSearchById = {};
let pokedexPicks = loadPokedexPicks();
let setsLoaded = false;

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function spriteUrl(name) {
  const entry = pokedex.find(p => p.name.toLowerCase() === String(name || "").toLowerCase());
  return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/" + ((entry && entry.id) || 25) + ".png";
}
function cardPlaceholder(card) {
  return `<div class="card-placeholder"><span>${card.pokemon || "Kaart"}</span><small>${card.set || "Handmatig"}</small></div>`;
}
function typeFor(name) {
  const entry = pokedex.find(p => p.name.toLowerCase() === String(name || "").toLowerCase());
  return entry ? entry.types[0] : "Normal";
}
function typeForCard(card) { return card && Array.isArray(card.types) && card.types.length ? card.types[0] : typeFor(card && card.pokemon); }
function cardImageUrl(card, preferredSize = "small") {
  if (!card) return "";
  if (preferredSize === "large" && card.imageLarge) return card.imageLarge;
  return card.imageSmall || card.imageLarge || "";
}
function loadCards() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || seedCards; } catch (e) { return seedCards; } }
function saveCards() { localStorage.setItem(STORAGE_KEY, JSON.stringify(cards)); }
function loadCachedSets() { try { return JSON.parse(localStorage.getItem(SETS_CACHE_KEY)) || []; } catch (e) { return []; } }
function loadPokedexPicks() { try { return JSON.parse(localStorage.getItem(POKEDEX_PICK_KEY)) || {}; } catch (e) { return {}; } }
function savePokedexPicks() { localStorage.setItem(POKEDEX_PICK_KEY, JSON.stringify(pokedexPicks)); }
function normalizeText(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim(); }
function ownedKey(setName, number) { return normalizeText(setName) + "::" + normalizeText(number); }
function activeCards() { return cards.filter(c => c.collection === state.activeOwner); }
function ownedCards() { return activeCards().filter(c => c.status === "owned"); }
function collectionKeys() {
  const owned = new Set(), wishlist = new Set();
  activeCards().forEach(card => {
    const key = ownedKey(card.set, card.number);
    if (card.status === "owned") owned.add(key);
    if (card.status === "wishlist") wishlist.add(key);
  });
  return { owned, wishlist };
}
function priceLinks(card) {
  const links = [];
  if (card.cardmarketUrl) links.push(`<a href="${card.cardmarketUrl}" target="_blank" rel="noreferrer">Cardmarket</a>`);
  if (card.tcgplayerUrl) links.push(`<a href="${card.tcgplayerUrl}" target="_blank" rel="noreferrer">TCGplayer</a>`);
  return links.join(" · ");
}
function tcgExternalLinks(card) {
  return { cardmarketUrl: card.cardmarket && card.cardmarket.url || "", tcgplayerUrl: card.tcgplayer && card.tcgplayer.url || "" };
}

function setView(view) {
  state.view = view;
  $$(".view").forEach(el => el.classList.toggle("active-view", el.id === view));
  $$(".nav-tab").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  const titles = {
    dashboard: ["Overzicht", "Dashboard"], collection: ["Binder", "Collectie"], search: ["Kaarten", "Zoeken"],
    sets: ["Catalogus", "Sets"], wishlist: ["Wensen", "Wishlist"], pokedex: ["Database", "Pokedex"], manage: ["Invoer", "Beheer"]
  };
  const pair = titles[view] || titles.dashboard;
  $("#viewKicker").textContent = pair[0];
  $("#viewTitle").textContent = pair[1];
  window.scrollTo(0, 0);
  render();
}

function render() {
  renderFilters(); renderDashboard(); renderCollection(); renderSets(); renderWishlist(); renderPokedex(); renderManage();
}
function renderFilters() {
  const types = Array.from(new Set(pokedex.flatMap(p => p.types))).sort();
  const rarities = Array.from(new Set(cards.map(c => c.rarity).concat(cardSearchResults.map(c => c.rarity || "Onbekend")))).sort();
  fillSelect("#typeFilter", ["all"].concat(types), "Alle types");
  fillSelect("#pokedexType", ["all"].concat(types), "Alle types");
  fillSelect("#rarityFilter", ["all"].concat(rarities), "Alle zeldzaamheden");
  fillSelect("#globalTypeFilter", ["all"].concat(types), "Alle types");
  fillSelect("#globalRarityFilter", ["all"].concat(rarities), "Alle zeldzaamheden");
}
function fillSelect(selector, values, allLabel) {
  const select = $(selector); if (!select) return;
  const current = select.value;
  select.innerHTML = values.map(v => `<option value="${v}">${v === "all" ? allLabel : v}</option>`).join("");
  select.value = values.includes(current) ? current : "all";
}

function renderDashboard() {
  const owned = ownedCards();
  const totalCards = owned.reduce((s, c) => s + Number(c.quantity || 1), 0);
  const uniquePokemon = new Set(owned.map(c => String(c.pokemon).toLowerCase())).size;
  const uniqueSets = new Set(owned.map(c => normalizeText(c.set))).size;
  const wishlist = activeCards().filter(c => c.status === "wishlist").length;
  const completion = Math.round((uniquePokemon / POKEDEX_TOTAL) * 100);
  $("#metricCards").textContent = totalCards;
  $("#metricPokemon").textContent = uniquePokemon;
  const metricSets = $("#metricSets"); if (metricSets) metricSets.textContent = uniqueSets;
  $("#metricWishlist").textContent = wishlist;
  $("#completionLabel").textContent = completion + "%";
  $("#completionBar").style.width = completion + "%";
  const counts = {};
  owned.forEach(card => { const t = typeForCard(card); counts[t] = (counts[t] || 0) + Number(card.quantity || 1); });
  $("#typeBreakdown").innerHTML = Object.entries(counts).map(([t, n]) => `<span class="type-pill"><span class="type-dot" style="--type-color:${typeColors[t] || "#73808c"}"></span>${t} ${n}</span>`).join("") || `<div class="empty-state">Nog geen typeverdeling.</div>`;
  $("#recentList").innerHTML = activeCards().slice().sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt)).slice(0, 5).map(compactRow).join("");
}
function compactRow(card) {
  const image = cardImageUrl(card);
  return `<div class="compact-row" data-detail="${card.id}">${image ? `<img class="sprite" src="${image}" alt="${card.pokemon}" />` : `<div class="sprite card-mini"></div>`}<div><strong>${card.pokemon}</strong><p>${card.set} — ${card.rarity}</p></div><span class="rarity-pill">${card.status === "owned" ? "Collectie" : "Wishlist"}</span></div>`;
}

function filteredCollection(status = "owned") {
  const query = $("#collectionSearch") ? $("#collectionSearch").value.trim().toLowerCase() : "";
  const type = $("#typeFilter") ? $("#typeFilter").value : "all";
  const rarity = $("#rarityFilter") ? $("#rarityFilter").value : "all";
  return activeCards().filter(c => c.status === status)
    .filter(c => !query || (c.pokemon + " " + c.set + " " + c.number + " " + c.rarity).toLowerCase().includes(query))
    .filter(c => type === "all" || typeForCard(c) === type)
    .filter(c => rarity === "all" || c.rarity === rarity)
    .sort((a, b) => state.sortAsc ? a.pokemon.localeCompare(b.pokemon) : b.pokemon.localeCompare(a.pokemon));
}
function renderCollection() {
  const grid = $("#collectionGrid"); if (!grid) return;
  const filtered = filteredCollection("owned");
  grid.innerHTML = filtered.map(cardTemplate).join("") || `<div class="empty-state">Geen kaarten gevonden.</div>`;
}
function renderWishlist() {
  const input = $("#wishlistSearch"); const query = input ? input.value.trim().toLowerCase() : "";
  const filtered = activeCards().filter(c => c.status === "wishlist").filter(c => !query || (c.pokemon + " " + c.set + " " + c.number).toLowerCase().includes(query)).sort((a, b) => a.pokemon.localeCompare(b.pokemon));
  const grid = $("#wishlistGrid"); if (grid) grid.innerHTML = filtered.map(cardTemplate).join("") || `<div class="empty-state">Geen wishlist-kaarten gevonden.</div>`;
}
function cardTemplate(card) {
  const type = typeForCard(card); const tint = (typeColors[type] || "#d8e1ea") + "30"; const image = cardImageUrl(card);
  const links = priceLinks(card);
  return `<article class="pokemon-card collection-card" data-detail="${card.id}" style="--card-tint:${tint}" tabindex="0" role="button" aria-label="${card.pokemon} openen">
    <span class="type-pill"><span class="type-dot" style="--type-color:${typeColors[type] || "#73808c"}"></span>${type}</span>
    ${image ? `<img class="real-card-image" src="${image}" alt="${card.pokemon}" />` : cardPlaceholder(card)}
    <h3>${card.pokemon}</h3>
    <p>${card.set} — ${card.number || "zonder nummer"}</p>
    <p>${card.rarity} · ${card.condition} · x${card.quantity}</p>
    ${links ? `<p class="price-links">${links}</p>` : ""}
  </article>`;
}

function cardsForPokedexEntry(entry) { return ownedCards().filter(c => c.pokemon.toLowerCase() === entry.name.toLowerCase()); }
function selectedPokedexCard(entry, matches) {
  if (!matches.length) return null;
  const pickedId = pokedexPicks[state.activeOwner + "::" + entry.name.toLowerCase()];
  return matches.find(c => c.id === pickedId) || matches[0];
}
function renderPokedex() {
  const grid = $("#pokedexGrid"); if (!grid) return;
  const query = $("#pokedexSearch").value.trim().toLowerCase(); const type = $("#pokedexType").value;
  const filtered = pokedex.filter(e => !query || e.name.toLowerCase().includes(query)).filter(e => type === "all" || e.types.includes(type));
  grid.innerHTML = filtered.map(entry => {
    const mt = entry.types[0]; const matches = cardsForPokedexEntry(entry); const selected = selectedPokedexCard(entry, matches);
    const pickKey = state.activeOwner + "::" + entry.name.toLowerCase(); const image = selected ? cardImageUrl(selected) : spriteUrl(entry.name);
    const choice = matches.length > 1 ? `<select class="pokedex-card-select" data-pokedex-pick="${pickKey}" aria-label="Kies kaart voor ${entry.name}">${matches.map(c => `<option value="${c.id}" ${selected && selected.id === c.id ? "selected" : ""}>${c.set} #${c.number || "?"}</option>`).join("")}</select>` : `<span class="rarity-pill">${matches.length === 1 ? matches[0].set : "Nog zoeken"}</span>`;
    return `<article class="pokemon-card" style="--card-tint:${(typeColors[mt] || "#d8e1ea") + "30"}"><span class="type-pill"><span class="type-dot" style="--type-color:${typeColors[mt] || "#73808c"}"></span>#${String(entry.id).padStart(3, "0")}</span><img src="${image}" alt="${entry.name}" /><h3>${entry.name}</h3><p>${entry.region} · ${entry.types.join(" / ")}</p><div class="card-footer pokedex-footer"><span class="rarity-pill">${matches.length ? "✓ In collectie" : "Nog niet in collectie"}</span>${choice}</div></article>`;
  }).join("") || `<div class="empty-state">Geen Pokemon gevonden.</div>`;
}

function renderManage() {
  const list = $("#manageList"); if (!list) return;
  list.innerHTML = activeCards().map(card => `<div class="manage-row" data-detail="${card.id}">${cardImageUrl(card) ? `<img class="sprite" src="${cardImageUrl(card)}" alt="${card.pokemon}" />` : `<div class="sprite card-mini"></div>`}<div><strong>${card.pokemon}</strong><p>${card.status === "owned" ? "Collectie" : "Wishlist"} · ${card.set} · x${card.quantity}</p></div><button data-delete="${card.id}" type="button" aria-label="Verwijderen">✕</button></div>`).join("");
}

async function loadSets(force) {
  if (setsLoaded && !force) return;
  const status = $("#setsStatus");
  if (status) status.textContent = tcgSets.length ? "Sets worden bijgewerkt…" : "Sets worden geladen uit de Pokemon TCG API…";
  try {
    const res = await fetch(TCG_API + "/sets?orderBy=-releaseDate&pageSize=250");
    if (!res.ok) throw new Error(`Sets API ${res.status}`);
    const payload = await res.json(); tcgSets = payload.data || [];
    localStorage.setItem(SETS_CACHE_KEY, JSON.stringify(tcgSets)); setsLoaded = true;
  } catch (e) {
    if (status) status.textContent = tcgSets.length ? "Live sets niet bereikbaar; offline cache gebruikt." : "Sets konden niet worden geladen. Controleer je internetverbinding of probeer later opnieuw.";
  }
  renderSets();
}
function filteredSets() {
  const q = state.setQuery;
  return tcgSets.filter(s => !q || normalizeText(s.name + " " + s.series + " " + s.releaseDate).includes(normalizeText(q)));
}
function setOwnedStats(set) {
  const total = Number(set.total || set.printedTotal || 0);
  const ownedCount = activeCards().filter(c => c.status === "owned" && normalizeText(c.set) === normalizeText(set.name)).length;
  return { ownedCount, total };
}
function renderSets() {
  const setSearch = $("#setSearch"), setSelect = $("#setSelect"), status = $("#setsStatus"), grid = $("#setsGrid");
  if (!setSearch || !setSelect || !grid) return;
  if (!tcgSets.length && !setsLoaded) { if (status) status.textContent = "Sets worden geladen…"; grid.innerHTML = `<div class="empty-state">Nog geen sets geladen.</div>`; return; }
  const sets = filteredSets();
  if (status) status.innerHTML = `${tcgSets.length} sets beschikbaar via de Pokemon TCG API. <span class="api-note">Klik op een set om deze in een venster te openen.</span>`;
  const current = setSelect.value || state.selectedSetId;
  setSelect.innerHTML = `<option value="">Set kiezen</option>` + tcgSets.map(s => `<option value="${s.id}">${s.name} (${s.releaseDate || ""})</option>`).join("");
  setSelect.value = tcgSets.some(s => s.id === current) ? current : "";
  grid.innerHTML = sets.map(set => { const stats = setOwnedStats(set); return `<button class="set-card ${state.selectedSetId === set.id ? "active" : ""}" data-set-id="${set.id}" type="button"><img src="${(set.images && set.images.logo) || ""}" alt="${set.name}" /><div><strong>${set.name}</strong><p>${set.series || ""} · ${set.releaseDate || ""}</p></div><span class="set-count">${stats.ownedCount}/${stats.total}</span></button>`; }).join("") || `<div class="empty-state">Geen sets gevonden.</div>`;
}
async function openSetDialog(setId) {
  if (!setId) return;
  state.selectedSetId = setId;
  const set = tcgSets.find(s => s.id === setId);
  const dialog = $("#setDialog"), content = $("#setDialogContent");
  if (!dialog || !content || !set) return;
  content.innerHTML = `<div class="set-dialog-view"><div class="panel-heading"><div><p class="eyebrow">Set</p><h2>${set.name}</h2><p>${set.series || ""} · ${set.releaseDate || ""}</p></div><span class="set-count">${setOwnedStats(set).ownedCount}/${set.total || set.printedTotal || 0}</span></div><div class="progress-track"><div id="dialogSetProgressBar" class="progress-bar"></div></div><div class="empty-state">Kaarten worden geladen…</div></div>`;
  dialog.showModal();
  await loadSetCards(setId, true);
}
async function loadSetCards(setId, inDialog = false) {
  if (!setId) return;
  state.selectedSetId = setId; setCards = []; setCardsById = {};
  try {
    let page = 1, all = [];
    while (true) {
      const url = `${TCG_API}/cards?q=${encodeURIComponent(`set.id:${setId}`)}&orderBy=number&pageSize=250&page=${page}`;
      const res = await fetch(url); if (!res.ok) throw new Error(`Cards API ${res.status}`);
      const batch = (await res.json()).data || []; all = all.concat(batch); if (batch.length < 250) break; page++;
    }
    setCards = all; setCardsById = Object.fromEntries(all.map(c => [c.id, c]));
  } catch (e) {
    const content = $("#setDialogContent"); if (content) content.innerHTML = `<div class="set-dialog-view"><div class="empty-state">Kaarten konden niet worden geladen voor deze set.</div></div>`; return;
  }
  renderSets(); if (inDialog) renderSetDialogCards();
}
function renderSetDialogCards() {
  const set = tcgSets.find(s => s.id === state.selectedSetId); const content = $("#setDialogContent"); if (!set || !content) return;
  const keys = collectionKeys(); const total = setCards.length || Number(set.total || set.printedTotal || 0); const owned = setCards.filter(c => keys.owned.has(ownedKey(c.set.name, c.number))).length;
  content.innerHTML = `<div class="set-dialog-view"><div class="panel-heading"><div><p class="eyebrow">Set</p><h2>${set.name}</h2><p>${set.series || ""} · ${set.releaseDate || ""}</p></div><span class="set-count">${owned}/${total}</span></div><div class="progress-track"><div class="progress-bar" style="width:${total ? Math.round((owned / total) * 100) : 0}%"></div></div><div class="set-cards-grid">${renderTcgCardItems(setCards)}</div></div>`;
}
function renderTcgCardItems(tcgCards) {
  const keys = collectionKeys();
  return tcgCards.map(card => {
    const key = ownedKey(card.set.name, card.number); const owned = keys.owned.has(key); const wish = keys.wishlist.has(key); const cls = owned ? " owned" : wish ? " wishlist" : "";
    const image = (card.images && (card.images.small || card.images.large)) || "";
    const links = [];
    if (card.cardmarket && card.cardmarket.url) links.push(`<a href="${card.cardmarket.url}" target="_blank" rel="noreferrer">Cardmarket</a>`);
    if (card.tcgplayer && card.tcgplayer.url) links.push(`<a href="${card.tcgplayer.url}" target="_blank" rel="noreferrer">TCGplayer</a>`);
    return `<article class="set-card-item${cls}">${image ? `<img src="${image}" alt="${card.name}" />` : ""}<h3>${card.name}</h3><p>${card.set.name} · #${card.number} · ${card.rarity || "Onbekend"}</p>${links.length ? `<p class="price-links">${links.join(" · ")}</p>` : ""}<div class="set-card-actions"><button data-add-card="${card.id}" type="button" ${owned ? "disabled" : ""}>${owned ? "In collectie" : "+ Collectie"}</button><button data-wish-card="${card.id}" type="button" ${wish || owned ? "disabled" : ""}>${wish ? "Op wishlist" : "+ Wishlist"}</button></div></article>`;
  }).join("");
}

async function searchCards() {
  const query = $("#globalCardSearch") ? $("#globalCardSearch").value.trim() : "";
  const setFilter = $("#globalSetFilter") ? $("#globalSetFilter").value.trim() : "";
  const type = $("#globalTypeFilter") ? $("#globalTypeFilter").value : "all";
  const rarity = $("#globalRarityFilter") ? $("#globalRarityFilter").value : "all";
  const status = $("#globalSearchStatus"), grid = $("#globalSearchGrid");
  if (!query && !setFilter && type === "all" && rarity === "all") { if (status) status.textContent = "Vul minstens een naam, set of filter in."; return; }
  if (status) status.textContent = "Kaarten worden gezocht…"; if (grid) grid.innerHTML = `<div class="empty-state">Zoeken in Pokémon TCG API…</div>`;
  const parts = [];
  if (query) parts.push(`name:*${query}*`);
  if (setFilter) parts.push(`set.name:*${setFilter}*`);
  if (type !== "all") parts.push(`types:${type}`);
  if (rarity !== "all") parts.push(`rarity:"${rarity}"`);
  try {
    const url = `${TCG_API}/cards?q=${encodeURIComponent(parts.join(" "))}&orderBy=name,set.releaseDate,number&pageSize=250`;
    const res = await fetch(url); if (!res.ok) throw new Error(`Cards API ${res.status}`);
    cardSearchResults = (await res.json()).data || [];
    cardSearchById = Object.fromEntries(cardSearchResults.map(c => [c.id, c]));
    if (status) status.textContent = `${cardSearchResults.length} kaarten gevonden.`;
    if (grid) grid.innerHTML = cardSearchResults.length ? renderTcgCardItems(cardSearchResults) : `<div class="empty-state">Geen kaarten gevonden.</div>`;
    renderFilters();
  } catch (e) {
    if (status) status.textContent = "Zoeken is niet gelukt. Controleer je internetverbinding of probeer later opnieuw.";
    if (grid) grid.innerHTML = `<div class="empty-state">Geen zoekresultaten beschikbaar.</div>`;
  }
}
function addTcgCard(cardId, status) {
  const card = setCardsById[cardId] || cardSearchById[cardId]; if (!card) return;
  const key = ownedKey(card.set.name, card.number);
  cards = cards.filter(item => item.collection !== state.activeOwner || ownedKey(item.set, item.number) !== key);
  cards.unshift({ id: newId(), pokemon: card.name, set: card.set.name, number: card.number, rarity: card.rarity || "Onbekend", condition: "Near Mint", quantity: 1, imageSmall: card.images && card.images.small || "", imageLarge: card.images && card.images.large || "", tcgId: card.id, types: card.types || [], status, collection: state.activeOwner, addedAt: new Date().toISOString().slice(0, 10), ...tcgExternalLinks(card) });
  saveCards(); render(); if ($("#globalSearchGrid")) $("#globalSearchGrid").innerHTML = cardSearchResults.length ? renderTcgCardItems(cardSearchResults) : ""; if ($("#setDialog").open) renderSetDialogCards();
}

function showDetail(id) {
  const card = cards.find(c => c.id === id); if (!card) return;
  const image = cardImageUrl(card, "large"); const links = priceLinks(card);
  $("#detailContent").innerHTML = `<div class="detail-view card-detail-view">${image ? `<img class="detail-card-image" src="${image}" alt="${card.pokemon}" />` : cardPlaceholder(card)}<div><p class="eyebrow">${card.status === "owned" ? "In collectie" : "Wishlist"} · ${card.collection || ""}</p><h2>${card.pokemon}</h2><p>${card.set} · ${card.number || "zonder nummer"}</p><p>${card.rarity} · ${card.condition} · x${card.quantity}</p>${links ? `<p class="price-links">Prijsinfo: ${links}</p>` : `<p class="api-note">Geen prijslink beschikbaar. Prijs wordt daarom niet getoond.</p>`}<div class="detail-actions"><button class="danger-action" data-delete="${card.id}" type="button">Verwijder kaart</button></div></div></div>`;
  $("#detailDialog").showModal();
}

function addCard(event) {
  event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
  cards = [{ id: newId(), pokemon: data.pokemon.trim(), set: data.set.trim(), number: data.number.trim(), rarity: data.rarity, condition: data.condition, quantity: Math.max(1, Number(data.quantity) || 1), status: data.status, collection: data.collection, addedAt: new Date().toISOString().slice(0, 10) }].concat(cards);
  saveCards(); event.currentTarget.reset(); event.currentTarget.quantity.value = 1; render();
}
function exportCards() { const blob = new Blob([JSON.stringify(cards, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "pokemon-collection-v2.json"; link.click(); URL.revokeObjectURL(url); }
function importCards(event) { const file = event.target.files && event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = function () { try { const incoming = JSON.parse(reader.result); if (!Array.isArray(incoming)) throw new Error("Geen collectie-array"); cards = incoming.map(c => Object.assign({}, c, { id: c.id || newId() })); saveCards(); render(); } catch (e) { alert("Dit JSON-bestand kon niet worden ingelezen."); } }; reader.readAsText(file); }

function bindEvents() {
  $$(".nav-tab").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));
  $$("[data-view-link]").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.viewLink)));
  $$(".owner-toggle").forEach(btn => btn.addEventListener("click", () => { state.activeOwner = btn.dataset.owner; $$(".owner-toggle").forEach(b => b.classList.toggle("active", b.dataset.owner === state.activeOwner)); render(); }));
  [["#collectionSearch", "input", renderCollection], ["#pokedexSearch", "input", renderPokedex], ["#wishlistSearch", "input", renderWishlist], ["#typeFilter", "change", renderCollection], ["#rarityFilter", "change", renderCollection], ["#pokedexType", "change", renderPokedex]].forEach(([s, e, fn]) => { const el = $(s); if (el) el.addEventListener(e, fn); });
  const setSearch = $("#setSearch"); if (setSearch) setSearch.addEventListener("input", e => { state.setQuery = e.target.value; renderSets(); });
  const setSelect = $("#setSelect"); if (setSelect) setSelect.addEventListener("change", e => openSetDialog(e.target.value));
  const refresh = $("#refreshSetsBtn"); if (refresh) refresh.addEventListener("click", () => loadSets(true));
  const globalSearch = $("#globalSearchBtn"); if (globalSearch) globalSearch.addEventListener("click", searchCards);
  const globalInput = $("#globalCardSearch"); if (globalInput) globalInput.addEventListener("keydown", e => { if (e.key === "Enter") searchCards(); });
  const sort = $("#sortToggle"); if (sort) sort.addEventListener("click", () => { state.sortAsc = !state.sortAsc; sort.textContent = state.sortAsc ? "Naam A-Z" : "Naam Z-A"; renderCollection(); });
  $("#cardForm").addEventListener("submit", addCard); $("#exportBtn").addEventListener("click", exportCards); $("#importFile").addEventListener("change", importCards);
  $("#resetBtn").addEventListener("click", () => { if (!confirm("Collectie terugzetten naar de startdata?")) return; cards = seedCards; saveCards(); render(); });
  $("#closeDialog").addEventListener("click", () => $("#detailDialog").close()); const closeSet = $("#closeSetDialog"); if (closeSet) closeSet.addEventListener("click", () => $("#setDialog").close());
  document.addEventListener("change", event => { const pick = event.target.closest("[data-pokedex-pick]"); if (pick) { pokedexPicks[pick.dataset.pokedexPick] = pick.value; savePokedexPicks(); renderPokedex(); } });
  document.addEventListener("keydown", event => { const card = event.target.closest(".collection-card"); if (card && (event.key === "Enter" || event.key === " ")) showDetail(card.dataset.detail); });
  document.addEventListener("click", event => {
    const remove = event.target.closest("[data-delete]"); if (remove) { event.stopPropagation(); if (!confirm("Deze kaart verwijderen?")) return; cards = cards.filter(c => c.id !== remove.dataset.delete); saveCards(); if ($("#detailDialog").open) $("#detailDialog").close(); render(); if ($("#setDialog").open) renderSetDialogCards(); return; }
    const addBtn = event.target.closest("[data-add-card]"); if (addBtn) { addTcgCard(addBtn.dataset.addCard, "owned"); return; }
    const wishBtn = event.target.closest("[data-wish-card]"); if (wishBtn) { addTcgCard(wishBtn.dataset.wishCard, "wishlist"); return; }
    const setBtn = event.target.closest("[data-set-id]"); if (setBtn) { openSetDialog(setBtn.dataset.setId); return; }
    const detail = event.target.closest("[data-detail]"); if (detail) showDetail(detail.dataset.detail);
  });
}

bindEvents();
render();
loadSets(false);
