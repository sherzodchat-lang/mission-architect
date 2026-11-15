"""Parses the GMAT outputs in tools/gmat/output/<case>/ into src/data/nasa/gmat.json.

Run by tools/gmat/run_all.sh (or alone: python3 tools/gmat/parse.py). Pure Python, no GMAT needed to re-parse.
"""
import datetime as dt
import json
import math
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT_JSON = os.path.join(ROOT, 'src', 'data', 'nasa', 'gmat.json')
CASES = json.load(open(os.path.join(HERE, 'scripts', 'cases.json')))
STATION_IDS = {'Wallops': 'wal', 'Santiago': 'san', 'Fairbanks': 'fai', 'Svalbard': 'sva',
               'Goldstone': 'gold', 'Madrid': 'madrid', 'Canberra': 'canb'}
GM = {'Earth': 398600.4415, 'Moon': 4902.8005, 'Mars': 42828.314}
R = {'Earth': 6378.1363, 'Moon': 1738.2, 'Mars': 3396.19}

DATE = re.compile(r'(\d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2}\.\d{3})')


def t(s):
    return dt.datetime.strptime(s, '%d %b %Y %H:%M:%S.%f')


def path(case, kind):
    return os.path.join(HERE, 'output', case, f'{case}_{kind}.txt')


def rows(case):
    p = path(case, 'report')
    return [[float(x) for x in ln.split()] for ln in open(p) if ln.strip()] if os.path.exists(p) else []


def contacts(case):
    """{station: [(start, stop), ...]} from a ContactLocator 'Legacy' report."""
    out, cur = {}, None
    for ln in open(path(case, 'contacts')):
        m = re.match(r'\s*Observer:\s*(\S+)', ln)
        if m:
            cur = m.group(1)
            out[cur] = []
            continue
        d = DATE.findall(ln)
        if cur and len(d) == 2 and 'no ' not in ln.lower():
            out[cur].append((t(d[0]), t(d[1])))
    return out


def eclipses(case):
    """[(type, seconds)] from an EclipseLocator report."""
    ev = []
    for ln in open(path(case, 'eclipse')):
        d = DATE.findall(ln)
        if len(d) == 2 and 'no ' not in ln.lower():
            rest = ln.split(d[1])[1].split()
            ev.append((rest[2], float(rest[0])))
    return ev


def union_seconds(intervals):
    total, end = 0.0, None
    for a, b in sorted(intervals):
        if end is None or a > end:
            total += (b - a).total_seconds()
            end = b
        elif b > end:
            total += (b - end).total_seconds()
            end = b
    return total


def geom(case):
    meta = CASES[case]
    days = meta['days']
    span = days * 86400.0
    r = rows(case)
    ecl = eclipses(case)
    umbra = sum(s for k, s in ecl if k in ('Umbra', 'Antumbra'))
    pen = sum(s for k, s in ecl if k == 'Penumbra')
    shadow = (umbra + 0.5 * pen) / span
    n_ecl = sum(1 for k, _ in ecl if k in ('Umbra', 'Antumbra'))
    con = contacts(case)
    st = {}
    for name, iv in con.items():
        sec = sum((b - a).total_seconds() for a, b in iv)
        st[STATION_IDS.get(name, name)] = dict(
            name=name, passesPerDay=round(len(iv) / days, 2), minutesPerDay=round(sec / 60 / days, 1),
            meanPassMin=round(sec / 60 / len(iv), 1) if iv else 0, fractionOfTime=round(sec / span, 4))
    allv = union_seconds([x for iv in con.values() for x in iv])
    res = dict(meta, periodMin=round(r[0][0] / 60, 2) if r else None, shadowFraction=round(shadow, 4),
               sunFraction=round(1 - shadow, 4), umbraEventsPerDay=round(n_ecl / days, 2),
               maxUmbraMin=round(max([s for k, s in ecl if k == 'Umbra'] or [0]) / 60, 1),
               stations=st, anyStationFraction=round(allv / span, 4))
    return res


def decay(case):
    r = rows(case)
    meta = CASES[case]
    end = r[-1]
    reentered = end[1] < 151
    return dict(meta, lifetimeDays=round(end[0], 1) if reentered else None, reentered=reentered,
                lifetimeMonths=round(end[0] / 30.44, 1) if reentered else None,
                altitudeKmEvery10Days=[round(x[1], 1) for x in r])


