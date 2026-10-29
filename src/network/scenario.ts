import type { Network, Probe } from "./model";
export function initialNetwork(): Network {
  return {
    hosts: [
      {
        id: "PC1",
        interface: {
          id: "PC1:eth0",
          cidr: "192.168.10.10/24",
          mac: "02:00:00:00:10:10",
          up: true,
        },
        gateway: "192.168.10.1",
      },
      {
        id: "SERVER",
        interface: {
          id: "SERVER:eth0",
          cidr: "192.168.20.10/24",
          mac: "02:00:00:00:20:10",
          up: true,
        },
        gateway: "192.168.20.1",
      },
    ],
    switch: {
      id: "SW1",
      ports: [
        { id: "SW1:p1", vlan: 10, up: true },
        { id: "SW1:p2", vlan: 10, up: true },
      ],
    },
    router: {
      id: "R1",
      interfaces: [
        {
          id: "R1:lan",
          cidr: "192.168.10.1/24",
          mac: "02:00:00:00:10:01",
          up: true,
        },
        {
          id: "R1:server",
          cidr: "192.168.20.1/24",
          mac: "02:00:00:00:20:01",
          up: true,
        },
      ],
      rules: [
        {
          id: "deny-subnets",
          action: "deny",
          source: "192.168.10.0/24",
          destination: "192.168.20.0/24",
        },
        {
          id: "allow-443",
          action: "allow",
          source: "192.168.10.0/24",
          destination: "192.168.20.0/24",
          protocol: "tcp",
          destinationPort: 443,
        },
      ],
    },
    links: [
      { a: "PC1:eth0", b: "SW1:p1", up: true },
      { a: "SW1:p2", b: "R1:lan", up: true },
      { a: "R1:server", b: "SERVER:eth0", up: true },
    ],
  };
}
export const probe = (port = 443): Probe => ({
  source: "PC1",
  destination: "192.168.20.10",
  protocol: "tcp",
  destinationPort: port,
});
