import { useEffect, useRef } from "react";
import { deviceIds, type DeviceId, type Reason } from "../network/model";
import { scenarioIds, labs } from "../scenarios/labs";
import { parseCidr } from "../network/ipv4";
import type { Network } from "../network/model";
import ScenarioEditor from "./ScenarioEditor";
import { assess, type Prediction } from "../assessment/feedback";

import { useLabSession } from "../session/useLabSession";
import { makeAttempt } from "../session/model";
import PwaStatus from "./PwaStatus";
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
  const saved = useLabSession();
  const {
    network,
    revision,
    selected,
    path,
    stop,
    reason,
    attempts,
    current,
    step,
    undo,
  } = saved.session;
  const lab = labs[saved.session.scenarioId];
  const setNetwork = saved.setter("network");
  const setRevision = saved.setter("revision");
  const setSelected = saved.setter("selected");
  const setPath = saved.setter("path");
  const setStop = saved.setter("stop");
  const setReason = saved.setter("reason");
  const setAttempts = saved.setter("attempts");
  const setCurrent = saved.setter("current");
  const setStep = saved.setter("step");
  const setUndo = saved.setter("undo");
  const resultPanel = useRef<HTMLElement>(null);
  const predictionHeading = useRef<HTMLHeadingElement>(null);
  const canExperiment = attempts.length > 0;
  useEffect(() => {
    if (!current) return;
    resultPanel.current?.focus({ preventScroll: true });
    if (window.matchMedia("(max-width: 760px)").matches) {
      resultPanel.current?.scrollIntoView({ block: "start" });
    }
  }, [current]);
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
    predictionHeading.current?.focus({ preventScroll: true });
    if (window.matchMedia("(max-width: 760px)").matches) {
      predictionHeading.current?.scrollIntoView({ block: "start" });
    }
  }
  function changeNetwork(next: Network, restore = false) {
    if (!canExperiment || (restore && !undo)) return;
    const previous = network;
    setNetwork(next);
    setUndo(restore ? null : previous);
    setRevision((r) => r + 1);
    resetPrediction();
  }
  function run() {
    if (!stop || !reason) return;
    const attempt = makeAttempt(network, revision, {
      path: [...path],
      stop,
      reason,
    });
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
          NETWORK LAB{" "}
          <b>
            {saved.workspace.showPicker
              ? "03"
              : `0${scenarioIds.indexOf(saved.session.scenarioId) + 1}`}
          </b>
        </span>
      </header>
      <PwaStatus {...saved} />
      <main id="lab" inert={!saved.ready} aria-busy={!saved.ready}>
        {saved.workspace.showPicker ? (
          <section aria-label="Wybór laboratorium">
            <h1>Wybierz problem.</h1>
            <p className="intro">
              Trzy laboratoria. Najpierw Twoja diagnoza, potem eksperyment.
            </p>
            <div className="lab-picker">
              {scenarioIds.map((id) => {
                const progress = saved.workspace.labs[id];
                const started = Boolean(
                  progress &&
                  (progress.attempts.length ||
                    progress.path.length > 1 ||
                    progress.stop),
                );
                return (
                  <article key={id}>
                    <span className="pill">{labs[id].time}</span>
                    <h2>{labs[id].title}</h2>
                    <p>{labs[id].description}</p>
                    <button
                      className="primary"
                      onClick={() => {
                        saved.chooseScenario(id);
                        window.scrollTo(0, 0);
                      }}
                    >
                      {started ? "Wznów" : "Rozpocznij"} · {id.toUpperCase()}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        ) : (
          <>
            <button
              className="text-button"
              onClick={() => {
                saved.openPicker();
                window.scrollTo(0, 0);
              }}
            >
              ← Wybór laboratorium
            </button>
            <div className="eyebrow">
              <span /> LABORATORIUM SIECI{" "}
              <span className="duration">{lab.time.toUpperCase()}</span>
            </div>
            <h1>
              Połączenie pod
              <br />
              <em>Twoją kontrolą.</em>
            </h1>
            <p className="intro">
              {lab.title}. {lab.description}
            </p>
            <div className="mission">
              <span className="mission-icon">◎</span>
              <div>
                <b>Twoja misja</b>
                <p>{lab.mission}</p>
              </div>
              <span className="mission-number">
                0{scenarioIds.indexOf(saved.session.scenarioId) + 1}
              </span>
            </div>
            <div className="layout">
              <section
                className="lab-panel"
                aria-label="Topologia i przewidywanie"
              >
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
                  {deviceIds.map((id) => (
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
                        {id === "PC1" || id === "SERVER"
                          ? parseCidr(
                              network.hosts.find((h) => h.id === id)!.interface
                                .cidr,
                            ).address
                          : id === "SW1"
                            ? `VLAN ${network.switch.ports.map((p) => p.vlan).join(" / ")}`
                            : "Router / ACL"}
                      </small>
                    </div>
                  ))}
                </div>
                <div className="network-labels">
                  {network.router.interfaces.map((intf) => (
                    <span key={intf.id}>
                      {intf.id}: {intf.cidr}
                    </span>
                  ))}
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
                        {network.switch.ports.map((port) => (
                          <span key={port.id}>
                            {port.id}: access VLAN {port.vlan},{" "}
                            {port.up ? "aktywny" : "wyłączony"}
                            <br />
                          </span>
                        ))}
                        Uproszczona osiągalność L2, bez uczenia MAC.
                      </p>
                    ) : selected === "R1" ? (
                      <p>
                        {network.router.interfaces.map((intf) => (
                          <span key={intf.id}>
                            {intf.id}: {intf.cidr}
                            <br />
                          </span>
                        ))}
                        Trasy: dwie sieci podłączone. Forward: pierwsze
                        dopasowanie, domyślnie DENY.
                      </p>
                    ) : (
                      <p>
                        {
                          network.hosts.find((h) => h.id === selected)!
                            .interface.cidr
                        }
                        <br />
                        Brama:{" "}
                        {network.hosts.find((h) => h.id === selected)!.gateway}
                        <br />
                        MAC:{" "}
                        {
                          network.hosts.find((h) => h.id === selected)!
                            .interface.mac
                        }
                      </p>
                    )}
                  </div>
                )}
                <div className="divider" />
                <div className="section-title">
                  <h2 ref={predictionHeading} tabIndex={-1}>
                    <span className="step-number">1</span> Przewidź przebieg
                  </h2>
                  <span className="revision">KONFIG. {revision + 1}</span>
                </div>
                <p className="hint">
                  Dodawaj urządzenia w kolejności drogi pakietu, aż do
                  zatrzymania lub celu.
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
                  <button
                    className="primary run"
                    disabled={!allowed}
                    onClick={run}
                  >
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
                <section
                  className="result-panel"
                  aria-label="Wynik symulacji"
                  ref={resultPanel}
                  tabIndex={-1}
                >
                  <div className="section-title">
                    <h2>
                      <span className="step-number">2</span> Uruchom i
                      zaobserwuj
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
                        Po uruchomieniu zobaczysz decyzje urządzeń, krok po
                        kroku.
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
                          <span>
                            {feedback!.routeCorrect ? "✓" : "○"} Droga
                          </span>
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
                          {feedback!.evidence.ruleId ?? feedback!.evidence.code}{" "}
                          · {feedback!.evidence.detail}
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
                <ScenarioEditor
                  key={saved.session.scenarioId}
                  id={saved.session.scenarioId}
                  network={network}
                  enabled={canExperiment}
                  undo={Boolean(undo)}
                  revision={revision}
                  onChange={(next) => changeNetwork(next)}
                  onUndo={() => {
                    if (undo) changeNetwork(undo, true);
                  }}
                />
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
                      Konfiguracja: brama {a.network.hosts[0].gateway}; VLAN{" "}
                      {a.network.switch.ports.map((p) => p.vlan).join(" / ")};
                      ACL {a.rules.join(" → ")}
                      <br />
                      Przewidywanie: {a.prediction.path.join(" → ")};{" "}
                      {a.prediction.stop === "delivered"
                        ? "dostarczenie"
                        : `stop: ${a.prediction.stop}`}
                      ; {reasons[a.prediction.reason]}
                      <br />
                      Wynik: {a.result.path.join(" → ")};{" "}
                      {reasons[a.result.reason]}
                    </p>
                  </div>
                ))}
              </details>
            )}
            <footer>
              <span>PRZEWIDŹ. SPRAWDŹ. ZROZUM.</span>
              <span>Prototyp 0.2 · sesja na tym urządzeniu</span>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
