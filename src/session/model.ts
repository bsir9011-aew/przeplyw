import { initialNetwork, probe } from "../network/scenario";
import { simulate } from "../network/simulate";
import { assess, type Prediction } from "../assessment/feedback";
import {
  deviceIds,
  type DeviceId,
  type Network,
  type Reason,
  type Result,
} from "../network/model";
export type Attempt = {
  revision: number;
  rules: string[];
  prediction: Prediction;
  result: Result;
  checks: Result[];
  assessment: ReturnType<typeof assess>;
};
export type Session = {
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
export const freshSession = (): Session => ({
  network: initialNetwork(),
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
export const FORMAT_VERSION = 1;
export const SCENARIO_VERSION = "network-acl-1";
export const ENGINE_VERSION = 1;
export const envelope = (state: Session) => ({
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
function validNetwork(value: unknown): value is Network {
  const normal = initialNetwork();
  const reversed = initialNetwork();
  reversed.router.rules.reverse();
  return (
    JSON.stringify(value) === JSON.stringify(normal) ||
    JSON.stringify(value) === JSON.stringify(reversed)
  );
}
function readAttempt(value: unknown): Attempt {
  if (
    !object(value) ||
    !integer(value.revision) ||
    !Array.isArray(value.rules) ||
    !object(value.prediction)
  )
    throw Error("attempt");
  const network = initialNetwork();
  const order = value.rules.join(",");
  if (order === "allow-443,deny-subnets") network.router.rules.reverse();
  else if (order !== "deny-subnets,allow-443") throw Error("rules");
  const p = value.prediction;
  if (!path(p.path) || !stop(p.stop) || !reason(p.reason))
    throw Error("prediction");
  const prediction: Prediction = {
    path: p.path,
    stop: p.stop,
    reason: p.reason,
  };
  // Recompute derived evidence under the declared engine/scenario version.
  const result = simulate(network, probe());
  return {
    revision: value.revision,
    rules: value.rules as string[],
    prediction,
    result,
    checks: [result, simulate(network, probe(22))],
    assessment: assess(prediction, result),
  };
}
export function decodeSession(
  value: unknown,
):
  | { kind: "restored"; session: Session }
  | { kind: "incompatible" }
  | { kind: "invalid" } {
  if (!object(value)) return { kind: "invalid" };
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
      !validNetwork(s.network) ||
      !integer(s.revision) ||
      !(s.selected === null || device(s.selected)) ||
      !path(s.path) ||
      !(s.stop === "" || stop(s.stop)) ||
      !(s.reason === "" || reason(s.reason)) ||
      !Array.isArray(s.attempts) ||
      !integer(s.step) ||
      !(s.undo === null || validNetwork(s.undo))
    )
      throw Error("session");
    const attempts = s.attempts.map(readAttempt);
    if (attempts.some((a) => a.revision > Number(s.revision)))
      throw Error("revision");
    let current: Attempt | null = null;
    if (s.current !== null) {
      current = readAttempt(s.current);
      if (
        !attempts.length ||
        JSON.stringify(current) !== JSON.stringify(attempts.at(-1)) ||
        current.revision !== s.revision ||
        current.rules.join(",") !==
          s.network.router.rules.map((r) => r.id).join(",")
      )
        throw Error("current");
    }
    if (s.step >= (current?.result.trace.length ?? 1)) throw Error("step");
    if (
      !attempts.length &&
      (s.revision !== 0 ||
        s.undo !== null ||
        s.network.router.rules[0].action !== "deny")
    )
      throw Error("locked");
    return {
      kind: "restored",
      session: {
        network: s.network,
        revision: s.revision,
        selected: s.selected,
        path: s.path,
        stop: s.stop,
        reason: s.reason,
        attempts,
        current,
        step: s.step,
        undo: s.undo,
      },
    };
  } catch {
    return { kind: "invalid" };
  }
}
