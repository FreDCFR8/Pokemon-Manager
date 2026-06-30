(() => {
  function updateVisibleCollectionCount() {
    const count = document.querySelector("#collectionVisibleCount");
    if (!count) return;
    const visible = filteredCollection("owned");
    const total = activeCards().filter(card => card.status === "owned");
    const visibleCopies = visible.reduce((sum, card) => sum + Number(card.quantity || 1), 0);
    count.textContent = `${visible.length} van ${total.length} kaarten zichtbaar${visibleCopies !== visible.length ? ` · ${visibleCopies} exemplaren` : ""}`;
  }

  ["#collectionSearch", "#typeFilter", "#rarityFilter", "#collectionSortMode"].forEach(selector => {
    const control = document.querySelector(selector);
    if (!control) return;
    control.addEventListener(control.matches("input") ? "input" : "change", updateVisibleCollectionCount);
  });

  updateVisibleCollectionCount();
})();
