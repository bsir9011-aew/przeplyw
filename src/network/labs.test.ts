import { expect, it } from "vitest";
import { scenarioNetwork, scenarioProbe } from "../scenarios/labs";
import { simulate } from "./simulate";
import { assess } from "../assessment/feedback";
it("odróżnia bramę poza podsiecią od nieosiągalnej bramy o lokalnym adresie", () => {
  const n = scenarioNetwork("gateway");
  const outside = simulate(n, scenarioProbe());
  expect(outside.trace.at(-1)?.code).toBe("GATEWAY_OUTSIDE_SUBNET");
  expect(outside.reason).toBe("gateway");
  n.hosts[0].gateway = "192.168.10.254";
  const local = simulate(n, scenarioProbe());
  expect(local.trace.at(-1)?.code).toBe("GATEWAY_UNREACHABLE");
  expect(local.trace.at(-1)?.detail).toContain("lokalny adres");
  n.hosts[0].gateway = "192.168.10.1";
  expect(simulate(n, scenarioProbe()).status).toBe("delivered");
  expect(simulate(n, scenarioProbe(22)).status).toBe("dropped");
});
it("oblicza izolację VLAN i naprawę tylko portu p2, bez zmiany reguł routera", () => {
  const n = scenarioNetwork("vlan");
  const rules = structuredClone(n.router.rules);
  const fail = simulate(n, scenarioProbe());
  expect(fail.status).toBe("dropped");
  expect(fail.reason).toBe("l2");
  expect(fail.trace.at(-1)?.detail).toContain("SW1:p2: VLAN 20");
  const f = assess(
    {
      path: ["PC1", "SW1", "R1", "SERVER"],
      stop: "delivered",
      reason: "delivered",
    },
    fail,
  );
  expect(f.evidence.code).toBe("NEIGHBOR_UNREACHABLE");
  n.switch.ports[1].vlan = 10;
  expect(simulate(n, scenarioProbe()).status).toBe("delivered");
  expect(simulate(n, scenarioProbe(22)).status).toBe("dropped");
  expect(n.router.rules).toEqual(rules);
});
it("nie naprawia VLAN zmianą samej bramy ani ACL zmianą portu", () => {
  const vlan = scenarioNetwork("vlan");
  vlan.hosts[0].gateway = "192.168.10.1";
  expect(simulate(vlan, scenarioProbe()).reason).toBe("l2");
  const acl = scenarioNetwork("acl");
  acl.switch.ports[1].vlan = 10;
  expect(simulate(acl, scenarioProbe()).reason).toBe("acl");
});
