import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import {
  freshSession,
  freshWorkspace,
  type Session,
  type Workspace,
} from "./model";
import type { ScenarioId } from "../scenarios/labs";
import { sessionStore } from "../storage/sessionStore";
export function useLabSession() {
  const [workspace, setWorkspace] = useState(freshWorkspace);
  const session = workspace.labs[workspace.activeScenario]!;
  const [ready, setReady] = useState(false);
  const [storedSession, setStoredSession] = useState<Workspace | null>(null);
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
          setWorkspace(saved.session);
          setNotice(
            saved.migrated
              ? "Zachowano i przeniesiono postęp ACL z poprzedniej wersji."
              : "Przywrócono ostatnią sesję. Możesz kontynuować.",
          );
        } else if (saved.kind === "incompatible" || saved.kind === "invalid")
          setNotice(
            "Zapisana sesja jest niezgodna lub uszkodzona. Zachowano jej kopię bezpieczeństwa i rozpoczęto nowe ćwiczenie.",
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
  const save = useCallback((snapshot: Workspace) => {
    const pending = queue.current
      .catch(() => {})
      .then(() => sessionStore.save(snapshot));
    queue.current = pending;
    return pending;
  }, []);
  useEffect(() => {
    if (!ready || !durable) return;
    let active = true;
    void save(workspace)
      .then(() => {
        if (active) {
          setStoredSession(workspace);
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
  }, [workspace, ready, durable, save]);
  // A requested update waits for all queued writes and this exact snapshot.
  const flush = async () => {
    if (!ready || !durable) throw Error("Zapis niedostępny");
    await save(workspace);
  };
  function setter<K extends keyof Session>(key: K) {
    return (action: SetStateAction<Session[K]>) => {
      if (!ready) return;
      setWorkspace((previous) => {
        const lab = previous.labs[previous.activeScenario]!;
        return {
          ...previous,
          labs: {
            ...previous.labs,
            [previous.activeScenario]: {
              ...lab,
              [key]:
                typeof action === "function"
                  ? (action as (v: Session[K]) => Session[K])(lab[key])
                  : action,
            },
          },
        };
      });
    };
  }
  return {
    session,
    workspace,
    chooseScenario: (id: ScenarioId) => {
      if (ready)
        setWorkspace((w) => ({
          ...w,
          activeScenario: id,
          showPicker: false,
          labs: { ...w.labs, [id]: w.labs[id] ?? freshSession(id) },
        }));
    },
    openPicker: () => {
      if (ready) setWorkspace((w) => ({ ...w, showPicker: true }));
    },
    setter,
    ready,
    durable,
    status:
      ready && durable && storedSession !== workspace ? "Zapisywanie…" : status,
    notice,
    flush,
  };
}
