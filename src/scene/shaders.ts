// GLSL for the cinematic celestial view. All lighting is computed in linear HDR and tone-mapped
// by the renderer (ACES). Distances are in "planet units" (body radius = 1) inside the shaders;
// uCenter / uRadius convert world space.

/** Single-scattering helpers shared by surface, clouds and the atmosphere shell. */
const ATMO_COMMON = /* glsl */ `
uniform vec3 uTauR;      // vertical optical depth, Rayleigh-like (per channel)
uniform vec3 uTauM;      // vertical optical depth, Mie / dust (per channel)
uniform float uHr;       // scale heights (planet radii)
uniform float uHm;

// Schüler's approximation of the Chapman grazing-incidence function (relative slant column).
float chapman(float X, float h, float mu) {
  float c = sqrt(X + h);
  if (mu >= 0.0) return c / (c * mu + 1.0) * exp(-h);
  float x0 = sqrt(max(1.0 - mu * mu, 0.0)) * (X + h);
  float c0 = sqrt(x0);
  return 2.0 * c0 * exp(min(X - x0, 0.0)) - c / (1.0 - c * mu) * exp(-h);
}

// optical depth from altitude h along a ray with cos(zenith) = mu, to space
vec3 opticalDepth(float h, float mu) {
  return uTauR * chapman(1.0 / uHr, h / uHr, mu) + uTauM * chapman(1.0 / uHm, h / uHm, mu);
}
`

