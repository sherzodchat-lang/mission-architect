"""Earth-Moon CR3BP differential corrector for the L2 southern 9:2 near-rectilinear halo orbit (NRHO).

The 9:2 NRHO (the Gateway orbit) makes 9 revolutions every 2 synodic months: period = 29.5306 d / 4.5 = 6.562 d.
We find the periodic orbit in the circular restricted three-body problem (symmetric single shooting: fix the
period by continuation in z0, drive vx, vz to zero at the half-period y = 0 crossing) and write the
Moon-centred Earth-Moon rotating-frame state for GMAT (tools/gmat/make_scripts.py -> lunar_nrho_geom).

Run: python3 tools/orbits/nrho.py   -> tools/orbits/nrho_state.json
Pure Python (no numpy).
"""
import json
import math
import os

GM_E, GM_M = 398600.4415, 4902.8005   # km^3/s^2
L = 384400.0                          # km, mean Earth-Moon distance
MU = GM_M / (GM_E + GM_M)
TU = math.sqrt(L ** 3 / (GM_E + GM_M))  # s
R_MOON = 1738.2
TARGET_DAYS = 29.530589 / 4.5


def deriv(s):
    x, y, z, vx, vy, vz = s
    r1 = math.sqrt((x + MU) ** 2 + y * y + z * z)
    r2 = math.sqrt((x - 1 + MU) ** 2 + y * y + z * z)
    a1, a2 = (1 - MU) / r1 ** 3, MU / r2 ** 3
    ax = 2 * vy + x - a1 * (x + MU) - a2 * (x - 1 + MU)
    ay = -2 * vx + y - a1 * y - a2 * y
    az = -a1 * z - a2 * z
    return (vx, vy, vz, ax, ay, az)


def rk45_step(s, h):
    """Dormand-Prince 5(4) step; returns (new state, error estimate)."""
    c = [(1 / 5,), (3 / 40, 9 / 40), (44 / 45, -56 / 15, 32 / 9), (19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729),
         (9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656)]
    b5 = (35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84)
    b4 = (5179 / 57600, 0, 7571 / 16695, 393 / 640, -92097 / 339200, 187 / 2100, 1 / 40)
    k = [deriv(s)]
    for row in c:
        st = [s[i] + h * sum(row[j] * k[j][i] for j in range(len(row))) for i in range(6)]
        k.append(deriv(st))
    y5 = [s[i] + h * sum(b5[j] * k[j][i] for j in range(6)) for i in range(6)]
    k.append(deriv(y5))
    y4 = [s[i] + h * sum(b4[j] * k[j][i] for j in range(7)) for i in range(6)]
    err = max(abs(y5[i] - y4[i]) for i in range(6))
    return y5, err


def propagate_to_y0(s, tmax=5.0, tol=1e-12):
    """Integrate until the first y = 0 crossing after t > 0.1; returns (t, state)."""
    t, h = 0.0, 1e-3
    while t < tmax:
        ns, err = rk45_step(s, h)
        if err > tol:
            h *= max(0.1, 0.9 * (tol / err) ** 0.2)
            continue
        if t > 0.1 and s[1] * ns[1] < 0:
            # bisection on step size to land on y = 0
            lo, hi = 0.0, h
            for _ in range(60):
                mid = (lo + hi) / 2
                ms, _ = rk45_step(s, mid)
                if ms[1] * s[1] > 0:
                    lo = mid
                else:
                    hi = mid
            ms, _ = rk45_step(s, hi)
            return t + hi, ms
        s, t = ns, t + h
        h *= min(4.0, 0.9 * (tol / max(err, 1e-30)) ** 0.2)
    raise RuntimeError('no y = 0 crossing')


def min_moon_distance(s0, T):
    s, t, h, rmin, tol = list(s0), 0.0, 1e-4, 9.0, 1e-12
    while t < T:
        ns, err = rk45_step(s, h)
        if err > tol:
            h *= max(0.1, 0.9 * (tol / err) ** 0.2)
            continue
        s, t = ns, t + h
        rmin = min(rmin, math.sqrt((s[0] - 1 + MU) ** 2 + s[1] ** 2 + s[2] ** 2))
        h = min(h * min(4.0, 0.9 * (tol / max(err, 1e-30)) ** 0.2), T - t + 1e-9)
    return rmin


def correct(x0, z0, vy0):
    """Fix z0; Newton on (x0, vy0) so that vx = vz = 0 at the half-period crossing."""
    for _ in range(30):
        def f(x, v):
            t, s = propagate_to_y0((x, 0, z0, 0, v, 0))
            return s[3], s[5], t
        fx, fz, th = f(x0, vy0)
        if abs(fx) < 1e-10 and abs(fz) < 1e-10:
            return x0, vy0, 2 * th
        d = 1e-7
        a1, b1, _ = f(x0 + d, vy0)
        a2, b2, _ = f(x0, vy0 + d)
        J = ((a1 - fx) / d, (a2 - fx) / d, (b1 - fz) / d, (b2 - fz) / d)
        det = J[0] * J[3] - J[1] * J[2]
        dx = (-fx * J[3] + fz * J[1]) / det
        dv = (-J[0] * fz + J[2] * fx) / det
        x0, vy0 = x0 + dx, vy0 + dv
    raise RuntimeError('corrector did not converge')


def main():
    target = TARGET_DAYS * 86400 / TU
    # Initial guess at apolune (south, y = 0) for the L2 southern NRHO family.
    z0, x0, vy0 = -0.1821, 1.0221, -0.1033
    x0, vy0, T = correct(x0, z0, vy0)
    # secant continuation in z0 to hit the 9:2 period
    z_prev, T_prev = z0, T
    z0 += -0.002
    for _ in range(20):
        x0, vy0, T = correct(x0, z0, vy0)
        if abs(T - target) < 1e-7:
            break
        z_new = z0 + (target - T) * (z0 - z_prev) / (T - T_prev)
        z_prev, T_prev, z0 = z0, T, z_new
    s0 = (x0, 0.0, z0, 0.0, vy0, 0.0)
    rp = min_moon_distance(s0, T) * L
    ra = math.sqrt((x0 - 1 + MU) ** 2 + z0 ** 2) * L
    state = [(x0 - 1 + MU) * L, 0.0, z0 * L, 0.0, vy0 * L / TU, 0.0]
    out = dict(model='Earth-Moon CR3BP, mu = %.9f, L = %.0f km, TU = %.1f s' % (MU, L, TU),
               family='L2 southern halo (NRHO), 9:2 lunar synodic resonance',
               nondim=dict(x0=x0, z0=z0, vy0=vy0, period=T),
               periodDays=T * TU / 86400, perilunePerAltKm=[rp, rp - R_MOON], apoluneRadiusKm=ra,
               stateEMRotKm=state,
               note='Moon-centred Earth-Moon rotating frame (x: Earth->Moon, z: orbit normal), km and km/s; starts at apolune.')
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'nrho_state.json')
    with open(path, 'w') as f:
        json.dump(out, f, indent=1)
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
