import {
  scenarioIds,
  scenarioNetwork,
  scenarioProbe,
  type ScenarioId,
} from "../scenarios/labs";
import { simulate } from "../network/simulate";
import { ipv4 } from "../network/ipv4";
import { assess, type Prediction } from "../assessment/feedback";
import {
  deviceIds,
  type DeviceId,
  type Network,
  type Reason,
  type Result,
} from "../network/model";
import {
  decodeSession as decodeLegacy,
  type Session as LegacySession,
} from "./legacy";
export type Attempt = {
  revision: number;
  rules: string[];
  network: Network;
  prediction: Prediction;
  result: Result;
  checks: Result[];
  assessment: ReturnType<typeof assess>;
};
export type Session = {
  scenarioId: ScenarioId;
  network: Network;
  revision: number;
  selected: DeviceId | null;
  path: DeviceId[];
  stop: Prediction["stop"] | "";
  reason: Reason | "";
  attempts: Attempt[];
  current: Attempt | null;
  step: number;
  undo: Network | null;
};
export type Workspace = {
  activeScenario: ScenarioId;
  showPicker: boolean;
  labs: Partial<Record<ScenarioId, Session>>;
};
export const freshSession = (scenarioId: ScenarioId = "acl"): Session => ({
  scenarioId,
  network: scenarioNetwork(scenarioId),
  revision: 0,
  selected: null,
  path: ["PC1"],
  stop: "",
  reason: "",
  attempts: [],
  current: null,
  step: 0,
  undo: null,
});
export const workspaceFor = (
  session = freshSession(),
  showPicker = true,
): Workspace => ({
  activeScenario: session.scenarioId,
  showPicker,
  labs: { [session.scenarioId]: session },
});
export const freshWorkspace = () => workspaceFor();
export const FORMAT_VERSION = 2;
export const SCENARIO_VERSION = "network-labs-1";
export const ENGINE_VERSION = 2;
export const envelope = (state: Workspace) => ({
  formatVersion: FORMAT_VERSION,
  scenarioVersion: SCENARIO_VERSION,
  engineVersion: ENGINE_VERSION,
  state,
});
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const integer = (v: unknown): v is number =>
  Number.isSafeInteger(v) && Number(v) >= 0;
const device = (v: unknown): v is DeviceId => deviceIds.includes(v as DeviceId);
const reason = (v: unknown): v is Reason =>
  ["acl", "gateway", "l2", "route", "delivered"].includes(v as string);
const path = (v: unknown): v is DeviceId[] =>
  Array.isArray(v) && v.length <= 1000 && v.every(device);
const stop = (v: unknown): v is Prediction["stop"] =>
  v === "delivered" || device(v);
const scenario = (v: unknown): v is ScenarioId =>
  scenarioIds.includes(v as ScenarioId);
