"""Generates the NASA GMAT scripts used to ground the game's orbit numbers.

Run:  python3 tools/gmat/make_scripts.py        (writes tools/gmat/scripts/*.script)
Then: tools/gmat/run_all.sh                       (runs GmatConsole on each, parses -> src/data/nasa/gmat.json)

Every game orbit gets a GMAT script. Output file names are relative, so GMAT writes them into its own
output directory; run_all.sh moves them to tools/gmat/output/<case>/.

Cases
  earth_leo400_geom   400 km / 51.6 deg, 365 d, JGM-3 8x8 + Sun/Moon + SRP: period, eclipse, contacts
  earth_sso600_geom   600 km SSO, LTAN 10:30, 365 d: period, eclipse, contacts
  earth_leo400_decay_* 400 km decay of a 3U CubeSat with MSISE-90 + MSFC Schatten solar-flux predictions
  lunar_llo100_keep   100 km polar LLO, GRGM900C (GRAIL) 60x60 + Earth/Sun, 90 d: eccentricity growth -> station keeping
  lunar_llo100_geom   same orbit, 365 d: eclipse fraction, DSN contacts (Moon occults Earth)
  lunar_frozen_keep   30 x 200 km, 86 deg, periapsis over the south pole (LRO-like quasi-frozen), 365 d
  lunar_frozen_geom   eclipse fraction, DSN contacts
  lunar_nrho_geom     L2 southern 9:2 NRHO (CR3BP initial state from tools/orbits/nrho.py), 2 revolutions
  mars_capture_geom   300 x 45,000 km, 75 deg (MRO-like capture ellipse), 180 d
  mars_low300_geom    300 km, 93 deg (MRO-like science orbit), 180 d
"""
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'scripts')

R_EARTH, R_MOON, R_MARS = 6378.1363, 1738.2, 3396.19   # GMAT default equatorial radii, km

EARTH_STATIONS = {
    # id: (name, lat deg, east lon deg, alt km) - NASA Near Space Network / partner sites
    'wal': ('Wallops', 37.9249, 284.5235, 0.0),
    'san': ('Santiago', -33.1511, 289.3341, 0.7),
    'fai': ('Fairbanks', 64.8587, 212.1384, 0.2),
    'sva': ('Svalbard', 78.2297, 15.4078, 0.5),
}
DSN_STATIONS = {
    # 70 m antennas: DSS-14, DSS-63, DSS-43
    'gold': ('Goldstone', 35.4259, 243.1105, 1.002),
    'madrid': ('Madrid', 40.4313, 355.7520, 0.865),
    'canb': ('Canberra', -35.4024, 148.9813, 0.689),
}
EARTH_MASK_DEG = 5.0     # typical NEN low-elevation mask
DSN_MASK_DEG = 10.0      # DSN operational elevation limit

EPOCH = '01 Jan 2027 00:00:00.000'
EPOCH_MARS = '01 Jan 2030 00:00:00.000'


def sun_ra_deg(year, month, day):
    """Low-precision apparent right ascension of the Sun (Astronomical Almanac), deg."""
    a = (14 - month) // 12
    y, m = year + 4800 - a, month + 12 * a - 3
    jd = day + (153 * m + 2) // 5 + 365 * y + y // 4 - y // 100 + y // 400 - 32045 - 0.5
    n = jd - 2451545.0
    L = math.radians((280.460 + 0.9856474 * n) % 360)
    g = math.radians((357.528 + 0.9856003 * n) % 360)
    lam = L + math.radians(1.915) * math.sin(g) + math.radians(0.020) * math.sin(2 * g)
    eps = math.radians(23.439 - 0.0000004 * n)
    return math.degrees(math.atan2(math.cos(eps) * math.sin(lam), math.cos(lam))) % 360


def sso_inclination(a_km):
    """Sun-synchronous inclination from the J2 nodal rate (circular orbit)."""
    J2, mu, Re = 1.08262668e-3, 398600.4415, R_EARTH
    n_sun = 2 * math.pi / (365.2422 * 86400)
    n = math.sqrt(mu / a_km ** 3)
    cos_i = -n_sun / (1.5 * J2 * (Re / a_km) ** 2 * n)
    return math.degrees(math.acos(cos_i))