export const PLANET_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
void main() {
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`

export const PLANET_FRAG = /* glsl */ `
#define PI 3.14159265
uniform sampler2D uColor;
uniform sampler2D uData;
uniform sampler2D uClouds;
uniform sampler2D uLights;
uniform vec3 uSun;
uniform float uSunI;
uniform float uBump;
uniform float uCloudU;
uniform float uCloudH;
uniform float uHasAtmo;
uniform vec3 uTint;
${ATMO_COMMON}
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;

float cloudAlpha(float c) { return clamp(pow(max(c - 0.05, 0.0) / 0.8, 1.35), 0.0, 0.97); }

void main() {
  vec3 n = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  vec3 L = uSun;
  vec3 east = cross(vec3(0.0, 1.0, 0.0), n);
  float cl = length(east);
  east = cl > 1e-4 ? east / cl : vec3(1.0, 0.0, 0.0);
  vec3 north = cross(n, east);

  vec4 d = texture2D(uData, vUv);
  vec2 s = (d.rg - 0.5) * 2.0 * uBump;
  vec3 nb = normalize(n - s.x * east - s.y * north);

  vec3 albedo = texture2D(uColor, vUv).rgb * uTint;
  float muG = dot(n, L);
  float mu = max(dot(nb, L), 0.0);
  float muV = max(dot(n, V), 0.0);
  // soft geometric terminator (solar disc + refraction), relief can't light the night side
  float vis = smoothstep(-0.035, 0.05, muG);

  vec3 Ts = vec3(1.0);
  vec3 Tv = vec3(1.0);
  if (uHasAtmo > 0.5) {
    Ts = exp(-opticalDepth(0.0, max(muG, 0.0)));
    Tv = exp(-opticalDepth(0.0, max(muV, 0.015)));
  }

  vec3 col;
#if defined(BODY_EARTH)
  float water = d.b;
  // cloud shadows: look up the cloud deck toward the sun
  float coslat = max(sqrt(max(1.0 - n.y * n.y, 0.0)), 0.08);
  vec2 off = vec2(dot(L, east), dot(L, north)) / max(muG, 0.2) * uCloudH;
  off.x /= 6.2832 * coslat;
  off.y /= 3.1416;
  float shade = 1.0 - 0.62 * cloudAlpha(texture2D(uClouds, vUv + vec2(uCloudU, 0.0) + off).r);
  // land: lambert on the relief normal; ocean: darker, glossy
  vec3 diff = albedo * mu * (1.0 - 0.15 * water);
  col = diff * Ts * vis * shade * uSunI;
  // sun glint (GGX, wind-roughened sea)
  vec3 H = normalize(L + V);
  float NdH = max(dot(n, H), 0.0);
  float a = 0.16;
  float a2 = a * a;
  float dd = NdH * NdH * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * dd * dd);
  float F = 0.02 + 0.98 * pow(1.0 - max(dot(H, V), 0.0), 5.0);
  float spec = D * F / (4.0 * max(muV, 0.08)) * max(muG, 0.0);
  col += water * spec * Ts * vis * shade * uSunI * vec3(1.0, 0.96, 0.9) * 1.3;
  // night: city lights (warm sodium / LED mix), faint airglow
  float night = 1.0 - smoothstep(-0.12, 0.06, muG);
  float lights = texture2D(uLights, vUv).r;
  lights = lights * lights * (1.4 - 0.4 * lights);
  col += vec3(1.0, 0.66, 0.34) * lights * night * 1.25;
  col += albedo * 0.006 + vec3(0.0, 0.002, 0.004) * night;
#elif defined(BODY_MOON)
  // regolith: Lommel-Seeliger / Lambert blend (no limb darkening, crisp terminator relief)
  float ls = 2.0 * mu / (mu + muV + 0.05);
  col = albedo * mix(mu, ls * 0.5, 0.6) * vis * uSunI * 1.35;
  col += albedo * 0.0035;
#else
  // Mars: lambert with a touch of Minnaert limb darkening
  float k = 0.86;
  float mn = pow(max(mu, 1e-4), k) * pow(max(muV, 0.05), k - 1.0);
  col = albedo * mix(mu, mn, 0.5) * Ts * vis * uSunI;
  col += albedo * 0.004;
#endif
  col *= Tv;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export const CLOUD_FRAG = /* glsl */ `
uniform sampler2D uClouds;
uniform vec3 uSun;
uniform float uSunI;
uniform float uCloudU;
uniform float uAlt;
uniform vec2 uTexel;
${ATMO_COMMON}
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;

float cloudAlpha(float c) { return clamp(pow(max(c - 0.05, 0.0) / 0.8, 1.35), 0.0, 0.97); }

void main() {
  vec3 n = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  vec3 L = uSun;
  vec2 uv = vUv + vec2(uCloudU, 0.0);
  float c = texture2D(uClouds, uv).r;
  float a = cloudAlpha(c);
  if (a < 0.003) discard;
  // fake relief from the coverage gradient: thick cores read as billows near the terminator
  vec3 east = cross(vec3(0.0, 1.0, 0.0), n);
  float cl = length(east);
  east = cl > 1e-4 ? east / cl : vec3(1.0, 0.0, 0.0);
  vec3 north = cross(n, east);
  float cx = texture2D(uClouds, uv + vec2(uTexel.x, 0.0)).r - texture2D(uClouds, uv - vec2(uTexel.x, 0.0)).r;
  float cy = texture2D(uClouds, uv + vec2(0.0, uTexel.y)).r - texture2D(uClouds, uv - vec2(0.0, uTexel.y)).r;
  vec3 nb = normalize(n - 1.6 * (cx * east + cy * north));
  float muG = dot(n, L);
  float lit = clamp((dot(nb, L) + 0.25) / 1.25, 0.0, 1.0);
  float vis = smoothstep(-0.06, 0.06, muG);
  vec3 Ts = exp(-opticalDepth(uAlt, max(muG, 0.0)));
  vec3 Tv = exp(-opticalDepth(uAlt, max(dot(n, V), 0.015)));
  vec3 col = vec3(0.96, 0.97, 1.0) * lit * Ts * vis * uSunI * 0.85;
  col *= Tv;
  // thin cloud is more translucent toward the limb (we look through more of it, but it is lit less)
  gl_FragColor = vec4(col, a * 0.96);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

/** Atmosphere shell, front faces, additive: single scattering ray-marched to the ground or space. */
export const ATMO_VERT = PLANET_VERT

export const ATMO_FRAG = /* glsl */ `
#define PI 3.14159265
#define STEPS 10
uniform vec3 uCenter;
uniform float uRadius;
uniform float uTop;
uniform vec3 uSun;
uniform float uSunI;
uniform vec3 uScatM;     // Mie scattering colour (dust) multiplier
uniform float uG;
${ATMO_COMMON}
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;

vec2 sphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(1e9, -1e9);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

void main() {
  vec3 ro = (cameraPosition - uCenter) / uRadius;
  vec3 rd = normalize(vW - cameraPosition);
  vec2 ta = sphere(ro, rd, uTop);
  if (ta.y <= 0.0) discard;
  vec2 tp = sphere(ro, rd, 1.0);
  float t0 = max(ta.x, 0.0);
  float t1 = tp.x > 0.0 && tp.x < 1e8 ? tp.x : ta.y;
  float ds = (t1 - t0) / float(STEPS);
  vec3 L = uSun;
  vec3 betaR = uTauR / uHr;
  vec3 betaM = uTauM / uHm;
  float Xr = 1.0 / uHr;
  float Xm = 1.0 / uHm;
  vec3 sumR = vec3(0.0);
  vec3 sumM = vec3(0.0);
  float odR = 0.0;
  float odM = 0.0;
  float jit = ign(gl_FragCoord.xy);
  for (int i = 0; i < STEPS; i++) {
    float t = t0 + (float(i) + jit) * ds;
    vec3 p = ro + rd * t;
    float r = length(p);
    float h = max(r - 1.0, 0.0);
    float dR = exp(-h / uHr) * ds;
    float dM = exp(-h / uHm) * ds;
    odR += dR;
    odM += dM;
    float mu = dot(p / r, L);
    // planet shadow, softened over a thin band
    float sh = 1.0;
    if (mu < 0.0) sh = smoothstep(-0.012, 0.012, sqrt(max(1.0 - mu * mu, 0.0)) * r - 1.0);
    if (sh <= 0.0) continue;
    vec3 tau = uTauR * chapman(Xr, h / uHr, mu) + uTauM * chapman(Xm, h / uHm, mu) + betaR * odR + betaM * odM;
    vec3 T = exp(-tau) * sh;
    sumR += T * dR;
    sumM += T * dM;
  }
  float c = dot(rd, L);
  float pR = 0.0597 * (1.0 + c * c);
  float g = uG;
  float g2 = g * g;
  float pM = 0.1194 * ((1.0 - g2) * (1.0 + c * c)) / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * g * c, 1.5));
  vec3 col = uSunI * (sumR * betaR * pR + sumM * betaM * uScatM * pM);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

