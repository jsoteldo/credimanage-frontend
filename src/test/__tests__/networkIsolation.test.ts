import { describe, it, expect } from 'vitest';

describe('Total Network Isolation Verification', () => {
  it('strictly blocks and throws on any unmocked fetch request to external backends', () => {
    expect(() => {
      fetch('https://credimanage-vdq7ahdckq-rj.a.run.app/api/clients');
    }).toThrow(/\[NETWORK ISOLATION VIOLATION\]/);
  });

  it('strictly blocks and throws on relative /api requests if unmocked', () => {
    expect(() => {
      fetch('/api/loans');
    }).toThrow(/\[NETWORK ISOLATION VIOLATION\]/);
  });
});