def lines(*items):
    out = []
    for it in items:
        if isinstance(it, (list, tuple)):
            out += lines(*it)
        else:
            out.append(it)
    return out


def spacecraft(cs, epoch, sma, ecc, inc, raan, aop, ta, mass=4.0, area=0.03, cd=2.2):
    return [
        'Create Spacecraft Sat;',
        "Sat.DateFormat = UTCGregorian;",
        f"Sat.Epoch = '{epoch}';",
        f'Sat.CoordinateSystem = {cs};',
        'Sat.DisplayStateType = Keplerian;',
        f'Sat.SMA = {sma:.6f};', f'Sat.ECC = {ecc:.8f};', f'Sat.INC = {inc:.6f};',
        f'Sat.RAAN = {raan:.6f};', f'Sat.AOP = {aop:.6f};', f'Sat.TA = {ta:.6f};',
        f'Sat.DryMass = {mass};', f'Sat.Cd = {cd};', f'Sat.DragArea = {area};',
        f'Sat.SRPArea = {area};', 'Sat.Cr = 1.5;',
    ]


def body_cs(name, body):
    return [f'Create CoordinateSystem {name};', f'{name}.Origin = {body};', f'{name}.Axes = BodyInertial;']


def force_model(central, potential, degree, points, srp=False, drag=None):
    fm = ['Create ForceModel FM;', f'FM.CentralBody = {central};']
    if potential:
        fm += [f'FM.PrimaryBodies = {{{central}}};',
               f'FM.GravityField.{central}.Degree = {degree};', f'FM.GravityField.{central}.Order = {degree};',
               f"FM.GravityField.{central}.PotentialFile = '{potential}';"]
    else:
        fm += [f'FM.PointMasses = {{{", ".join([central] + points)}}};']
        points = []
    if points:
        fm.append(f'FM.PointMasses = {{{", ".join(points)}}};')
    fm.append(f'FM.SRP = {"On" if srp else "Off"};')
    if drag:
        fm += ['FM.Drag.AtmosphereModel = MSISE90;',
               "FM.Drag.HistoricWeatherSource = 'CSSISpaceWeatherFile';",
               "FM.Drag.PredictedWeatherSource = 'SchattenFile';",
               f"FM.Drag.SchattenErrorModel = '{drag['error']}';",
               f"FM.Drag.SchattenTimingModel = '{drag['timing']}';"]
    fm += ['Create Propagator Prop;', 'Prop.FM = FM;', 'Prop.Type = RungeKutta89;', 'Prop.InitialStepSize = 60;',
           'Prop.Accuracy = 1e-11;', 'Prop.MinStep = 0.001;', 'Prop.MaxStep = 600;', 'Prop.MaxStepAttempts = 50;']
    return fm


def stations(st, central, mask):
    out = []
    for sid, (name, lat, lon, alt) in st.items():
        out += [f'Create GroundStation {name};', f'{name}.CentralBody = {central};', f'{name}.StateType = Spherical;',
                f'{name}.HorizonReference = Ellipsoid;', f'{name}.Location1 = {lat};', f'{name}.Location2 = {lon};',
                f'{name}.Location3 = {alt};', f'{name}.MinimumElevationAngle = {mask};']
    return out


def locators(case, st, occulting_contact, occulting_eclipse, light_time):
    names = ', '.join(v[0] for v in st.values())
    return [
        'Create ContactLocator CL;', 'CL.Target = Sat;', f'CL.Observers = {{{names}}};',
        f"CL.Filename = '{case}_contacts.txt';", f'CL.OccultingBodies = {{{", ".join(occulting_contact)}}};',
        f'CL.UseLightTimeDelay = {"true" if light_time else "false"};', 'CL.UseStellarAberration = false;',
        'CL.RunMode = Automatic;', 'CL.UseEntireInterval = true;',
        'Create EclipseLocator EL;', 'EL.Spacecraft = Sat;', f'EL.OccultingBodies = {{{", ".join(occulting_eclipse)}}};',
        f"EL.Filename = '{case}_eclipse.txt';", "EL.EclipseTypes = {'Umbra', 'Penumbra', 'Antumbra'};",
        'EL.RunMode = Automatic;', 'EL.UseEntireInterval = true;',
    ]


