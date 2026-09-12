{{flutter_js}}
{{flutter_build_config}}

(async () => {
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker
      .register("firebase-messaging-sw.js", {
        scope: "/firebase-cloud-messaging-push-scope",
      })
      .catch((error) => {
        console.warn(
          "Firebase Messaging service worker registration failed",
          error,
        );
      });
  }

  if ("serviceWorker" in navigator) {
    // The app shell's own cache, registered at the root scope so it can answer
    // a cold start with no network. Separate from the messaging worker above,
    // which owns only its push scope.
    await navigator.serviceWorker
      .register("eigen_offline_sw.js", { scope: "/" })
      .catch((error) => {
        console.warn("Offline shell service worker registration failed", error);
      });
  }

  _flutter.loader.load();
})();
