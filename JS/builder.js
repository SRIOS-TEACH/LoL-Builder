(function bootstrapBuilder(global) {
  function bindBuilderEvents() {
    if (!global.BuilderApp?.initBuilder) return;
    document.addEventListener("DOMContentLoaded", global.BuilderApp.initBuilder);
  }

  bindBuilderEvents();
}(window));