def report(case, fields):
    return ['Create ReportFile RF;', f"RF.Filename = '{case}_report.txt';", 'RF.WriteHeaders = false;',
            'RF.Precision = 12;']


def write(case, body, meta):
    os.makedirs(OUT, exist_ok=True)
    head = [f'% Mission Architect - GMAT case {case}', '% Generated by tools/gmat/make_scripts.py - do not edit by hand.',
            '% ' + meta['what'], '']
    with open(os.path.join(OUT, case + '.script'), 'w') as f:
        f.write('\n'.join(head + body) + '\n')
    CASES[case] = meta


CASES = {}


def earth_geom(case, alt, inc, raan, what, days=365):
    a = R_EARTH + alt
    body = lines(
        spacecraft('EarthMJ2000Eq', EPOCH, a, 0.0005, inc, raan, 0, 0),
        force_model('Earth', 'JGM3.cof', 8, ['Sun', 'Luna'], srp=True),
        stations(EARTH_STATIONS, 'Earth', EARTH_MASK_DEG),
        locators(case, EARTH_STATIONS, ['Earth'], ['Earth', 'Luna'], False),
        report(case, None),
        'BeginMissionSequence;',
        "Report RF Sat.Earth.OrbitPeriod Sat.Earth.SMA Sat.EarthMJ2000Eq.INC Sat.EarthMJ2000Eq.RAAN;",
        f'Propagate Prop(Sat) {{Sat.ElapsedDays = {days}}};',
        "Report RF Sat.Earth.OrbitPeriod Sat.Earth.SMA Sat.EarthMJ2000Eq.INC Sat.EarthMJ2000Eq.RAAN;",
    )
    write(case, body, dict(what=what, body='Earth', altKm=alt, inc=inc, raan=raan, days=days, epoch=EPOCH,
                           stationIds=list(EARTH_STATIONS), maskDeg=EARTH_MASK_DEG,
                           forceModel='JGM-3 8x8, Sun + Moon point masses, SRP'))


def earth_decay(case, mass, area, error, timing, what):
    a = R_EARTH + 400
    body = lines(
        spacecraft('EarthMJ2000Eq', EPOCH, a, 0.0005, 51.6, 0, 0, 0, mass=mass, area=area),
        force_model('Earth', 'JGM3.cof', 4, ['Sun', 'Luna'], drag=dict(error=error, timing=timing)),
        report(case, None),
        'Create Variable k;',
        'BeginMissionSequence;',
        'Report RF Sat.ElapsedDays Sat.Earth.Altitude Sat.Earth.SMA;',
        'While Sat.Earth.Altitude > 151 & Sat.ElapsedDays < 2000',
        '   Propagate Prop(Sat) {Sat.ElapsedDays = 10, Sat.Earth.Altitude = 150};',
        '   Report RF Sat.ElapsedDays Sat.Earth.Altitude Sat.Earth.SMA;',
        'EndWhile;',
    )
    write(case, body, dict(what=what, body='Earth', altKm=400, inc=51.6, epoch=EPOCH, massKg=mass, dragAreaM2=area,
                           cd=2.2, atmosphere='MSISE-90', flux=f'MSFC Schatten predictions, {error} error, {timing} timing',
                           stopAltKm=150, forceModel='JGM-3 4x4, Sun + Moon, MSISE-90 drag'))


