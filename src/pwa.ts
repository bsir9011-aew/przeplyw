import { registerSW } from "virtual:pwa-register";
export function registerPwa(
  onUpdate: () => void,
  onOfflineReady: () => void,
  onError: () => void,
) {
  return registerSW({
    immediate: true,
    onNeedRefresh: onUpdate,
    onOfflineReady,
    onRegisterError: onError,
    onRegisteredSW(_url, registration) {
      if (registration)
        void navigator.serviceWorker.ready.then(onOfflineReady).catch(onError);
      const check = () => {
        if (document.visibilityState === "visible" && navigator.onLine)
          void registration?.update().catch(() => {});
      };
      window.addEventListener("online", check);
      document.addEventListener("visibilitychange", check);
    },
  });
}
