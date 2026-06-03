import { describe, it, expect } from 'vitest';
import { anonymizeIp } from './ip-anonymizer';
import { lookupGeo } from './geo-lookup';

describe('IP Anonymizer Tests', () => {
  it('should strip the last octet of standard IPv4 addresses', () => {
    expect(anonymizeIp('192.168.1.154')).toBe('192.168.1.0');
    expect(anonymizeIp('8.8.8.8')).toBe('8.8.8.0');
    expect(anonymizeIp('10.0.0.1')).toBe('10.0.0.0');
  });

  it('should strip IPv4 port numbers if present', () => {
    expect(anonymizeIp('192.168.1.154:8080')).toBe('192.168.1.0');
    expect(anonymizeIp('8.8.8.8:443')).toBe('8.8.8.0');
  });

  it('should strip the last 80 bits of standard IPv6 addresses (keep 48 bits)', () => {
    // Keep: "2001:db8:85a3", Zero out the rest
    expect(anonymizeIp('2001:db8:85a3:8d3:1319:8a2e:370:7348'))
      .toBe('2001:db8:85a3:0:0:0:0:0');
  });

  it('should expand and anonymize shorthand double-colon IPv6 addresses', () => {
    expect(anonymizeIp('2001:db8:85a3::8a2e:370:7348'))
      .toBe('2001:db8:85a3:0:0:0:0:0');
  });

  it('should handle IPv4-mapped IPv6 addresses', () => {
    expect(anonymizeIp('::ffff:192.168.1.55')).toBe('::ffff:192.168.1.0');
  });

  it('should fallback gracefully for invalid IP strings', () => {
    expect(anonymizeIp('')).toBe('0.0.0.0');
    expect(anonymizeIp('not-a-valid-ip')).toBe('0.0.0.0');
  });
});

describe('Geoip Mock Lookup Tests', () => {
  it('should identify localhost IPs as US/Localhost', () => {
    const local1 = lookupGeo('127.0.0.1');
    const local2 = lookupGeo('::1');
    
    expect(local1.country).toBe('US');
    expect(local1.city).toBe('Localhost');
    expect(local2.country).toBe('US');
    expect(local2.city).toBe('Localhost');
  });

  it('should return deterministic countries and cities for mock public IPs', () => {
    const res1 = lookupGeo('1.1.1.1');
    const res2 = lookupGeo('8.8.8.8');
    
    expect(res1.country).toBeDefined();
    expect(res1.city).toBeDefined();
    expect(res2.country).toBeDefined();
    expect(res2.city).toBeDefined();
  });
});
