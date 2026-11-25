/**
 * GLSL for the three materials. All lighting comes from an analytic "photo studio" environment
 * (soft boxes and strip lights), so metals and gems get crisp, believable reflections with no HDR files.
 */

const COMMON = /* glsl */ `#version 300 es
precision highp float;
uniform vec3 uEye;
uniform float uTime;
uniform float uExposure;
uniform float uWarmth;

float softbox(vec3 d, vec3 c, vec2 size, float soft) {
  vec3 up = abs(c.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 x = normalize(cross(up, c));
  vec3 y = cross(c, x);
  float z = dot(d, c);
  if (z <= 0.0) return 0.0;
  vec2 p = vec2(dot(d, x), dot(d, y)) / z;
  vec2 q = abs(p) - size;
  float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  return 1.0 - smoothstep(-soft, soft, dist);
}

vec3 studio(vec3 d, float rough) {
  d = normalize(d);
  float soft = 0.015 + rough * 0.55;
  float dim = 1.0 / (1.0 + rough * 3.0);
  vec3 warm = mix(vec3(1.0), vec3(1.0, 0.93, 0.82), uWarmth);
  vec3 col = mix(vec3(0.025, 0.021, 0.018), vec3(0.2, 0.18, 0.165), smoothstep(-0.35, 0.9, d.y));
  col += vec3(0.06, 0.045, 0.03) * smoothstep(0.0, -0.7, d.y);
  col += 6.5 * warm * softbox(d, normalize(vec3(0.15, 0.9, 0.55)), vec2(0.55, 0.28), soft) * dim;
  col += 3.4 * softbox(d, normalize(vec3(-1.0, 0.2, 0.35)), vec2(0.09, 0.75), soft) * dim;
  col += 3.0 * warm * softbox(d, normalize(vec3(1.0, 0.1, -0.25)), vec2(0.09, 0.75), soft) * dim;
  col += 1.8 * softbox(d, normalize(vec3(0.0, 0.35, -1.0)), vec2(0.7, 0.1), soft) * dim;
  col += 0.9 * softbox(d, normalize(vec3(0.6, -0.15, 1.0)), vec2(0.35, 0.08), soft) * dim;
  col += vec3(0.22) * exp(-abs(d.y) * 10.0);
  return col;
}

vec3 tonemap(vec3 c) {
  c *= uExposure;
  c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
}
`;

export const MESH_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;
uniform mat4 uProj, uView, uModel;
out vec3 vPos;
out vec3 vNormal;
out vec2 vUv;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vPos = w.xyz;
  vNormal = mat3(uModel) * aNormal;
  vUv = aUv;
  gl_Position = uProj * uView * w;
}`;

export const METAL_FS =
  COMMON +
  /* glsl */ `
in vec3 vPos;
in vec3 vNormal;
in vec2 vUv;
uniform vec3 uColor;
uniform float uRough;
out vec4 outColor;
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uEye - vPos);
  if (dot(N, V) < 0.0) N = -N;
  vec3 R = reflect(-V, N);
  float NoV = max(dot(N, V), 0.0);
  vec3 F = uColor + (1.0 - uColor) * pow(1.0 - NoV, 5.0);
  vec3 col = studio(R, uRough) * F;
  col += uColor * 0.04 * (0.5 + 0.5 * N.y);
  outColor = vec4(tonemap(col), 1.0);
}`;

export const GEM_FS =
  COMMON +
  /* glsl */ `
in vec3 vPos;
in vec3 vNormal;
in vec2 vUv;
uniform vec3 uColor;   // body tint
uniform float uIor;
uniform float uDisp;
out vec4 outColor;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uEye - vPos);
  if (dot(N, V) < 0.0) N = -N;
  float NoV = max(dot(N, V), 0.0);
  float f0 = pow((uIor - 1.0) / (uIor + 1.0), 2.0);
  float fres = f0 + (1.0 - f0) * pow(1.0 - NoV, 5.0);
  vec3 refl = studio(reflect(-V, N), 0.0);
  // Refraction with per-channel IOR for "fire", then a scrambled internal bounce for brilliance.
  vec3 tr;
  for (int c = 0; c < 3; c++) {
    vec3 T = refract(-V, N, 1.0 / (uIor + (float(c) - 1.0) * uDisp));
    vec3 bounce = normalize(vec3(T.x * 2.6 + N.z, -abs(T.y) + 0.35, T.z * 2.6 - N.x));
    tr[c] = studio(bounce, 0.0)[c];
  }
  vec3 body = tr * uColor * 2.1 + uColor * 0.12;
  // Facet flashes: each flat facet catches the light at its own angle as the piece turns.
  float facet = hash(floor(N * 23.0));
  float flash = pow(max(0.0, sin(facet * 40.0 + dot(N, V) * 9.0 + uTime * 0.6)), 10.0);
  body += mix(vec3(1.0), uColor, 0.4) * flash * 1.4;
  float tw = step(0.9, hash(floor(vPos * 60.0) + floor(uTime * 2.0)));
  vec3 col = mix(body, refl, fres) + uColor * 0.03;
  col += tw * 0.9 * smoothstep(0.5, 1.0, max(max(refl.r, refl.g), refl.b));
  outColor = vec4(tonemap(col), 1.0);
}`;

export const PEARL_FS =
  COMMON +
  /* glsl */ `
