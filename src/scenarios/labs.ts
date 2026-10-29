import { initialNetwork, probe } from "../network/scenario";
import type { Network } from "../network/model";
export const scenarioIds = ["acl", "gateway", "vlan"] as const;
export type ScenarioId = (typeof scenarioIds)[number];
export const labs = {
  acl: {
    title: "ACL · kolejność reguł",
    description:
      "Pakiet nie dociera. Prześledź decyzje filtra i zbadaj kolejność reguł.",
    time: "3 min",
    mission: "Dostarcz TCP/443 do serwera. Zachowaj blokadę TCP/22.",
    editor: "Zmień reguły",
    component: "R1 · FORWARD",
  },
  gateway: {
    title: "Gateway · następny skok",
    description:
      "Host nie dociera do zdalnej sieci. Zbadaj wybór i osiągalność bramy.",
    time: "4 min",
    mission: "Przywróć dostarczenie TCP/443. Zachowaj blokadę TCP/22.",
    editor: "Zmień bramę",
    component: "PC1 · IPv4",
  },
  vlan: {
    title: "VLAN · wspólna sieć L2",
    description:
      "Przewody są podłączone, ale komunikacja nie działa. Sprawdź porty switcha.",
    time: "4 min",
    mission: "Przywróć dostarczenie TCP/443. Zachowaj blokadę TCP/22.",
    editor: "Zmień VLAN portu",
    component: "SW1 · p2",
  },
} satisfies Record<
  ScenarioId,
  {
    title: string;
    description: string;
    time: string;
    mission: string;
    editor: string;
    component: string;
  }
>;
export function scenarioNetwork(id: ScenarioId): Network {
  const network = initialNetwork();
  if (id !== "acl") network.router.rules.reverse();
  if (id === "gateway") network.hosts[0].gateway = "192.168.20.1";
  if (id === "vlan") network.switch.ports[1].vlan = 20;
  return network;
}
export const scenarioProbe = probe;
