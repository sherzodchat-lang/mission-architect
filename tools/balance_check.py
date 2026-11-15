"""Reference balance check for Mission Architect.

Implements the formulas from GAME_DESIGN.md (sections 5-8) without random events,
enumerates every possible design of a mission and prints score statistics and the
best designs. All three missions share one engine; only the data differs.

Run: python3 tools/balance_check.py [earth|lunar|mars]   (no argument = all three)

Calibrated against NASA sources (see src/data/nasa/calibration.md): orbit sun fractions, contact units, battery
factors, LEO lifetime and lunar station keeping come from NASA GMAT R2026a runs (tools/gmat); battery masses, the UHF
data rate and the propulsion delta-v (rocket equation with SOA Isp) from the NASA SST State of the Art 2025 report.
Prices, budgets and instrument values are game balance. Keep these numbers identical to src/data/missions.ts.
"""
import collections
import itertools
import sys

# Instrument: kg, W, $M, months, GB/mo, value, quality at pointing (none, coarse, fine)
# Solar: kg, W in sunlight, $M, months          Battery: kg, Wh, $M
# Radio: kg, W, $M, months, GB/mo per contact unit, factor at pointing (none, coarse, fine)
# Computer: kg, W, $M, months, storage GB        Attitude: kg, W, $M, months, pointing level
# Propulsion: kg, $M, months, dv at reference mass, extra cruise steps
# Orbit: sun fraction, coverage, last operating step, battery factor k, dv insert, dv keep per step,
#        science delay steps, {station: contact units}
# Launcher: capacity kg, $M, wait months, orbits, coverage multiplier, transfer dv, cruise steps
# Test: $M, months, health penalty used by this deterministic check

EARTH = dict(
    name='earth', mass=5.0, budget=5.0, time=12, required=50, target=100,
    bus=(0.9, 1, 0.30), base_time=3, over_fee=0.15, over_allowed=True, step_months=1,
    solar_factor=1.0, ref_mass=None,
    ins={'imager': (1.5, 6, 1.2, 3, 8, 1.0, (0.2, 0.5, 1.0)),
         'thermal': (1.2, 5, 1.0, 2, 5, 1.1, (0.3, 0.7, 1.0)),
         'atmos': (0.8, 3, 0.6, 1, 2, 1.5, (0.8, 1.0, 1.0)),
         'spectro': (0.6, 4, 0.8, 2, 3, 1.4, (0.3, 0.8, 1.0))},
    sol={'body': (0.2, 8, 0.10, 0), 'deploy': (0.5, 20, 0.35, 1), 'track': (0.8, 30, 0.70, 2)},
    bat={'bat_s': (0.17, 20, 0.08), 'bat_m': (0.33, 40, 0.15), 'bat_l': (0.67, 80, 0.30)},
    rad={'uhf': (0.15, 1, 0.05, 0, 0.26, (1, 1, 1)), 'sband': (0.3, 2, 0.25, 1, 3, (0.7, 1, 1)),
         'xband': (0.6, 4, 0.60, 2, 9, (0.2, 0.6, 1.0))},
    obc={'obc_basic': (0.1, 1, 0.08, 0, 4), 'obc_std': (0.15, 2, 0.20, 0, 8),
         'obc_rad': (0.25, 3, 0.55, 1, 12)},
    adc={'mag': (0.05, 0, 0.02, 0, 0), 'torq': (0.2, 1, 0.15, 0, 1), 'wheel': (0.6, 3, 0.70, 1, 2)},
    prop={'none': (0, 0, 0, 0, 0)},
    # GMAT R2026a (src/data/nasa/gmat.json): sun fraction, contact units = minutes/day / 30, LEO lifetime 11 months
    orb={'leo': (0.66, 0.78, 11, 2, 0, 0, 0, {'wal': 1.36, 'san': 1.07, 'fai': 0.26, 'sva': 0}),
         'sso': (0.64, 1.0, 12, 2, 0, 0, 0, {'wal': 1.14, 'san': 1.09, 'fai': 2.66, 'sva': 3.92})},
    lv={'light': (3.0, 0.15, 0, ('leo',), 1.0, 0, 1),
        'medium': (6.0, 0.45, 1, ('leo', 'sso'), 1.0, 0, 1),
        'dedicated': (150, 1.5, 0, ('leo', 'sso'), 1.1, 0, 1)},
    gs={'wal': 0.15, 'san': 0.15, 'fai': 0.20, 'sva': 0.25},
    test={'test_min': (0, 0, 8), 'test_std': (0.15, 1, 3), 'test_full': (0.35, 2, 0)},
)