in vec3 vPos;
in vec3 vNormal;
in vec2 vUv;
uniform vec3 uColor;
out vec4 outColor;
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uEye - vPos);
  float NoV = max(dot(N, V), 0.0);
  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (NoV * 1.3 + vec3(0.0, 0.33, 0.67)));
  vec3 diffuse = uColor * (0.35 + 0.65 * max(dot(N, normalize(vec3(0.3, 0.9, 0.5))), 0.0));
  vec3 spec = studio(reflect(-V, N), 0.25) * (0.06 + 0.5 * pow(1.0 - NoV, 4.0));
  vec3 col = diffuse * 0.55 + spec + irid * 0.06 * (1.0 - NoV);
  outColor = vec4(tonemap(col), 1.0);
}`;

/** Garments: a grid pushed out of the plane by a height map, front and back meeting at the silhouette. */
export const FABRIC_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;
uniform mat4 uProj, uView, uModel;
uniform sampler2D uHeight;
uniform float uPuff, uSide, uTime, uSway;
uniform vec2 uTexel;
uniform vec2 uSize; // world width/height of the grid
out vec3 vPos;
out vec3 vNormal;
out vec2 vUv;
out float vH;
float h(vec2 uv) { return texture(uHeight, uv).r; }
void main() {
  vec2 uv = aUv;
  float c = h(uv);
  float dx = (h(uv + vec2(uTexel.x, 0.0)) - h(uv - vec2(uTexel.x, 0.0)));
  float dy = (h(uv + vec2(0.0, uTexel.y)) - h(uv - vec2(0.0, uTexel.y)));
  vec3 p = aPos;
  float sway = sin(uTime * 1.3 + p.y * 2.2 + p.x * 0.8) * uSway * (0.6 - p.y * 0.35);
  p.z = uSide * c * uPuff + sway;
  // Surface z = side·f(x, y) ⇒ outward normal = side·(−∂f/∂x, −∂f/∂y, 1). World y grows as v shrinks.
  float dfdx = dx / (2.0 * uTexel.x) * uPuff / uSize.x;
  float dfdy = -dy / (2.0 * uTexel.y) * uPuff / uSize.y;
  vec3 n = normalize(uSide * vec3(-dfdx, -dfdy, 1.0));
  vec4 w = uModel * vec4(p, 1.0);
  vPos = w.xyz;
  vNormal = mat3(uModel) * n;
  vUv = uSide > 0.0 ? uv : vec2(1.0 - uv.x, uv.y);
  vH = c;
  gl_Position = uProj * uView * w;
}`;

export const FABRIC_FS =
  COMMON +
  /* glsl */ `
in vec3 vPos;
in vec3 vNormal;
in vec2 vUv;
in float vH;
uniform sampler2D uAlbedo;
uniform sampler2D uMask;
uniform float uSide;
uniform vec2 uFlip;
out vec4 outColor;
void main() {
  vec2 muv = uSide > 0.0 ? vUv : vec2(1.0 - vUv.x, vUv.y);
  // Anti-aliased silhouette: a one-pixel ramp around the mask edge instead of a hard cut.
  float m = texture(uMask, muv).r;
  float edge = clamp((m - 0.5) / max(fwidth(m), 1e-4) + 0.5, 0.0, 1.0);
  if (edge <= 0.01) discard;
  vec3 albedo = pow(texture(uAlbedo, vUv).rgb, vec3(2.2));
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uEye - vPos);
  if (dot(N, V) < 0.0) N = -N;
  vec3 L = normalize(vec3(0.35, 0.8, 0.9));
  float wrap = max((dot(N, L) + 0.35) / 1.35, 0.0);
  float fill = max(dot(N, normalize(vec3(-0.8, 0.2, 0.4))), 0.0) * 0.35;
  float sheen = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.35;
  float ao = mix(0.55, 1.0, smoothstep(0.0, 0.35, vH));
  float knit = 0.97 + 0.03 * sin(vUv.x * 900.0) * sin(vUv.y * 900.0);
  vec3 col = albedo * (0.18 + wrap * 1.25 + fill) * ao * knit + sheen * (albedo + 0.15);
  outColor = vec4(tonemap(col * 1.1) * edge, edge);
}`;

export const SHADOW_FS = /* glsl */ `#version 300 es
precision highp float;
in vec3 vPos;
in vec3 vNormal;
in vec2 vUv;
uniform float uOpacity;
out vec4 outColor;
void main() {
  float d = length(vUv * 2.0 - 1.0);
  float a = (1.0 - smoothstep(0.0, 1.0, d)) * uOpacity;
  outColor = vec4(0.0, 0.0, 0.0, a * a);
}`;
