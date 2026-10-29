import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { openDB } from "idb";
import { createSessionStore } from "./sessionStore";
import {
  decodeSession,
  envelope,
  freshSession,
  freshWorkspace,
  workspaceFor,
  makeAttempt,
} from "../session/model";
import * as legacy from "../session/legacy";
afterEach(() => vi.unstubAllGlobals());
it("zapisuje niezależne konfiguracje, historię, ocenę, krok i draft trzech laboratoriów", async () => {
  const w = freshWorkspace();
  const acl = w.labs.acl!;
  const prediction = {
    path: ["PC1", "SW1", "R1"] as ("PC1" | "SW1" | "R1")[],
    stop: "R1" as const,
    reason: "acl" as const,
  };
  acl.attempts = [makeAttempt(acl.network, 0, prediction)];
  acl.current = acl.attempts[0];
  acl.step = 2;
  const gateway = freshSession("gateway");
  gateway.attempts = [
    makeAttempt(gateway.network, 0, {
      path: ["PC1"],
      stop: "PC1",
      reason: "gateway",
    }),
  ];
  gateway.undo = structuredClone(gateway.network);
  gateway.network.hosts[0].gateway = "192.168.10.1";
  gateway.revision = 1;
  gateway.path.push("SW1");
  gateway.stop = "delivered";
  gateway.reason = "delivered";
  w.labs.gateway = gateway;
  w.labs.vlan = freshSession("vlan");
  w.activeScenario = "gateway";
  w.showPicker = false;
  const first = createSessionStore("all-labs");
  await first.save(w);
  await first.close();
  const second = createSessionStore("all-labs");
  expect(await second.load()).toEqual({ kind: "restored", session: w });
  await second.close();
});
it("migruje zapis PR #2, zachowując oryginał także po zapisie nowego formatu", async () => {
  const old = legacy.freshSession();
  old.network.router.rules.reverse();
  old.revision = 1;
  old.undo = legacy.freshSession().network;
  // This is a real v1 envelope with an in-progress prediction.
  old.path.push("SW1");
  old.stop = "R1";
  old.reason = "acl";
  // A valid prior trial unlocks the changed configuration.
  const prediction = {
    path: ["PC1", "SW1", "R1"] as ("PC1" | "SW1" | "R1")[],
    stop: "R1" as const,
    reason: "acl" as const,
  };
  const attempt = makeAttempt(legacy.freshSession().network, 0, prediction);
  const { network: _snapshot, ...oldAttempt } = attempt;
  void _snapshot;
  old.attempts = [oldAttempt];
  const original = legacy.envelope(old);
  const store = createSessionStore("legacy-migration");
  await store.load();
  const db = await openDB("legacy-migration", 1);
  await db.put("session", original, "active");
  const restored = await store.load();
  expect(restored.kind).toBe("restored");
  if (restored.kind !== "restored") throw Error();
  expect(restored.migrated).toBe(true);
  expect(restored.session.activeScenario).toBe("acl");
  const migrated = restored.session.labs.acl!;
  expect(migrated.network).toEqual(old.network);
  expect(migrated.undo).toEqual(old.undo);
  expect(migrated.path).toEqual(old.path);
  expect(migrated.attempts[0].result).toEqual(old.attempts[0].result);
  await store.save(restored.session);
  expect(await db.get("session", "backup-pr2")).toEqual(original);
  expect((await db.get("session", "active")).formatVersion).toBe(2);
  expect((await store.load()).kind).toBe("restored");
  db.close();
  await store.close();
});
it("przenosi ukończoną próbę i krok odtwarzania z wersji 1", () => {
  const old = legacy.freshSession();
  const a = makeAttempt(old.network, 0, {
    path: ["PC1", "SW1", "R1"],
    stop: "R1",
    reason: "acl",
  });
  const { network: _n, ...legacyAttempt } = a;
  void _n;
  old.attempts = [legacyAttempt];
  old.current = legacyAttempt;
  old.step = 3;
  const loaded = decodeSession(legacy.envelope(old));
  expect(loaded.kind).toBe("restored");
  if (loaded.kind === "restored") {
    expect(loaded.session.labs.acl!.step).toBe(3);
    expect(loaded.session.labs.acl!.current!.prediction).toEqual(a.prediction);
  }
});
it("zachowuje nieznany zapis przed zastąpieniem go nową sesją", async () => {
  const store = createSessionStore("future-data");
  await store.load();
  const db = await openDB("future-data", 1);
  const original = { formatVersion: 99, state: { important: "keep" } };
  await db.put("session", original, "active");
  expect(await store.load()).toEqual({ kind: "incompatible" });
  await store.save(freshWorkspace());
  expect(await db.get("session", "backup-unrecognized")).toEqual(original);
  db.close();
  await store.close();
});
it("odrzuca zmiany konfiguracji spoza dozwolonego zakresu i niespójne kroki", () => {
  const s = freshSession("vlan");
  s.network.switch.ports[0].vlan = 100;
  expect(decodeSession(envelope(workspaceFor(s)))).toEqual({ kind: "invalid" });
  const draft = freshSession();
  draft.step = 9;
  expect(decodeSession(envelope(workspaceFor(draft)))).toEqual({
    kind: "invalid",
  });
});
it("odróżnia niezgodną wersję formatu, scenariusza i silnika", () => {
  for (const key of ["formatVersion", "scenarioVersion", "engineVersion"])
    expect(
      decodeSession({ ...envelope(freshWorkspace()), [key]: "future" }),
    ).toEqual({ kind: "incompatible" });
});
it("zgłasza niedostępny IndexedDB dla trybu pracy w pamięci", async () => {
  vi.stubGlobal("indexedDB", undefined);
  await expect(createSessionStore("unavailable").load()).rejects.toThrow();
});
