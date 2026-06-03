/**
 * Expands a shorthand IPv6 address into its 8 component groups.
 */
export function expandIpv6(ip: string): string[] {
  let absoluteIp = ip;
  if (ip.includes('::')) {
    const parts = ip.split('::');
    const left = parts[0] ? parts[0].split(':') : [];
    const right = parts[1] ? parts[1].split(':') : [];
    const missingCount = 8 - (left.length + right.length);
    const middle = Array(missingCount).fill('0');
    absoluteIp = [...left, ...middle, ...right].join(':');
  }
  return absoluteIp.split(':');
}

/**
 * Anonymizes IPv4 and IPv6 addresses at ingestion.
 * - IPv4: Strips the last octet (e.g. 192.168.1.123 -> 192.168.1.0)
 * - IPv6: Strips the last 80 bits, keeping the first 48 bits prefix (e.g. 2001:db8:85a3::8a2e:370:7334 -> 2001:db8:85a3:0:0:0:0:0)
 */
export function anonymizeIp(ip: string): string {
  if (!ip) return '0.0.0.0';
  
  let cleanIp = ip.trim();

  // Strip IPv4 port if appended (e.g., "192.168.1.12:8080")
  if (cleanIp.includes('.') && cleanIp.includes(':')) {
    if (!cleanIp.startsWith('::ffff:')) {
      cleanIp = cleanIp.split(':')[0];
    }
  }

  // Handle IPv4-mapped IPv6 (e.g., "::ffff:192.168.1.123")
  if (cleanIp.startsWith('::ffff:')) {
    const ipv4Part = cleanIp.substring(7);
    const parts = ipv4Part.split('.');
    if (parts.length === 4) {
      return `::ffff:${parts[0]}.${parts[1]}.${parts[2]}.0`;
    }
  }

  // Handle Standard IPv4
  if (cleanIp.includes('.')) {
    const parts = cleanIp.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    }
    return '0.0.0.0';
  }

  // Handle IPv6
  if (cleanIp.includes(':')) {
    try {
      const groups = expandIpv6(cleanIp);
      if (groups.length === 8) {
        // Keep first 3 groups (48 bits prefix), zero out the remaining 5 groups (80 bits)
        return `${groups[0]}:${groups[1]}:${groups[2]}:0:0:0:0:0`;
      }
    } catch (e) {
      // Fall through to fallback
    }
    return '::';
  }

  return '0.0.0.0';
}