_DSN = {'gold': 1.0, 'madrid': 1.0, 'canb': 1.0}


def _dsn(factor, extra=None):
    d = {k: v * factor for k, v in _DSN.items()}
    if extra:
        d.update(extra)
    return d


LUNAR = dict(
    name='lunar', mass=250, budget=25.0, time=24, required=500, target=720,
    bus=(60, 20, 3.0), base_time=8, over_fee=0.6, over_allowed=True, step_months=1,
    solar_factor=1.0, ref_mass=200,
    ins={'cam': (35, 60, 4.0, 5, 60, 1.0, (0.2, 0.5, 1.0)),
         'altim': (18, 45, 3.0, 4, 9, 2.0, (0.3, 0.8, 1.0)),
         'mapper': (22, 40, 3.2, 4, 36, 1.2, (0.3, 0.7, 1.0)),
         'neutron': (10, 12, 1.8, 2, 3, 4.0, (1.0, 1.0, 1.0))},
    sol={'fixed': (12, 250, 0.8, 0), 'wings': (18, 450, 1.4, 1), 'track': (28, 750, 2.4, 2)},
    bat={'bat_s': (3.5, 300, 0.3), 'bat_m': (7, 600, 0.5), 'bat_l': (13, 1200, 0.9)},
    rad={'sband': (3, 15, 0.4, 1, 6, (1, 1, 1)), 'xband': (8, 35, 1.2, 2, 30, (0.6, 1, 1)),
         'kaband': (15, 60, 2.6, 3, 90, (0.1, 0.5, 1.0))},
    obc={'obc_std': (2, 10, 0.5, 0, 60), 'obc_rad': (4, 15, 1.4, 1, 120),
         'obc_mem': (6, 25, 2.2, 2, 300)},
    adc={'thr': (4, 5, 0.4, 0, 1), 'wheel': (12, 25, 1.5, 1, 2), 'wheel_red': (16, 35, 2.4, 2, 2)},
    prop={'mono_s': (45, 1.5, 2, 560, 0), 'mono_l': (80, 2.2, 2, 1090, 0),
          'biprop': (110, 3.6, 3, 2010, 0)},
    # GMAT R2026a: sun fraction, k = max eclipse h / 0.3 DoD, LLO keep 11.9 m/s/mo, frozen 1.8 m/s/mo,
    # DSN units = GMAT contact minutes/day / 480 (Moon occultation included); commercial dish = half a DSN unit
    orb={'llo': (0.72, 1.0, 12, 2.6, 900, 12, 0, _dsn(0.89, {'com': 0.45})),
         'frozen': (0.74, 0.7, 12, 2.6, 700, 1.8, 0, _dsn(0.90, {'com': 0.45})),
         'nrho': (1.0, 0.35, 12, 1.0, 450, 1, 0, _dsn(1.05, {'com': 0.53}))},
    lv={'gto': (300, 2.0, 2, ('llo', 'frozen', 'nrho'), 1.0, 700, 3),
        'lunar_share': (280, 4.0, 1, ('llo', 'frozen', 'nrho'), 1.0, 50, 1),
        'dedicated': (400, 8.0, 0, ('llo', 'frozen', 'nrho'), 1.1, 50, 1)},
    gs={'gold': 0.6, 'madrid': 0.6, 'canb': 0.6, 'com': 0.3},
    test={'test_min': (0, 0, 8), 'test_std': (0.8, 2, 3), 'test_full': (1.8, 4, 0)},
)

