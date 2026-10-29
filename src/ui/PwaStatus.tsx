import { useEffect, useRef, useState } from "react";
export default function PwaStatus({
  flush,
  ready,
  durable,
  status,
  notice,
}: {
  flush: () => Promise<void>;
  ready: boolean;
  durable: boolean;
  status: string;
  notice: string;
}) {
  const [update, setUpdate] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const apply = useRef<((reload?: boolean) => Promise<void>) | null>(null);
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let active = true;
    void import("../pwa")
      .then(({ registerPwa }) => {
        if (active)
          apply.current = registerPwa(
            () => setUpdate(true),
            () => setOfflineReady(true),
            () =>
              setMessage(
                "Tryb offline nie jest gotowy. Spróbuj ponownie przy dostępie do internetu.",
              ),
          );
      })
      .catch(() => {
        if (active) setMessage("Nie udało się przygotować trybu offline.");
      });
    return () => {
      active = false;
    };
  }, []);
  async function installUpdate() {
    setBusy(true);
    setMessage("");
    try {
      await flush();
      await apply.current?.(true);
    } catch {
      setMessage(
        "Nie zaktualizowano aplikacji: nie udało się zapisać sesji. Spróbuj po ponownym uruchomieniu.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className="session-status" aria-label="Zapis i dostępność offline">
      <p role="status">
        {status}
        {offlineReady ? " · Gotowa do pracy offline." : ""}
      </p>
      {notice && <p>{notice}</p>}
      {update && (
        <div>
          Nowa wersja jest gotowa.{" "}
          <button
            className="secondary"
            disabled={!ready || !durable || busy}
            onClick={() => void installUpdate()}
          >
            {busy ? "Zapisywanie…" : "Zapisz i zaktualizuj"}
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </aside>
  );
}
