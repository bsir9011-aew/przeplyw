export type DeviceId = "PC1" | "SW1" | "R1" | "SERVER";
export const deviceIds: DeviceId[] = ["PC1", "SW1", "R1", "SERVER"];
export type Interface = { id: string; cidr: string; mac: string; up: boolean };
export type Host = {
  id: "PC1" | "SERVER";
  interface: Interface;
  gateway?: string;
};
export type Rule = {
  id: string;
  action: "allow" | "deny";
  source: string;
  destination: string;
  protocol?: "tcp";
  destinationPort?: number;
};
export type Network = {
  hosts: Host[];
  switch: { id: "SW1"; ports: { id: string; vlan: number; up: boolean }[] };
  router: { id: "R1"; interfaces: Interface[]; rules: Rule[] };
  links: { a: string; b: string; up: boolean }[];
};
export type Probe = {
  source: "PC1" | "SERVER";
  destination: string;
  protocol: "tcp";
  destinationPort: number;
};
export type Reason = "delivered" | "acl" | "gateway" | "l2" | "route";
export type TraceStep = {
  device: DeviceId;
  code: string;
  title: string;
  detail: string;
  ruleId?: string;
  frame?: {
    sourceMac: string;
    destinationMac: string;
    sourceIp: string;
    destinationIp: string;
  };
};
export type Result = {
  status: "delivered" | "dropped";
  reason: Reason;
  path: DeviceId[];
  trace: TraceStep[];
};
