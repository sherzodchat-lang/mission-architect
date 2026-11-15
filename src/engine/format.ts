// Number formatting shared by engine texts and UI.

import type { Mission } from '../data/types';

function trim(n: number, decimals: number): string {
  const s = n.toFixed(decimals);
  return decimals > 0 ? s.replace(/\.?0+$/, '') : s;
}

/** 1.2 → '$1.20M'. */
export function fmtMoney(m: number): string {
  const sign = m < 0 ? '−' : '';
  return `${sign}$${Math.abs(m).toFixed(2)}M`;
}

export function fmtKg(v: number, mission?: Mission): string {
  const d = mission ? mission.massDecimals : 2;
  return `${trim(v, d === 0 && Math.abs(v) < 10 ? 1 : d)} kg`;
}

export function fmtW(v: number): string {
  return `${trim(v, Math.abs(v) < 100 ? 1 : 0)} W`;
}

export function fmtGB(v: number): string {
  if (Math.abs(v) >= 1000) return `${trim(v / 1000, 2)} TB`;
  return `${trim(v, Math.abs(v) < 10 ? 2 : Math.abs(v) < 100 ? 1 : 0)} GB`;
}

export function fmtGBmo(v: number): string {
  return `${fmtGB(v)}/mo`;
}

export function fmtMonths(v: number): string {
  return `${trim(v, 1)} ${Math.abs(v) === 1 ? 'month' : 'months'}`;
}

export function fmtDv(v: number): string {
  return `${Math.round(v)} m/s`;
}

export function fmtPct(fraction: number, decimals = 0): string {
  return `${(fraction * 100).toFixed(decimals)}%`;
}

export { trim as fmtNumber };