MARS = dict(
    name='mars', mass=600, budget=60.0, time=36, required=1200, target=2700,
    bus=(150, 40, 8.0), base_time=12, over_fee=0, over_allowed=False, step_months=2,
    solar_factor=0.43, ref_mass=500,
    ins={'cam': (30, 50, 5.0, 5, 90, 1.0, (0.2, 0.5, 1.0)),
         'tracegas': (35, 55, 7.0, 6, 30, 2.2, (0.4, 0.8, 1.0)),
         'radar': (45, 90, 8.0, 6, 60, 1.8, (0.6, 1.0, 1.0)),
         'fields': (8, 10, 2.5, 2, 4, 5.0, (1.0, 1.0, 1.0))},
    sol={'wings': (30, 900, 2.5, 1), 'large': (50, 1600, 4.0, 2), 'ultra': (70, 2400, 6.0, 3)},
    bat={'bat_s': (9, 800, 0.8), 'bat_m': (18, 1600, 1.4), 'bat_l': (33, 3000, 2.4)},
    rad={'x1': (12, 40, 1.5, 1, 10, (0.5, 1, 1)), 'x2': (20, 80, 3.0, 2, 35, (0.1, 0.6, 1.0)),
         'ka3': (30, 120, 4.5, 3, 90, (0.0, 0.3, 1.0))},
    obc={'obc_rad': (6, 20, 2.0, 0, 150), 'obc_mem': (9, 30, 3.5, 1, 400),
         'obc_auto': (10, 35, 5.0, 3, 400)},
    adc={'thr': (6, 8, 0.8, 0, 1), 'wheel': (15, 30, 2.0, 1, 2), 'wheel_red': (22, 40, 3.2, 2, 2)},
    prop={'mono_l': (120, 3.0, 2, 600, 0), 'biprop': (200, 6.0, 3, 1310, 0),
          'biprop_xl': (280, 8.0, 4, 2060, 0), 'sep': (110, 9.0, 5, 2640, 1)},
    # GMAT R2026a: sun fraction, k = max eclipse h / DoD (0.3 low orbit, 0.6 capture: few eclipses), DSN units = min/day / 480
    orb={'capture': (0.99, 0.5, 12, 2.0, 1000, 0, 0, _dsn(1.30)),
         'aerobrake': (0.76, 1.0, 12, 1.7, 1100, 0, 2, _dsn(1.09)),
         'direct': (0.76, 1.0, 12, 1.7, 2200, 0, 0, _dsn(1.09))},
    lv={'escape_share': (650, 14.0, 0, ('capture', 'aerobrake', 'direct'), 1.0, 100, 4),
        'gto': (700, 8.0, 0, ('capture', 'aerobrake', 'direct'), 1.0, 1500, 4),
        'dedicated': (900, 22.0, 0, ('capture', 'aerobrake', 'direct'), 1.1, 60, 4)},
    gs={'gold': 1.5, 'madrid': 1.5, 'canb': 1.5},
    test={'test_min': (0, 0, 8), 'test_std': (2.0, 3, 3), 'test_full': (4.0, 6, 0)},
)

MISSIONS = {'earth': EARTH, 'lunar': LUNAR, 'mars': MARS}


def margin_factor(m):
    if m < 0:
        return 0
    if m < 0.05:
        return 0.7
    if m <= 0.25:
        return 1.0
    if m <= 0.4:
        return 0.8
    return 0.5