def keep(case):
    """Natural evolution of a lunar orbit with no maneuvers -> station-keeping estimate."""
    r = rows(case)
    meta = CASES[case]
    mu = GM['Moon']
    a0 = r[0][6]
    v = math.sqrt(mu / a0)
    days = [x[0] for x in r]
    peri = [x[1] - R['Moon'] for x in r]
    ecc = [x[3] for x in r]
    out = dict(meta, initialPeriAltKm=round(peri[0], 1), minPeriAltKm=round(min(peri), 1),
               dayOfMinPeri=days[peri.index(min(peri))], propagatedDays=days[-1],
               impacted=peri[-1] < 6, periAltKmDaily=[round(p, 1) for p in peri])
    if meta['periAltKm'] == meta['apoAltKm']:
        # circular LLO: eccentricity grows from ~0; a maneuver pair every 28 d removes it.
        e28 = max(ecc[: min(len(ecc), 29)])
        dv_month = v * e28 / 2 * 1000   # tangential burns: |de| = 2 dv / v
        drop = (peri[0] - min(peri[: min(len(peri), 29)]))
        out.update(maxEcc28d=round(e28, 5), periDrop28dKm=round(drop, 1), circularSpeedKmS=round(v, 4),
                   stationKeepingDvPerMonthMS=round(dv_month, 1), stationKeepingDvPerYearMS=round(dv_month * 12, 0),
                   method='Δv = v·Δe/2 per 28-day cycle (tangential burns cancel the eccentricity GMAT predicts with the GRAIL GRGM900C 60x60 field)')
    else:
        # frozen orbit: how far does periapsis wander in a year?
        e = ecc
        out.update(eccRange=[round(min(e), 5), round(max(e), 5)], periAltRangeKm=[round(min(peri), 1), round(max(peri), 1)],
                   stationKeepingDvPerYearMS=round(v * (max(e) - min(e)) / 2 * 1000, 1),
                   method='Δv bound = v·(e_max − e_min)/2 per year: the burn that would hold eccentricity fixed')
    return out


def nrho(case):
    g = geom(case)
    r = rows(case)
    g['periodMin'] = None
    st = json.load(open(os.path.join(ROOT, 'tools', 'orbits', 'nrho_state.json')))
    g['periodDays'] = round(st['periodDays'], 3)
    g['perilunePerAltKmCR3BP'] = [round(x) for x in st['perilunePerAltKm']]
    g['apoluneRadiusKmCR3BP'] = round(st['apoluneRadiusKm'])
    # GMAT samples every 6 h (perilune passage is too quick to catch): range of the Moon distance in the ephemeris run
    g['moonDistanceKmSampled'] = [round(min(x[1] for x in r)), round(max(x[1] for x in r))] if r else None
    return g


def main():
    res = {}
    for case in CASES:
        if not os.path.isdir(os.path.join(HERE, 'output', case)):
            print('missing output:', case)
            continue
        try:
            if 'decay' in case:
                res[case] = decay(case)
            elif case.endswith('_keep'):
                res[case] = keep(case)
            elif 'nrho' in case:
                res[case] = nrho(case)
            else:
                res[case] = geom(case)
        except (OSError, IndexError, ValueError) as e:
            print('could not parse', case, e)
    ver_p = os.path.join(HERE, 'output', 'gmat_version.txt')
    version = open(ver_p).read().strip() if os.path.exists(ver_p) else ''
    doc = dict(
        meta=dict(tool='NASA General Mission Analysis Tool (GMAT) R2026a, GmatConsole (ubuntu-x64)',
                  gmatBuild=version, url='https://sourceforge.net/projects/gmat/files/GMAT/GMAT-R2026a/',
                  generatedBy='tools/gmat/run_all.sh (make_scripts.py -> GmatConsole -> parse.py)',
                  generatedAt=dt.date.today().isoformat(), epoch='2027-01-01T00:00:00 UTC (Mars: 2030-01-01)',
                  shadow='shadowFraction = (umbra + antumbra + 0.5 x penumbra) / propagated time (GMAT EclipseLocator)',
                  contacts='GMAT ContactLocator, Earth stations 5 deg elevation mask, DSN 10 deg; Moon/Mars cases include occultation by the Moon/Mars and light-time',
                  scripts={c: f'tools/gmat/scripts/{c}.script' for c in res}),
        cases=res)
    with open(OUT_JSON, 'w') as f:
        json.dump(doc, f, indent=1, ensure_ascii=False)
    print('wrote', OUT_JSON, 'with', len(res), 'cases')
    for c, v in res.items():
        keys = ('periodMin', 'sunFraction', 'anyStationFraction', 'lifetimeMonths', 'stationKeepingDvPerMonthMS',
                'stationKeepingDvPerYearMS', 'minPeriAltKm')
        print(c, {k: v[k] for k in keys if k in v and v[k] is not None},
              {s: x['minutesPerDay'] for s, x in v.get('stations', {}).items()})


if __name__ == '__main__':
    main()
