import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { openDB } from "idb";
import { createSessionStore } from "./sessionStore";
import {
  decodeSession,
  envelope,
  freshSession,
  type Attempt,
} from "../session/model";
import { simulate } from "../network/simulate";
import { probe } from "../network/scenario";
import { assess } from "../assessment/feedback";
afterEach(() => vi.unstubAllGlobals());
it("przywraca konfigurację, cofnięcie, historię, ocenę i krok po ponownym otwarciu bazy", async () => {
  const name = "session-roundtrip";
  const s = freshSession();
  s.undo = structuredClone(s.network);
  s.network.router.rules.reverse();
  s.revision = 1;
  const prediction = {
    path: ["PC1", "SW1", "R1", "SERVER"] as const,
    stop: "delivered" as const,
    reason: "delivered" as const,
  };
  const p = { ...prediction, path: [...prediction.path] };
  const result = simulate(s.network, probe());
  const attempt: Attempt = {
    revision: 1,
    rules: s.network.router.rules.map((r) => r.id),
    prediction: p,
    result,
    checks: [result, simulate(s.network, probe(22))],
    assessment: assess(p, result),
  };
  s.attempts = [attempt];
  s.current = attempt;
  s.step = 2;
  s.path = [...p.path];
  s.stop = p.stop;
  s.reason = p.reason;
  s.selected = "R1";
  const first = createSessionStore(name);
  expect(await first.load()).toEqual({ kind: "empty" });
  await first.save(s);
  await first.close();
  const second = createSessionStore(name);
  expect(await second.load()).toEqual({ kind: "restored", session: s });
  await second.close();
});
it("zachowuje rozpoczęte przewidywanie bez ukończonej próby", async () => {
  const store = createSessionStore("draft-roundtrip");
  const s = freshSession();
  s.path.push("SW1");
  s.stop = "R1";
  s.reason = "acl";
  s.selected = "SW1";
  await store.save(s);
  expect(await store.load()).toEqual({ kind: "restored", session: s });
  await store.close();
});
it("odróżnia niezgodną wersję formatu, scenariusza i silnika", () => {
  for (const key of ["formatVersion", "scenarioVersion", "engineVersion"]) {
    expect(
      decodeSession({ ...envelope(freshSession()), [key]: "future" }),
    ).toEqual({ kind: "incompatible" });
  }
});
it("odrzuca uszkodzony zapis i niespójny krok zamiast przekazywać je do UI", () => {
  expect(decodeSession({ ...envelope(freshSession()), state: {} })).toEqual({
    kind: "invalid",
  });
  expect(decodeSession(envelope({ ...freshSession(), step: 9 }))).toEqual({
    kind: "invalid",
  });
});
it("odczytuje niezgodny rekord z IndexedDB bez błędu bazy", async () => {
  const store = createSessionStore("old-session");
  await store.load();
  const db = await openDB("old-session", 1);
  await db.put("session", { formatVersion: 0 }, "active");
  db.close();
  expect(await store.load()).toEqual({ kind: "incompatible" });
  await store.close();
});
it("zgłasza niedostępny IndexedDB, aby UI mogło przejść do pracy w pamięci", async () => {
  vi.stubGlobal("indexedDB", undefined);
  const store = createSessionStore("unavailable");
  await expect(store.load()).rejects.toThrow();
});