function validNetwork(value: unknown, id: ScenarioId): value is Network {
  try {
    const candidate = value as Network;
    const expected = scenarioNetwork(id);
    if (id === "acl") {
      if (
        candidate.router.rules.map((r) => r.id).join(",") ===
        "allow-443,deny-subnets"
      )
        expected.router.rules.reverse();
    } else if (id === "gateway") {
      const gateway = candidate.hosts[0].gateway;
      if (typeof gateway !== "string") return false;
      ipv4(gateway);
      expected.hosts[0].gateway = gateway;
    } else {
      const vlan = candidate.switch.ports[1].vlan;
      if (!Number.isInteger(vlan) || vlan < 1 || vlan > 4094) return false;
      expected.switch.ports[1].vlan = vlan;
    }
    return JSON.stringify(candidate) === JSON.stringify(expected);
  } catch {
    return false;
  }
}
export function makeAttempt(
  network: Network,
  revision: number,
  prediction: Prediction,
): Attempt {
  const snapshot = structuredClone(network);
  const result = simulate(snapshot, scenarioProbe());
  return {
    network: snapshot,
    revision,
    rules: snapshot.router.rules.map((r) => r.id),
    prediction: structuredClone(prediction),
    result,
    checks: [result, simulate(snapshot, scenarioProbe(22))],
    assessment: assess(prediction, result),
  };
}
function readAttempt(v: unknown, id: ScenarioId): Attempt {
  if (
    !object(v) ||
    !integer(v.revision) ||
    !validNetwork(v.network, id) ||
    !object(v.prediction)
  )
    throw Error("attempt");
  const p = v.prediction;
  if (!path(p.path) || !stop(p.stop) || !reason(p.reason))
    throw Error("prediction");
  return makeAttempt(v.network, v.revision, {
    path: p.path,
    stop: p.stop,
    reason: p.reason,
  });
}
function readSession(v: unknown, id: ScenarioId): Session {
  if (
    !object(v) ||
    v.scenarioId !== id ||
    !validNetwork(v.network, id) ||
    !integer(v.revision) ||
    !(v.selected === null || device(v.selected)) ||
    !path(v.path) ||
    !(v.stop === "" || stop(v.stop)) ||
    !(v.reason === "" || reason(v.reason)) ||
    !Array.isArray(v.attempts) ||
    !integer(v.step) ||
    !(v.undo === null || validNetwork(v.undo, id))
  )
    throw Error("session");
  const attempts = v.attempts.map((a) => readAttempt(a, id));
  if (attempts.some((a) => a.revision > Number(v.revision)))
    throw Error("revision");
  const current = v.current === null ? null : readAttempt(v.current, id);
  if (
    current &&
    (current.revision !== v.revision ||
      JSON.stringify(current) !== JSON.stringify(attempts.at(-1)) ||
      JSON.stringify(current.network) !== JSON.stringify(v.network))
  )
    throw Error("current");
  if (v.step >= (current?.result.trace.length ?? 1)) throw Error("step");
  if (
    !attempts.length &&
    (v.revision !== 0 ||
      v.undo !== null ||
      JSON.stringify(v.network) !== JSON.stringify(scenarioNetwork(id)))
  )
    throw Error("locked");
  return {
    scenarioId: id,
    network: v.network,
    revision: v.revision,
    selected: v.selected,
    path: v.path,
    stop: v.stop,
    reason: v.reason,
    attempts,
    current,
    step: v.step,
    undo: v.undo,
  };
}
function migrate(old: LegacySession): Workspace {
  const convert = (a: LegacySession["attempts"][number]) => {
    const n = scenarioNetwork("acl");
    if (a.rules[0] === "allow-443") n.router.rules.reverse();
    return makeAttempt(n, a.revision, a.prediction);
  };
  const s: Session = {
    ...old,
    scenarioId: "acl",
    attempts: old.attempts.map(convert),
    current: old.current ? convert(old.current) : null,
  };
  return workspaceFor(s, false);
}
export function decodeSession(
  value: unknown,
):
  | { kind: "restored"; session: Workspace; migrated?: true }
  | { kind: "incompatible" }
  | { kind: "invalid" } {
  if (!object(value)) return { kind: "invalid" };
  if (value.formatVersion === 1) {
    const old = decodeLegacy(value);
    return old.kind === "restored"
      ? { kind: "restored", session: migrate(old.session), migrated: true }
      : old;
  }
  if (
    value.formatVersion !== FORMAT_VERSION ||
    value.scenarioVersion !== SCENARIO_VERSION ||
    value.engineVersion !== ENGINE_VERSION
  )
    return { kind: "incompatible" };
  try {
    const s = value.state;
    if (
      !object(s) ||
      !scenario(s.activeScenario) ||
      typeof s.showPicker !== "boolean" ||
      !object(s.labs)
    )
      throw Error("workspace");
    const labs: Workspace["labs"] = {};
    for (const id of scenarioIds)
      if (s.labs[id] !== undefined) labs[id] = readSession(s.labs[id], id);
    if (!labs[s.activeScenario]) throw Error("active");
    return {
      kind: "restored",
      session: {
        activeScenario: s.activeScenario,
        showPicker: s.showPicker,
        labs,
      },
    };
  } catch {
    return { kind: "invalid" };
  }
}
