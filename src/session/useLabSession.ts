import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import { freshSession, type Session } from "./model";
import { sessionStore } from "../storage/sessionStore";
export function useLabSession() {
  const [session, setSession] = useState(freshSession);
  const [ready, setReady] = useState(false);
  const [storedSession, setStoredSession] = useState<Session | null>(null);
  const [status, setStatus] = useState("Przywracanie sesji…");
  const [notice, setNotice] = useState("");
  const [durable, setDurable] = useState(true);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    sessionStore
      .load()
      .then((saved) => {
        if (!active) return;
        if (saved.kind === "restored") {
          setSession(saved.session);
          setNotice("Przywrócono ostatnią sesję. Możesz kontynuować.");
        } else if (saved.kind === "incompatible" || saved.kind === "invalid")
          setNotice(
            "Zapisana sesja jest niezgodna lub uszkodzona. Rozpoczęto nowe ćwiczenie.",
          );
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setDurable(false);
          setStatus(
            "Brak trwałego zapisu. Możesz ćwiczyć, ale postęp zniknie po zamknięciu.",
          );
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  const save = useCallback((snapshot: Session) => {
    const pending = queue.current
      .catch(() => {})
      .then(() => sessionStore.save(snapshot));
    queue.current = pending;
    return pending;
  }, []);
  useEffect(() => {
    if (!ready || !durable) return;
    let active = true;
    void save(session)
      .then(() => {
        if (active) {
          setStoredSession(session);
          setStatus("Sesja zapisana na tym urządzeniu.");
        }
      })
      .catch(() => {
        if (active) {
          setDurable(false);
          setStatus(
            "Brak trwałego zapisu. Możesz ćwiczyć, ale postęp zniknie po zamknięciu.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [session, ready, durable, save]);
  // A requested update waits for all queued writes and this exact snapshot.
  const flush = async () => {
    if (!ready || !durable) throw Error("Zapis niedostępny");
    await save(session);
  };
  function setter<K extends keyof Session>(key: K) {
    return (action: SetStateAction<Session[K]>) => {
      if (!ready) return;
      setSession((previous) => ({
        ...previous,
        [key]:
          typeof action === "function"
            ? (action as (v: Session[K]) => Session[K])(previous[key])
            : action,
      }));
    };
  }
  return {
    session,
    setter,
    ready,
    durable,
    status:
      ready && durable && storedSession !== session ? "Zapisywanie…" : status,
    notice,
    flush,
  };
}