// ---------------------------------------------------------------- lines (screen-space ribbons)

export const LINE_VERT = /* glsl */ `
attribute vec3 aPrev;
attribute vec3 aNext;
attribute float aSide;
attribute float aAlong;
uniform vec2 uRes;
uniform float uWidth;
varying float vSide;
varying float vAlong;
varying vec3 vW;
vec2 toScreen(vec4 c) { return c.xy / max(c.w, 1e-4) * uRes * 0.5; }
void main() {
  mat4 mvp = projectionMatrix * modelViewMatrix;
  vec4 c = mvp * vec4(position, 1.0);
  vec2 sp = toScreen(mvp * vec4(aPrev, 1.0));
  vec2 sn = toScreen(mvp * vec4(aNext, 1.0));
  vec2 dir = sn - sp;
  float l = length(dir);
  dir = l > 1e-5 ? dir / l : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  c.xy += nrm * aSide * uWidth * 0.5 / (uRes * 0.5) * c.w;
  vSide = aSide;
  vAlong = aAlong;
  vW = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = c;
}`

export const LINE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uWidth;
uniform float uCore;
uniform float uGlow;
uniform vec3 uCenter;
uniform float uFar;
uniform float uProgress;   // < 0: off. Part beyond the progress is dashed & dim
uniform float uDashes;     // dashes over the whole line (0 = solid)
uniform float uDashMove;
uniform float uFadeEnds;
varying float vSide;
varying float vAlong;
varying vec3 vW;
void main() {
  float x = abs(vSide) * uWidth * 0.5;
  float core = 1.0 - smoothstep(uCore * 0.5 - 0.35, uCore * 0.5 + 0.6, x);
  float sig = uWidth * 0.22;
  float glow = exp(-x * x / (2.0 * sig * sig)) * uGlow;
  float a = core + glow;
  vec3 toCam = normalize(cameraPosition - uCenter);
  float facing = dot(normalize(vW - uCenter), toCam);
  a *= mix(uFar, 1.0, smoothstep(-0.3, 0.45, facing));
  float dashOn = 1.0;
  if (uDashes > 0.0) dashOn = step(0.5, fract(vAlong * uDashes - uDashMove));
  if (uProgress >= 0.0) {
    float ahead = step(uProgress, vAlong);
    a *= mix(1.0, 0.4 * dashOn, ahead);
  } else {
    a *= dashOn;
  }
  if (uFadeEnds > 0.0) a *= smoothstep(0.0, uFadeEnds, vAlong) * smoothstep(1.0, 1.0 - uFadeEnds, vAlong);
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor * a * uOpacity, 1.0);
}`

// ---------------------------------------------------------------- sky

export const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uDpr;
varying vec3 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uDpr;
  gl_Position = projectionMatrix * mv;
}`

export const STAR_FRAG = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  float a = exp(-r2 * 4.0);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * a * uOpacity, 1.0);
}`

export const SKY_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec3 c = texture2D(uMap, vUv).rgb;
  gl_FragColor = vec4(c * uOpacity, 1.0);
}`

/** Sun disc + glare (camera-facing quad). */
export const GLARE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec2 scale = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
  mv.xy += position.xy * scale;
  gl_Position = projectionMatrix * mv;
}`

export const GLARE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uDisc;      // disc radius in quad units (0..1)
varying vec2 vUv;
void main() {
  float r = length(vUv);
  float disc = 1.0 - smoothstep(uDisc * 0.85, uDisc, r);
  float halo = exp(-r * 7.0) * 0.9 + exp(-r * 2.6) * 0.18;
  float ang = atan(vUv.y, vUv.x);
  float rays = pow(abs(cos(ang * 3.0)), 60.0) * exp(-r * 4.0) * 0.18 + pow(abs(cos(ang * 2.0 + 0.4)), 120.0) * exp(-r * 3.0) * 0.12;
  float edge = 1.0 - smoothstep(0.75, 1.0, r);
  vec3 c = uColor * (halo + rays) * edge * uIntensity + vec3(1.0, 0.97, 0.9) * disc * 6.0;
  gl_FragColor = vec4(c, 1.0);
}`
