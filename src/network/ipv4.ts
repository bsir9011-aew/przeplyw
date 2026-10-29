export function ipv4(value: string): number {
  const parts = value.split(".");
  if (
    parts.length !== 4 ||
    parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255)
  )
    throw new Error(`Niepoprawny IPv4: ${value}`);
  return parts.reduce((n, p) => n * 256 + Number(p), 0);
}
export function parseCidr(cidr: string) {
  const [address, prefixText, extra] = cidr.split("/");
  if (extra !== undefined || !/^(\d|[12]\d|3[0-2])$/.test(prefixText ?? ""))
    throw new Error(`Niepoprawny prefiks: ${cidr}`);
  return { address, value: ipv4(address), prefix: Number(prefixText) };
}
export function inSubnet(ip: string, cidr: string): boolean {
  const { value, prefix } = parseCidr(cidr);
  const size = 2 ** (32 - prefix);
  return Math.floor(ipv4(ip) / size) === Math.floor(value / size);
}
export function nextHop(
  cidr: string,
  destination: string,
  gateway?: string,
): string | undefined {
  return inSubnet(destination, cidr) ? destination : gateway;
}