def lunar(case, rp_alt, ra_alt, inc, aop, days, keep, what):
    rp, ra = R_MOON + rp_alt, R_MOON + ra_alt
    a, e = (rp + ra) / 2, (ra - rp) / (ra + rp)
    sc = spacecraft('LunaInertial', EPOCH, a, max(e, 1e-6), inc, 0, aop, 0)
    if keep:
        body = lines(
            body_cs('LunaInertial', 'Luna'), sc,
            force_model('Luna', 'grgm900c.cof', 60, ['Earth', 'Sun']),
            report(case, None), 'Create Variable k;',
            'BeginMissionSequence;',
            'Report RF Sat.ElapsedDays Sat.Luna.RadPer Sat.Luna.RadApo Sat.Luna.ECC Sat.LunaInertial.AOP Sat.LunaInertial.INC Sat.Luna.SMA;',
            f'While Sat.Luna.RadPer > {R_MOON + 5} & Sat.ElapsedDays < {days - 0.5}',
            '   Propagate Prop(Sat) {Sat.ElapsedDays = 1};',
            '   Report RF Sat.ElapsedDays Sat.Luna.RadPer Sat.Luna.RadApo Sat.Luna.ECC Sat.LunaInertial.AOP Sat.LunaInertial.INC Sat.Luna.SMA;',
            'EndWhile;',
        )
        fm = 'GRGM900C (GRAIL) 60x60, Earth + Sun point masses'
    else:
        body = lines(
            body_cs('LunaInertial', 'Luna'), sc,
            force_model('Luna', 'grgm900c.cof', 4, ['Earth', 'Sun']),
            stations(DSN_STATIONS, 'Earth', DSN_MASK_DEG),
            locators(case, DSN_STATIONS, ['Earth', 'Luna'], ['Earth', 'Luna'], True),
            report(case, None),
            'BeginMissionSequence;',
            'Report RF Sat.Luna.OrbitPeriod Sat.Luna.SMA Sat.Luna.ECC;',
            f'Propagate Prop(Sat) {{Sat.ElapsedDays = {days}}};',
            'Report RF Sat.Luna.OrbitPeriod Sat.Luna.SMA Sat.Luna.ECC;',
        )
        fm = 'GRGM900C 4x4 (geometry run; orbit plane and shape held), Earth + Sun point masses'
    write(case, body, dict(what=what, body='Moon', periAltKm=rp_alt, apoAltKm=ra_alt, inc=inc, aop=aop, days=days,
                           epoch=EPOCH, stationIds=list(DSN_STATIONS), maskDeg=DSN_MASK_DEG, forceModel=fm))


def nrho(case, state, days, what):
    """state: Earth-Moon rotating frame, Moon-centred, km and km/s (from tools/orbits/nrho.py)."""
    x, y, z, vx, vy, vz = state
    body = lines(
        'Create CoordinateSystem EMRot;', 'EMRot.Origin = Luna;', 'EMRot.Axes = ObjectReferenced;',
        'EMRot.XAxis = R;', 'EMRot.ZAxis = N;', 'EMRot.Primary = Earth;', 'EMRot.Secondary = Luna;',
        'Create Spacecraft Sat;', "Sat.DateFormat = UTCGregorian;", f"Sat.Epoch = '{EPOCH}';",
        'Sat.CoordinateSystem = EMRot;', 'Sat.DisplayStateType = Cartesian;',
        f'Sat.X = {x:.6f};', f'Sat.Y = {y:.6f};', f'Sat.Z = {z:.6f};',
        f'Sat.VX = {vx:.9f};', f'Sat.VY = {vy:.9f};', f'Sat.VZ = {vz:.9f};', 'Sat.DryMass = 200;',
        'Create ForceModel FM;', 'FM.CentralBody = Luna;', 'FM.PointMasses = {Luna, Earth, Sun};', 'FM.SRP = Off;',
        'Create Propagator Prop;', 'Prop.FM = FM;', 'Prop.Type = RungeKutta89;', 'Prop.InitialStepSize = 60;',
        'Prop.Accuracy = 1e-12;', 'Prop.MinStep = 0.001;', 'Prop.MaxStep = 3600;', 'Prop.MaxStepAttempts = 50;',
        stations(DSN_STATIONS, 'Earth', DSN_MASK_DEG),
        locators(case, DSN_STATIONS, ['Earth', 'Luna'], ['Earth', 'Luna'], True),
        report(case, None), 'Create Variable k;',
        'BeginMissionSequence;',
        f'For k = 1:{int(days * 4)};',
        '   Propagate Prop(Sat) {Sat.ElapsedDays = 0.25};',
        '   Report RF Sat.ElapsedDays Sat.Luna.RMAG Sat.EMRot.X Sat.EMRot.Y Sat.EMRot.Z;',
        'EndFor;',
    )
    write(case, body, dict(what=what, body='Moon', days=days, epoch=EPOCH, stationIds=list(DSN_STATIONS),
                           maskDeg=DSN_MASK_DEG, forceModel='Moon + Earth + Sun point masses (DE405 ephemeris)',
                           initialStateEMRot=state))


