import { useState } from "react";
import type { Network } from "../network/model";
import { ipv4 } from "../network/ipv4";
import { labs, type ScenarioId } from "../scenarios/labs";
export default function ScenarioEditor({
  id,
  network,
  enabled,
  undo,
  revision,
  onChange,
  onUndo,
}: {
  id: ScenarioId;
  network: Network;
  enabled: boolean;
  undo: boolean;
  revision: number;
  onChange: (next: Network) => void;
  onUndo: () => void;
}) {
  const [error, setError] = useState("");
  function submit(form: HTMLFormElement) {
    if (!enabled) return;
    const value = String(new FormData(form).get("value") ?? "").trim();
    const next = structuredClone(network);
    try {
      if (id === "gateway") {
        ipv4(value);
        next.hosts[0].gateway = value;
      } else {
        const vlan = Number(value);
        if (
          !/^\d+$/.test(value) ||
          !Number.isInteger(vlan) ||
          vlan < 1 ||
          vlan > 4094
        )
          throw Error();
        next.switch.ports[1].vlan = vlan;
      }
      setError("");
      onChange(next);
    } catch {
      setError(
        id === "gateway"
          ? "Wpisz poprawny adres IPv4, np. cztery liczby od 0 do 255 rozdzielone kropkami."
          : "Wpisz numer VLAN od 1 do 4094.",
      );
    }
  }
  return (
    <section className="rules-panel">
      <div className="section-title">
        <h2>
          <span className="step-number">3</span>
          {labs[id].editor}
        </h2>
        <span className="pill">{labs[id].component}</span>
      </div>
      {id === "acl" ? (
        <>
          <p className="hint">Pierwsze dopasowanie wygrywa.</p>
          <ol className="rules">
            {network.router.rules.map((r, i) => (
              <li key={r.id} className={r.action}>
                <span className="rule-index">0{i + 1}</span>
                <div>
                  <span className={`action ${r.action}`}>
                    {r.action.toUpperCase()}
                  </span>{" "}
                  <b>
                    {r.destinationPort
                      ? `TCP / ${r.destinationPort}`
                      : "Dowolny protokół"}
                  </b>
                  <small>
                    {r.source} → {r.destination}
                  </small>
                  <code>{r.id}</code>
                </div>
              </li>
            ))}
          </ol>
          <button
            className="secondary"
            disabled={!enabled}
            onClick={() =>
              onChange({
                ...network,
                router: {
                  ...network.router,
                  rules: [...network.router.rules].reverse(),
                },
              })
            }
          >
            ⇅ Zamień kolejność
          </button>
        </>
      ) : enabled ? (
        <form
          key={revision}
          onSubmit={(e) => {
            e.preventDefault();
            submit(e.currentTarget);
          }}
        >
          <label>
            {id === "gateway"
              ? "Brama domyślna PC1"
              : "VLAN portu SW1:p2 (do R1)"}
            <input
              name="value"
              aria-describedby={error ? "edit-error" : undefined}
              aria-invalid={Boolean(error)}
              defaultValue={
                id === "gateway"
                  ? network.hosts[0].gateway
                  : network.switch.ports[1].vlan
              }
              inputMode={id === "gateway" ? "decimal" : "numeric"}
              autoComplete="off"
              required
            />
          </label>
          <button className="secondary" type="submit">
            Zastosuj zmianę
          </button>
        </form>
      ) : null}
      {error && (
        <p id="edit-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="text-button"
        disabled={!enabled || !undo}
        onClick={() => {
          setError("");
          onUndo();
        }}
      >
        Cofnij
      </button>
      <p className="hint rule-note" role="status">
        {!enabled
          ? "Najpierw przewidź przebieg i uruchom pierwszą symulację. Potem odblokujesz zmianę konfiguracji."
          : revision > 0
            ? "Konfiguracja zmieniona. Wróć do kroku 1 i przewidź ponownie."
            : "Pierwsza próba wykonana. Zbadaj konfigurację i przetestuj własną poprawkę."}
      </p>
    </section>
  );
}
