import type {
  DeviceId,
  Network,
  Probe,
  Reason,
  Result,
  Rule,
  TraceStep,
} from "./model";
import { inSubnet, nextHop, parseCidr } from "./ipv4";

export function matchingRule(
  rules: Rule[],
  source: string,
  p: Probe,
): Rule | undefined {
  return rules.find(
    (r) =>
      inSubnet(source, r.source) &&
      inSubnet(p.destination, r.destination) &&
      (!r.protocol || r.protocol === p.protocol) &&
      (r.destinationPort === undefined ||
        r.destinationPort === p.destinationPort),
  );
}
// Logical neighbor reachability. No ARP frames, MAC learning, flooding or routing inside L2.
function l2Path(n: Network, from: string, to: string): string[] | undefined {
  const active = (id: string) =>
    [
      ...n.hosts.map((h) => h.interface),
      ...n.router.interfaces,
      ...n.switch.ports,
    ].find((i) => i.id === id)?.up;
  const queue: string[][] = [[from]];
  const seen = new Set<string>();
  while (queue.length) {
    const path = queue.shift()!;
    const at = path[path.length - 1];
    if (!active(at) || seen.has(at)) continue;
    seen.add(at);
    if (at === to) return path;
    const neighbors = n.links
      .filter((l) => l.up && (l.a === at || l.b === at))
      .map((l) => (l.a === at ? l.b : l.a));
    const port = n.switch.ports.find((p) => p.id === at);
    if (port)
      neighbors.push(
        ...n.switch.ports
          .filter((p) => p.id !== at && p.vlan === port.vlan)
          .map((p) => p.id),
      );
    for (const other of neighbors)
      if (!seen.has(other)) queue.push([...path, other]);
  }
}
export function simulate(n: Network, p: Probe): Result {
  const trace: TraceStep[] = [];
  const path: DeviceId[] = [];
  const step = (s: TraceStep) => {
    trace.push(s);
    if (path[path.length - 1] !== s.device) path.push(s.device);
  };
  const stop = (
    device: DeviceId,
    reason: Reason,
    code: string,
    detail: string,
  ): Result => {
    step({ device, code, title: "Pakiet zatrzymany", detail });
    return { status: "dropped", reason, path, trace };
  };
  const host = n.hosts.find((h) => h.id === p.source)!;
  const sourceIp = parseCidr(host.interface.cidr).address;
  const hop = nextHop(host.interface.cidr, p.destination, host.gateway);
  step({
    device: host.id,
    code: "HOST_ROUTE",
    title: "Host wybiera następny skok",
    detail: inSubnet(p.destination, host.interface.cidr)
      ? `Cel lokalny. Następny skok: ${p.destination}.`
      : `Cel poza ${host.interface.cidr}. Brama: ${hop ?? "brak"}.`,
  });
  if (!hop || !inSubnet(hop, host.interface.cidr))
    return stop(
      host.id,
      "gateway",
      "NO_GATEWAY",
      "Brak bramy w lokalnej podsieci hosta.",
    );
  const interfaces = [
    ...n.hosts.map((h) => h.interface),
    ...n.router.interfaces,
  ];
  const neighbor = interfaces.find(
    (i) =>
      parseCidr(i.cidr).address === hop && l2Path(n, host.interface.id, i.id),
  );
  if (!neighbor)
    return stop(
      host.id,
      "l2",
      "NEIGHBOR_UNREACHABLE",
      `Nie można osiągnąć sąsiada ${hop} w lokalnej sieci L2. Sprawdź łącza, porty i VLAN.`,
    );
  const firstPath = l2Path(n, host.interface.id, neighbor.id)!;
  if (firstPath.some((id) => id.startsWith("SW1:")))
    step({
      device: "SW1",
      code: "L2_FORWARD",
      title: "Switch przekazuje ramkę",
      detail:
        "Aktywne porty access należą do tego samego VLAN. Switch nie zmienia adresów IP ani MAC.",
      frame: {
        sourceMac: host.interface.mac,
        destinationMac: neighbor.mac,
        sourceIp,
        destinationIp: p.destination,
      },
    });
  if (hop !== p.destination) {
    if (!n.router.interfaces.some((i) => i.id === neighbor.id))
      return stop(
        host.id,
        "route",
        "NOT_ROUTER",
        "Wybrany następny skok nie jest routerem.",
      );
    step({
      device: "R1",
      code: "ROUTE_LOOKUP",
      title: "Router wybiera sieć docelową",
      detail: `Wyszukiwanie trasy do ${p.destination} w sieciach bezpośrednio podłączonych.`,
    });
    const out = [...n.router.interfaces]
      .filter((i) => i.up && inSubnet(p.destination, i.cidr))
      .sort((a, b) => parseCidr(b.cidr).prefix - parseCidr(a.cidr).prefix)[0];
    if (!out)
      return stop("R1", "route", "NO_ROUTE", "Brak trasy do sieci docelowej.");
    const rule = matchingRule(n.router.rules, sourceIp, p);
    step({
      device: "R1",
      code: rule?.action === "allow" ? "ACL_ALLOW" : "ACL_DENY",
      title:
        rule?.action === "allow"
          ? "ACL dopuszcza pakiet"
          : "ACL odrzuca pakiet",
      detail: rule
        ? `Pierwsze dopasowanie: ${rule.id} (${rule.action.toUpperCase()}). Kolejne reguły nie są sprawdzane.`
        : "Brak dopasowania. Obowiązuje domyślne DENY.",
      ruleId: rule?.id,
    });
    if (rule?.action !== "allow")
      return { status: "dropped", reason: "acl", path, trace };
    const target = n.hosts.find(
      (h) =>
        parseCidr(h.interface.cidr).address === p.destination &&
        l2Path(n, out.id, h.interface.id),
    );
    if (!target)
      return stop(
        "R1",
        "l2",
        "NEIGHBOR_UNREACHABLE",
        "Adres docelowy nie jest osiągalny na wybranym interfejsie L2.",
      );
    step({
      device: "R1",
      code: "REFRAME",
      title: "Nowy odcinek, nowa ramka",
      detail: `Wyjście: ${out.id}. Nowe adresy MAC, te same adresy IP.`,
      frame: {
        sourceMac: out.mac,
        destinationMac: target.interface.mac,
        sourceIp,
        destinationIp: p.destination,
      },
    });
    const secondPath = l2Path(n, out.id, target.interface.id)!;
    if (secondPath.some((id) => id.startsWith("SW1:")))
      step({
        device: "SW1",
        code: "L2_FORWARD",
        title: "Switch przekazuje ramkę",
        detail: "Przekazanie we wspólnej domenie VLAN.",
      });
    step({
      device: target.id,
      code: "DELIVERED",
      title: "Pakiet dostarczony",
      detail: `TCP/${p.destinationPort} dotarł do ${p.destination}. To nie jest test pełnego połączenia ani usługi.`,
    });
  } else {
    const target = n.hosts.find((h) => h.interface.id === neighbor.id);
    if (!target)
      return stop(
        host.id,
        "route",
        "UNSUPPORTED_TARGET",
        "Ta próba dotyczy dostarczenia do hosta końcowego.",
      );
    step({
      device: target.id,
      code: "DELIVERED",
      title: "Pakiet dostarczony lokalnie",
      detail: "Cel osiągnięto bez routingu.",
    });
  }
  return { status: "delivered", reason: "delivered", path, trace };
}
