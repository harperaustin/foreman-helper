(function() {
// Harness Module — Multi-Repo Harness "Coming Soon" placeholder.
// HARNESS_ENABLED is the documented swap point for a future real harness UI:
// flip it to false to show the disabled note, or wire renderHarness() to a
// live multi-repo harness when a backend exists.

var HARNESS_ENABLED = true;

function renderHarness(container) {
  if (!container) return;
  container.innerHTML = '';

  if (!HARNESS_ENABLED) {
    var note = document.createElement('p');
    note.className = 'harness-disabled';
    note.textContent = 'Harness disabled';
    container.appendChild(note);
    return;
  }

  container.innerHTML =
    '<div class="harness-coming-soon">' +
      '<div class="harness-stripe" aria-hidden="true"></div>' +
      '<div class="harness-hazard" aria-hidden="true">🚧</div>' +
      '<h2 class="harness-title">Multi-Repo Harness</h2>' +
      '<p class="harness-subtitle">Coming Soon</p>' +
      '<p class="harness-description">A unified harness for orchestrating agents across multiple repositories is under construction.</p>' +
      '<div class="harness-stripe" aria-hidden="true"></div>' +
    '</div>';
}

var api = {
  renderHarness: renderHarness,
  HARNESS_ENABLED: HARNESS_ENABLED
};

if (typeof window !== 'undefined') {
  window.ForemanHarness = api;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}

})();