def evaluate(M, ins, sol, bat, rad, obc, adc, prop, orb, lv, gs, test):
    """Returns None for a design that cannot launch, otherwise a tuple of results."""
    I, S, B, R, C, A, P = M['ins'], M['sol'][sol], M['bat'][bat], M['rad'][rad], M['obc'][obc], M['adc'][adc], M['prop'][prop]
    O, L, T = M['orb'][orb], M['lv'][lv], M['test'][test]
    mass = M['bus'][0] + sum(I[i][0] for i in ins) + S[0] + B[0] + R[0] + C[0] + A[0] + P[0]
    if orb not in L[3] or mass > L[0] or mass > M['mass']:
        return None
    time = (M['base_time'] + sum(I[i][3] for i in ins) + S[3] + R[3] + C[3] + A[3] + P[2] + L[2] + T[1])
    over = max(0, time - M['time'])
    if over and not M['over_allowed']:
        return None
    cost = (M['bus'][2] + sum(I[i][2] for i in ins) + S[2] + B[2] + R[2] + C[2] + A[2] + P[1] + L[1]
            + sum(M['gs'][g] for g in gs) + T[0] + M['over_fee'] * over)
    if cost > M['budget'] + 1e-9:
        return None
    sun, cov, last, k, dv_ins, dv_keep, delay, units = O
    cruise = L[6] + P[4]
    if M['ref_mass']:
        dv_have = P[3] * M['ref_mass'] / mass
        dv_need = L[5] + dv_ins + dv_keep * (last - cruise)
        if dv_have < dv_need:
            return None
    cov = min(1.1, cov * L[4])
    p = A[4]
    supply = S[1] * sun * M['solar_factor']
    base = M['bus'][1] + R[1] + C[1] + A[1]
    inst = sum(I[i][1] for i in ins)
    if supply < base:
        return None
    duty = min(1, (supply - base) / inst)
    demand = base + inst
    health = 100 - T[2]
    if B[1] < k * demand:
        duty *= sun
        health -= 10
    cap = R[4] * sum(units[g] for g in gs) * R[5][p]
    gen = sum(I[i][4] for i in ins) * duty * cov
    quality = sum(I[i][4] * I[i][5] * I[i][6][p] for i in ins) / sum(I[i][4] for i in ins)
    sci_steps = max(0, last - cruise - delay - 0.5)
    months = sci_steps * M['step_months']
    generated = gen * months
    returned = min(gen, cap) * months
    science = returned * quality
    if C[4] < 0.5 * gen:
        health -= 5
    s1 = 30 * min(1, science / M['target'])
    s2 = (5 * margin_factor((M['mass'] - mass) / M['mass']) + 7 * margin_factor((supply - demand) / supply)
          + 7 * margin_factor((M['budget'] - cost) / M['budget']) + 6 * margin_factor((M['time'] - time) / M['time']))
    s3 = 25 * (0.6 * health / 100 + 0.4 * last / 12)
    s4 = 20 * (returned / generated if generated else 0)
    total = s1 + s2 + s3 + s4 - 2 * over
    return total, science, returned, mass, cost, time, duty, cap, gen


def run(M):
    res = []
    gs_sets = [g for n in range(1, len(M['gs']) + 1) for g in itertools.combinations(M['gs'], n)]
    for n in (1, 2, 3):
        for ins in itertools.combinations(M['ins'], n):
            for combo in itertools.product(M['sol'], M['bat'], M['rad'], M['obc'], M['adc'], M['prop'],
                                           M['orb'], M['lv']):
                for gs in gs_sets:
                    for test in M['test']:
                        r = evaluate(M, ins, *combo, gs, test)
                        if r:
                            res.append((r, (ins,) + combo + (gs, test)))
    print(f"\n=== {M['name']}: feasible designs {len(res)}")
    if not res:
        return
    sci = sorted(x[0][1] for x in res)
    tot = sorted(x[0][0] for x in res)
    pct = lambda a, q: round(a[min(len(a) - 1, int(len(a) * q))], 1)
    print('science  p50/p90/p99/max', pct(sci, .5), pct(sci, .9), pct(sci, .99), round(sci[-1], 1))
    print('score    p10/p50/p90/p99/max', pct(tot, .1), pct(tot, .5), pct(tot, .9), pct(tot, .99), round(tot[-1], 1))
    ok = [x for x in res if x[0][2] >= M['required']]
    print('meets required data:', len(ok), 'designs,', round(100 * len(ok) / len(res), 2), '%',
          '| of them score >= 85:', sum(1 for x in ok if x[0][0] >= 85))
    res.sort(key=lambda x: -x[0][0])
    seen = set()
    for r, d in res:
        key = (d[0], d[3], d[6], d[7])
        if key in seen:
            continue
        seen.add(key)
        print(round(r[0], 1), 'sci', round(r[1]), 'ret', round(r[2]), 'kg', round(r[3], 2), '$', round(r[4], 2),
              'mo', r[5], 'duty', round(r[6], 2), 'cap', round(r[7], 1), 'gen', round(r[8], 1), d)
        if len(seen) >= 10:
            break
    top = res[:max(1, len(res) // 100)]
    names = ('ins', 'sol', 'bat', 'rad', 'obc', 'adc', 'prop', 'orb', 'lv', 'gs', 'test')
    for idx in (1, 2, 3, 4, 5, 6, 7, 8, 10):
        print(' top1%', names[idx], dict(collections.Counter(d[idx] for _, d in top)))
    print(' top1% ins', dict(collections.Counter(i for _, d in top for i in d[0])))
    print(' top1% stations', dict(collections.Counter(len(d[9]) for _, d in top)))


if __name__ == '__main__':
    which = sys.argv[1:] or list(MISSIONS)
    for name in which:
        run(MISSIONS[name])
