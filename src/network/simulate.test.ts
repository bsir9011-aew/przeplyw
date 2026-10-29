import { describe, expect, it } from "vitest";
import { inSubnet, ipv4, nextHop, parseCidr } from "./ipv4";
import { initialNetwork, probe } from "./scenario";
import { simulate } from "./simulate";
import { assess } from "../assessment/feedback";
const repaired = () => {
  const n = initialNetwork();
  n.router.rules.reverse();
  return n;
};
describe("IPv4 i następny skok", () => {
  it("rozpoznaje podsieci bez błędu liczb ze znakiem", () => {
    expect(inSubnet("192.168.10.255", "192.168.10.0/24")).toBe(true);
    expect(inSubnet("192.168.11.0", "192.168.10.0/24")).toBe(false);
    expect(inSubnet("255.255.255.255", "0.0.0.0/0")).toBe(true);
    expect(inSubnet("192.168.1.1", "192.168.1.1/32")).toBe(true);
    expect(inSubnet("192.168.1.2", "192.168.1.1/32")).toBe(false);
  });
  it("odrzuca błędne adresy i prefiksy", () => {
    expect(() => ipv4("1.2.3.256")).toThrow();
    expect(() => parseCidr("192.168.1.1/33")).toThrow();
  });
  it("wybiera cel lokalny lub bramę", () => {
    expect(nextHop("192.168.10.10/24", "192.168.10.20", "192.168.10.1")).toBe(
      "192.168.10.20",
    );
    expect(nextHop("192.168.10.10/24", "192.168.20.10", "192.168.10.1")).toBe(
      "192.168.10.1",
    );
    expect(nextHop("192.168.10.10/24", "192.168.20.10")).toBeUndefined();
  });
});
describe("obliczony przebieg", () => {
  it("blokuje 443 na pierwszej regule i nie sprawdza kolejnej", () => {
    const r = simulate(initialNetwork(), probe());
    expect(r.status).toBe("dropped");
    expect(r.path).toEqual(["PC1", "SW1", "R1"]);
    expect(r.trace.at(-1)?.ruleId).toBe("deny-subnets");
  });
  it("dostarcza 443 po zamianie, nadal blokując 22", () => {
    const n = repaired();
    const r = simulate(n, probe());
    expect(r.status).toBe("delivered");
    expect(r.path).toEqual(["PC1", "SW1", "R1", "SERVER"]);
    expect(simulate(n, probe(22)).status).toBe("dropped");
    const frames = r.trace.filter((s) => s.frame).map((s) => s.frame!);
    expect(frames[0].sourceMac).not.toBe(frames[1].sourceMac);
    expect(frames[0].sourceIp).toBe(frames[1].sourceIp);
    expect(frames[0].destinationIp).toBe(frames[1].destinationIp);
  });
  it("działa także bez reguły blokującej i stosuje default deny", () => {
    const n = repaired();
    n.router.rules = n.router.rules.filter((r) => r.action === "allow");
    expect(simulate(n, probe()).status).toBe("delivered");
    expect(simulate(n, probe(22)).trace.at(-1)?.ruleId).toBeUndefined();
    expect(simulate(n, probe(22)).reason).toBe("acl");
  });
  it("nie znajduje sąsiada przez inny VLAN albo wyłączone łącze", () => {
    const n = repaired();
    n.switch.ports[1].vlan = 20;
    expect(simulate(n, probe()).reason).toBe("l2");
    n.switch.ports[1].vlan = 10;
    n.links[0].up = false;
    expect(simulate(n, probe()).reason).toBe("l2");
  });
  it("wykrywa brak bramy i brak trasy z konfiguracji", () => {
    const n = repaired();
    n.hosts[0].gateway = undefined;
    expect(simulate(n, probe()).reason).toBe("gateway");
    n.hosts[0].gateway = "192.168.10.1";
    expect(simulate(n, { ...probe(), destination: "10.0.0.8" }).reason).toBe(
      "route",
    );
  });
  it("jest deterministyczny i nie mutuje konfiguracji", () => {
    const n = initialNetwork();
    const before = JSON.stringify(n);
    expect(simulate(n, probe())).toEqual(simulate(n, probe()));
    expect(JSON.stringify(n)).toBe(before);
  });
});
describe("feedback", () => {
  it("oddziela miejsce od przyczyny i wskazuje dowód ACL", () => {
    const result = simulate(initialNetwork(), probe());
    const f = assess(
      { path: ["PC1", "SW1", "R1"], stop: "R1", reason: "route" },
      result,
    );
    expect(f.locationCorrect).toBe(true);
    expect(f.reasonCorrect).toBe(false);
    expect(f.mismatch).toContain("przyczyny");
    expect(f.evidence.ruleId).toBe("deny-subnets");
  });
  it("wskazuje pierwszą rozbieżność drogi zamiast późniejszej przyczyny", () => {
    const f = assess(
      { path: ["PC1", "R1", "SERVER"], stop: "delivered", reason: "delivered" },
      simulate(initialNetwork(), probe()),
    );
    expect(f.mismatch).toContain("Krok 2");
    expect(f.evidence.device).toBe("SW1");
    expect(f.evidence.code).toBe("L2_FORWARD");
    expect(f.mismatch).toContain(f.evidence.detail);
    expect(f.locationCorrect).toBe(false);
    expect(f.reasonCorrect).toBe(false);
  });
  it("potwierdza poprawne przewidywanie", () => {
    expect(
      assess(
        {
          path: ["PC1", "SW1", "R1", "SERVER"],
          stop: "delivered",
          reason: "delivered",
        },
        simulate(repaired(), probe()),
      ).mismatch,
    ).toBeUndefined();
  });
});

describe("dowód na granicy przewidywanej drogi", () => {
  it("gdy przewidywanie kończy się za wcześnie, wyjaśnia kolejny rzeczywisty krok", () => {
    const f = assess(
      { path: ["PC1"], stop: "PC1", reason: "gateway" },
      simulate(initialNetwork(), probe()),
    );
    expect(f.evidence.code).toBe("L2_FORWARD");
    expect(f.mismatch).toContain("koniec drogi");
    expect(f.mismatch).toContain(f.evidence.detail);
  });
  it("gdy przewidywanie idzie dalej niż pakiet, wskazuje decyzję zatrzymującą", () => {
    const f = assess(
      {
        path: ["PC1", "SW1", "R1", "SERVER"],
        stop: "delivered",
        reason: "delivered",
      },
      simulate(initialNetwork(), probe()),
    );
    expect(f.evidence.code).toBe("ACL_DENY");
    expect(f.evidence.ruleId).toBe("deny-subnets");
    expect(f.mismatch).toContain(f.evidence.detail);
  });
  it("błędne urządzenie początkowe wyjaśnia decyzją źródła, zachowując niezależną ocenę miejsca i przyczyny", () => {
    const f = assess(
      { path: ["SW1", "R1"], stop: "R1", reason: "acl" },
      simulate(initialNetwork(), probe()),
    );
    expect(f.evidence.code).toBe("HOST_ROUTE");
    expect(f.routeCorrect).toBe(false);
    expect(f.locationCorrect).toBe(true);
    expect(f.reasonCorrect).toBe(true);
  });
});
