import { useState } from "react";
import {
  deviceIds,
  type DeviceId,
  type Reason,
  type Result,
} from "../network/model";
import { initialNetwork, probe } from "../network/scenario";
import { simulate } from "../network/simulate";
import { assess, type Prediction } from "../assessment/feedback";

type Attempt = {
  revision: number;
  rules: string[];
  prediction: Prediction;
  result: Result;
  checks: Result[];
};
const reasons: Record<Reason, string> = {
  acl: "Reguła ACL",
  gateway: "Brama hosta",
  l2: "Łącze lub VLAN",
  route: "Brak trasy",
  delivered: "Nic nie zatrzyma pakietu",
};
function Icon({ kind }: { kind: DeviceId }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      {kind === "PC1" ? (
        <>
          <rect x="8" y="8" width="32" height="23" rx="3" />
          <path d="M24 31v8m-9 0h18" />
        </>
      ) : kind === "SERVER" ? (
        <>
          <rect x="12" y="5" width="24" height="38" rx="4" />
          <path d="M12 18h24M12 30h24M17 12h3m-3 12h3m-3 12h3" />
        </>
      ) : kind === "SW1" ? (
        <>
          <rect x="5" y="14" width="38" height="22" rx="4" />
          <path d="M11 27h5m4 0h5m4 0h5m-22-8h24" />
        </>
      ) : (
        <>
          <path d="m24 4 17 9v15L24 44 7 28V13Z" />
          <path d="M14 24h20m-6-6 6 6-6 6m-8-12-6 6 6 6" />
        </>
      )}
    </svg>
  );
}
export default function App() {
  const [network, setNetwork] = useState(initialNetwork);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<DeviceId | null>(null);
  const [path, setPath] = useState<DeviceId[]>(["PC1"]);
  const [stop, setStop] = useState<Prediction["stop"] | "">("");
  const [reason, setReason] = useState<Reason | "">("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [current, setCurrent] = useState<Attempt | null>(null);
  const [step, setStep] = useState(0);
  const [undo, setUndo] = useState<typeof network | null>(null);
  const result = current?.result;
  const activeStep = result?.trace[step];
  const feedback = current ? assess(current.prediction, current.result) : null;
  const allowed = Boolean(stop && reason && path.length > 0);
  const solved =
    current?.checks[0].status === "delivered" &&
    current?.checks[1].status === "dropped";
  function resetPrediction() {
    setPath(["PC1"]);
    setStop("");
    setReason("");
    setCurrent(null);
    setStep(0);
  }
  function changeRules(restore = false) {
    const previous = network;
    setNetwork(
      restore && undo
        ? undo
        : {
            ...network,
            router: {
              ...network.router,
              rules: [...network.router.rules].reverse(),
            },
          },
    );
    setUndo(restore ? null : previous);
    setRevision((r) => r + 1);
    resetPrediction();
  }
  function run() {
    if (!stop || !reason) return;
    const attempt: Attempt = {
      revision,
      rules: network.router.rules.map((r) => r.id),
      prediction: { path: [...path], stop, reason },
      result: simulate(network, probe()),
      checks: [simulate(network, probe(443)), simulate(network, probe(22))],
    };
    setAttempts((a) => [...a, attempt]);
    setCurrent(attempt);
    setStep(0);
  }
  return (
    <div className="app">
      <header>
        <a href="#lab" className="brand">
          <span className="brand-mark">↗</span> PRZEPŁYW
          <span className="brand-dot">.</span>
        </a>
        <span className="edition">
          NETWORK LAB <b>01</b>
        </span>
      </header>
      <main id="lab">
        <div className="eyebrow">
          <span /> LABORATORIUM SIECI <span className="duration">~ 3 MIN</span>
        </div>
        <h1>
          Połączenie pod
          <br />
          <em>Twoją kontrolą.</em>
        </h1>
        <p className="intro">
          Jeden pakiet. Dwie reguły. Sprawdź, która decyzja zmienia jego drogę.
        </p>
        <div className="mission">
          <span className="mission-icon">◎</span>
          <div>
            <b>Twoja misja</b>
            <p>
              Dostarcz <strong>TCP/443</strong> do serwera.
              <br />
              Zachowaj blokadę <strong>TCP/22</strong>.
            </p>
          </div>
          <span className="mission-number">01</span>
        </div>
        <div className="layout">
          <section className="lab-panel" aria-label="Topologia i przewidywanie">
            <div className="section-title">
              <h2>Droga pakietu</h2>
              <span className="pill">IPv4 · TCP/443</span>
            </div>
            <p className="hint">
              Dotknij urządzenia, aby sprawdzić konfigurację.
            </p>
            <div className="topology">
              <svg
                className="wires"
                viewBox="0 0 400 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M50 50H350" />
                <path className="wire-accent" d="M50 50H150" />
              </svg>
              {deviceIds.map((id, i) => (
                <div className="device" key={id}>
                  <button
                    className={`device-button ${selected === id ? "selected" : ""} ${activeStep?.device === id ? "active" : ""} ${activeStep?.device === id && result?.status === "dropped" && step === result.trace.length - 1 ? "blocked" : ""}`}
                    aria-label={`Konfiguracja ${id}`}
                    aria-expanded={selected === id}
                    onClick={() => setSelected(selected === id ? null : id)}
                  >
                    <Icon kind={id} />
                  </button>
                  <b>{id}</b>
                  <small>
                    {
                      [
                        "192.168.10.10",
                        "VLAN 10",
                        "Router / ACL",
                        "192.168.20.10",
                      ][i]
                    }
                  </small>
                </div>
              ))}
            </div>
            <div className="network-labels">
              <span>192.168.10.0/24</span>
              <span>192.168.20.0/24</span>
            </div>
            {selected && (
              <div className="config">
                <div className="section-title">
                  <b>{selected} · konfiguracja</b>
                  <button
                    className="text-button"
                    onClick={() => setSelected(null)}
                    aria-label="Zamknij konfigurację"
                  >
                    Zamknij ×
                  </button>
                </div>
                {selected === "SW1" ? (
                  <p>
                    Porty p1 i p2: access VLAN 10, aktywne. Uproszczona
                    osiągalność L2, bez uczenia MAC.
                  </p>
                ) : selected === "R1" ? (
                  <p>
                    LAN: 192.168.10.1/24
                    <br />
                    SERVER: 192.168.20.1/24
                    <br />
                    Trasy: dwie sieci podłączone. Forward: pierwsze dopasowanie,
                    domyślnie DENY.
                  </p>
                ) : (
                  <p>
                    {
                      network.hosts.find((h) => h.id === selected)!.interface
                        .cidr
                    }
                    <br />
                    Brama:{" "}
                    {network.hosts.find((h) => h.id === selected)!.gateway}
                    <br />
                    MAC:{" "}
                    {
                      network.hosts.find((h) => h.id === selected)!.interface
                        .mac
                    }
                  </p>
                )}
              </div>
            )}
            <div className="divider" />
            <div className="section-title">
              <h2>
                <span className="step-number">1</span> Przewidź przebieg
              </h2>
              <span className="revision">KONFIG. {revision + 1}</span>
            </div>
            <p className="hint">
              Dodawaj urządzenia w kolejności drogi pakietu, aż do zatrzymania
              lub celu.
            </p>
            <div className="path-buttons">
              {deviceIds.map((id) => (
                <button
                  key={id}
                  disabled={Boolean(current)}
                  onClick={() => setPath((p) => [...p, id])}
                >
                  {id}
                  <span>＋</span>
                </button>
              ))}
            </div>
            <div className="predicted-path" aria-live="polite">
              <span>
                {path.length
                  ? path.join(" → ")
                  : "Wybierz urządzenie początkowe"}
              </span>
              <button
                disabled={Boolean(current) || !path.length}
                onClick={() => setPath((p) => p.slice(0, -1))}
                aria-label="Usuń ostatnie urządzenie"
              >
                ↶
              </button>
            </div>
            <div className="prediction-fields">
              <label>
                Gdzie zakończy się próba?
                <select
                  value={stop}
                  disabled={Boolean(current)}
                  onChange={(e) =>
                    setStop(e.target.value as Prediction["stop"])
                  }
                >
                  <option value="" disabled>
                    Wybierz wynik
                  </option>
                  {deviceIds.map((id) => (
                    <option key={id} value={id}>
                      Zatrzymanie: {id}
                    </option>
                  ))}
                  <option value="delivered">Dostarczenie do serwera</option>
                </select>
              </label>
              <label>
                Jaka będzie przyczyna?
                <select
                  value={reason}
                  disabled={Boolean(current)}
                  onChange={(e) => setReason(e.target.value as Reason)}
                >
                  <option value="" disabled>
                    Wybierz przyczynę
                  </option>
                  {Object.entries(reasons).map(([key, label]) => (
                    <option value={key} key={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!current ? (
              <button className="primary run" disabled={!allowed} onClick={run}>
                <span>Uruchom symulację</span>
                <span>↗</span>
              </button>
            ) : (
              <button className="secondary run" onClick={resetPrediction}>
                Nowe przewidywanie ↻
              </button>
            )}
            <p className="model-note">
              Jeden pakiet, jeden kierunek. Bez pełnego ARP, TCP i TLS.
              Dostarczenie pakietu nie potwierdza działania HTTPS.
            </p>
          </section>
          <div className="side-column">
            <section className="rules-panel">
              <div className="section-title">
                <h2>
                  <span className="step-number">2</span> Zmień reguły
                </h2>
                <span className="pill">R1 · FORWARD</span>
              </div>
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
                      <small>192.168.10.0/24 → 192.168.20.0/24</small>
                      <code>{r.id}</code>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="rule-actions">
                <button className="secondary" onClick={() => changeRules()}>
                  ⇅ Zamień kolejność
                </button>
                <button
                  className="text-button"
                  disabled={!undo}
                  onClick={() => changeRules(true)}
                >
                  Cofnij
                </button>
              </div>
              <p className="hint rule-note" role="status">
                {revision > 0
                  ? "Konfiguracja zmieniona. Wykonaj nowe przewidywanie."
                  : "Zmieniaj kolejność i obserwuj konsekwencje."}
              </p>
            </section>
            <section className="result-panel" aria-label="Wynik symulacji">
              <div className="section-title">
                <h2>
                  <span className="step-number">3</span> Zaobserwuj
                </h2>
                {current && (
                  <span className={`result-tag ${result?.status}`}>
                    {result?.status === "delivered"
                      ? "DOSTARCZONY"
                      : "ZATRZYMANY"}
                  </span>
                )}
              </div>
              {!current ? (
                <div className="empty-result">
                  <span>⌁</span>
                  <b>Najpierw Twoja hipoteza.</b>
                  <p>
                    Po uruchomieniu zobaczysz decyzje urządzeń, krok po kroku.
                  </p>
                </div>
              ) : (
                <>
                  <div className="trace-step" aria-live="polite">
                    <div className="trace-meta">
                      KROK {step + 1} / {result!.trace.length}{" "}
                      <b>{activeStep!.device}</b>
                    </div>
                    <h3>{activeStep!.title}</h3>
                    <p>{activeStep!.detail}</p>
                    {activeStep?.frame && (
                      <details>
                        <summary>Adresy ramki i pakietu</summary>
                        <p>
                          MAC: {activeStep.frame.sourceMac} →{" "}
                          {activeStep.frame.destinationMac}
                          <br />
                          IP: {activeStep.frame.sourceIp} →{" "}
                          {activeStep.frame.destinationIp}
                        </p>
                      </details>
                    )}
                  </div>
                  <div className="playback">
                    <button
                      className="secondary"
                      aria-label="Poprzedni krok"
                      disabled={step === 0}
                      onClick={() => setStep((s) => s - 1)}
                    >
                      ← Wstecz
                    </button>
                    <span>
                      {step + 1}/{result!.trace.length}
                    </span>
                    <button
                      className="secondary"
                      disabled={step === result!.trace.length - 1}
                      onClick={() => setStep((s) => s + 1)}
                    >
                      Dalej →
                    </button>
                  </div>
                  <details className="full-trace">
                    <summary>Cały ślad decyzji</summary>
                    <ol>
                      {result!.trace.map((s, i) => (
                        <li key={i}>
                          <button onClick={() => setStep(i)}>
                            {s.device}: {s.title}
                          </button>
                        </li>
                      ))}
                    </ol>
                  </details>
                  <div className="feedback">
                    <h3>
                      {feedback!.mismatch
                        ? "Sprawdź swój model"
                        : "Przewidywanie potwierdzone"}
                    </h3>
                    <p className="comparison">
                      Przewidywanie: {current.prediction.path.join(" → ")} ·{" "}
                      {reasons[current.prediction.reason]}
                      <br />
                      Faktycznie: {result!.path.join(" → ")} ·{" "}
                      {reasons[result!.reason]}
                    </p>
                    <div className="feedback-checks">
                      <span>{feedback!.routeCorrect ? "✓" : "○"} Droga</span>
                      <span>
                        {feedback!.locationCorrect ? "✓" : "○"} Miejsce
                      </span>
                      <span>
                        {feedback!.reasonCorrect ? "✓" : "○"} Przyczyna
                      </span>
                    </div>
                    <p>
                      {feedback!.mismatch ??
                        "Droga, miejsce zakończenia i przyczyna zgadzają się z obliczonym przebiegiem."}
                    </p>
                    <small>
                      Dowód:{" "}
                      {feedback!.evidence.ruleId ?? feedback!.evidence.code} ·{" "}
                      {feedback!.evidence.detail}
                    </small>
                  </div>
                  <div className="checks">
                    <h3>Testy celu · ta konfiguracja</h3>
                    {current.checks.map((r, i) => (
                      <div key={i}>
                        <b>TCP/{i ? 22 : 443}</b>
                        <span>
                          {r.status === "delivered"
                            ? "Dostarczony"
                            : "Zablokowany"}
                        </span>
                        <strong
                          className={
                            (
                              i
                                ? r.status === "dropped"
                                : r.status === "delivered"
                            )
                              ? "check-ok"
                              : "check-no"
                          }
                        >
                          {(
                            i
                              ? r.status === "dropped"
                              : r.status === "delivered"
                          )
                            ? "✓"
                            : "×"}
                        </strong>
                      </div>
                    ))}
                    {solved && (
                      <p className="success" role="status">
                        ✓ Cel osiągnięty. 443 przechodzi, 22 pozostaje
                        zablokowany.
                      </p>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
        {attempts.length > 0 && (
          <details className="history">
            <summary>
              Historia prób <span>{attempts.length}</span>
            </summary>
            {attempts.map((a, i) => (
              <div className="history-item" key={i}>
                <b>
                  Próba {i + 1} · konfiguracja {a.revision + 1}
                </b>
                <p>
                  Reguły: {a.rules.join(" → ")}
                  <br />
                  Przewidywanie: {a.prediction.path.join(" → ")};{" "}
                  {a.prediction.stop === "delivered"
                    ? "dostarczenie"
                    : `stop: ${a.prediction.stop}`}
                  ; {reasons[a.prediction.reason]}
                  <br />
                  Wynik: {a.result.path.join(" → ")}; {reasons[a.result.reason]}
                </p>
              </div>
            ))}
          </details>
        )}
        <footer>
          <span>PRZEWIDŹ. SPRAWDŹ. ZROZUM.</span>
          <span>Prototyp 0.1 · historia do odświeżenia</span>
        </footer>
      </main>
    </div>
  );
}
