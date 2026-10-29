import type { DeviceId, Reason, Result } from "../network/model";
export type Prediction = {
  path: DeviceId[];
  stop: DeviceId | "delivered";
  reason: Reason;
};
export function assess(prediction: Prediction, result: Result) {
  const actualStop =
    result.status === "delivered"
      ? "delivered"
      : result.trace[result.trace.length - 1].device;
  const routeIndex = Math.max(prediction.path.length, result.path.length);
  let mismatch: string | undefined;
  for (let i = 0; i < routeIndex; i++) {
    if (prediction.path[i] !== result.path[i]) {
      mismatch = `Krok ${i + 1}: przewidziano ${prediction.path[i] ?? "koniec drogi"}, przebieg wskazuje ${result.path[i] ?? "koniec drogi"}.`;
      break;
    }
  }
  const locationCorrect = prediction.stop === actualStop;
  const reasonCorrect = prediction.reason === result.reason;
  if (!mismatch && !locationCorrect)
    mismatch = `Przewidywany wynik: ${prediction.stop === "delivered" ? "dostarczenie" : `zatrzymanie na ${prediction.stop}`}. Faktyczny: ${actualStop === "delivered" ? "dostarczenie" : `zatrzymanie na ${actualStop}`}.`;
  if (!mismatch && !reasonCorrect)
    mismatch = `Droga i miejsce zgadzają się. Pierwsza rozbieżność dotyczy przyczyny: ${result.trace[result.trace.length - 1].detail}`;
  return {
    locationCorrect,
    reasonCorrect,
    routeCorrect: prediction.path.join(",") === result.path.join(","),
    mismatch,
    evidence: result.trace[result.trace.length - 1],
  };
}