def mars(case, rp_alt, ra_alt, inc, days, what):
    rp, ra = R_MARS + rp_alt, R_MARS + ra_alt
    a, e = (rp + ra) / 2, max((ra - rp) / (ra + rp), 1e-6)
    body = lines(
        body_cs('MarsInertial', 'Mars'),
        spacecraft('MarsInertial', EPOCH_MARS, a, e, inc, 0, 270 if e > 0.01 else 0, 0),
        force_model('Mars', 'Mars50c.cof', 4, ['Sun']),
        stations(DSN_STATIONS, 'Earth', DSN_MASK_DEG),
        locators(case, DSN_STATIONS, ['Earth', 'Mars'], ['Mars'], True),
        report(case, None),
        'BeginMissionSequence;',
        'Report RF Sat.Mars.OrbitPeriod Sat.Mars.SMA Sat.Mars.ECC;',
        f'Propagate Prop(Sat) {{Sat.ElapsedDays = {days}}};',
        'Report RF Sat.Mars.OrbitPeriod Sat.Mars.SMA Sat.Mars.ECC;',
    )
    write(case, body, dict(what=what, body='Mars', periAltKm=rp_alt, apoAltKm=ra_alt, inc=inc, days=days, epoch=EPOCH_MARS,
                           stationIds=list(DSN_STATIONS), maskDeg=DSN_MASK_DEG, forceModel='Mars50c 4x4, Sun point mass'))


def main():
    # --- Earth -----------------------------------------------------------------------------------
    earth_geom('earth_leo400_geom', 400, 51.6, 0.0, 'LEO 400 km / 51.6 deg (ISS-deploy orbit): period, eclipse, contacts')
    ltan = 10.5
    raan = (sun_ra_deg(2027, 1, 1) + (ltan - 12) * 15) % 360
    inc = sso_inclination(R_EARTH + 600)
    earth_geom('earth_sso600_geom', 600, round(inc, 4), round(raan, 4),
               f'SSO 600 km, LTAN 10:30 (RAAN {raan:.2f} deg at epoch), i = {inc:.2f} deg: period, eclipse, contacts')
    CASES['earth_sso600_geom']['ltan'] = '10:30'
    for tag, area, err in (('body_nom', 0.03, 'Nominal'), ('body_hi', 0.03, 'PlusTwoSigma'), ('body_lo', 0.03, 'MinusTwoSigma'),
                           ('wings_nom', 0.08, 'Nominal'), ('wings_hi', 0.08, 'PlusTwoSigma')):
        earth_decay(f'earth_leo400_decay_{tag}', 4.0, area, err, 'NominalCycle',
                    f'3U CubeSat 4.0 kg, drag area {area} m^2, Cd 2.2, from 400 km until 150 km ({err} solar flux)')
    # --- Moon ------------------------------------------------------------------------------------
    lunar('lunar_llo100_keep', 100, 100, 90, 0, 90, True, 'LLO 100 km polar: natural eccentricity growth (no maneuvers)')
    lunar('lunar_llo100_geom', 100, 100, 90, 0, 365, False, 'LLO 100 km polar: eclipse fraction, DSN contacts')
    lunar('lunar_frozen_keep', 30, 200, 86, 270, 365, True,
          'Quasi-frozen 30 x 200 km, 86 deg, periapsis over the south pole (LRO-like): stability')
    lunar('lunar_frozen_geom', 30, 200, 86, 270, 365, False, 'Quasi-frozen 30 x 200 km: eclipse fraction, DSN contacts')
    st_path = os.path.join(HERE, '..', 'orbits', 'nrho_state.json')
    if os.path.exists(st_path):
        st = json.load(open(st_path))
        nrho('lunar_nrho_geom', st['stateEMRotKm'], round(2 * st['periodDays'], 2),
             'L2 southern 9:2 NRHO: eclipse fraction, DSN contacts (2 revolutions, no station keeping)')
    # --- Mars ------------------------------------------------------------------------------------
    mars('mars_capture_geom', 300, 45000, 75, 180, 'Elliptical capture orbit 300 x 45,000 km, 75 deg')
    mars('mars_low300_geom', 300, 300, 93, 180, 'Low orbit 300 km, 93 deg (MRO-like)')
    with open(os.path.join(OUT, 'cases.json'), 'w') as f:
        json.dump(CASES, f, indent=1)
    print('wrote', len(CASES), 'scripts to', OUT)


if __name__ == '__main__':
    main()
