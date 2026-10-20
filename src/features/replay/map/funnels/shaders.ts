/**
 * The funnel: a volumetric raymarch, instanced, in true 3D.
 *
 * ---------------------------------------------------------------------------
 * The look, and where it comes from
 *
 * The old app's funnel is the reference — soft condensation with a ragged
 * edge, a debris skirt at the ground and a broad cloud cap that fades into
 * the sky rather than stopping. Its density model is kept almost exactly: the
 * exponential core radius, the noise-displaced edge, the skirt, the cap. What
 * made it lag was the delivery (every funnel rendered into its own DOM canvas
 * and composited), and what limited it was that it was a picture of a funnel
 * pasted upright on the map.
 *
 * This draws the same volume in the map's own 3D world, in one instanced
 * draw call:
 *
 *   * Each fragment casts a real ray from the camera through the funnel's
 *     local space, so the column holds its shape from any pitch and bearing.
 *     The earlier billboard version was a flat card that had to be turned to
 *     face the camera — it turned the wrong way once the map was rotated, and
 *     from overhead it was a line.
 *   * The ray is clipped to the funnel's bounding cylinder analytically, then
 *     sphere-traced through empty air (jumping straight to the density
 *     boundary) and marched in small steps only inside the volume. A rope
 *     under a wide cloud cap costs almost nothing where there is no rope.
 *   * Lighting comes from the real sun for that moment, in world space.
 * ---------------------------------------------------------------------------
 *
 * Local space: x east, y up, z north, in units of the funnel's height. The
 * profile runs y 0..1 from the ground to the cloud cap.
 */

/** Rotation rate by rating. */
export const EF_SPIN: Record<string, number> = {
  EFU: 1.0,
  EF0: 1.0,
  EF1: 1.35,
  EF2: 1.8,
  EF3: 2.3,
  EF4: 3.0,
  EF5: 3.8,
};

/** The top of the volume: the cap fades out just above y = 1. */
export const FUNNEL_TOP = 1.06;

/**
 * The radius functions. Shared so the bounds the layer computes, the empty
 * space the march skips and the density it samples are one definition.
 */
const RADII = `
float rCore(float rb, float rt, float y) {
  // Exponential: narrow for most of its length, flaring into the cloud base.
  return mix(rb, rt, (exp(3.0 * y) - 1.0) / 19.0855);
}

float rMax(float rb, float rt, float rc, float y) {
  // The debris skirt near the ground, the column, and the wall cloud above.
  float skirt = (rb * 1.7 + 0.035) * 1.2 * 1.4 * step(y, 0.28);
  float cap   = smoothstep(0.56, 0.68, y) * rc * 1.55;
  return max(max(rCore(rb, rt, y) * 1.3, skirt), cap);
}
`;

export const FUNNEL_VERT = `#version 300 es
precision highp float;

/*
 * A screen-space rectangle around the funnel's bounding box.
 *
 * The eight corners of the box are projected and the quad is stretched over
 * their extent, so every pixel the volume could touch gets exactly one
 * fragment — no overlapping faces, so nothing is counted twice. Each corner
 * also carries the view ray through it. The direction of a pinhole ray is
 * linear in screen position, and the quad is emitted with w = 1, so the
 * interpolated direction at every pixel is exact.
 */
in vec2 a_corner;

in vec2 a_pos;      // mercator x, y of the base
in vec4 a_size;     // heightMerc, bound radius, intensity, reach
in vec4 a_look;     // darkness, debris, seed, spin
in vec4 a_form;     // rb, tilt, lean direction (x, z)
in vec2 a_more;     // bend, wobble

uniform mat4 u_matrix;
uniform mat4 u_inverse;
uniform vec3 u_camera;   // mercator

out vec3 v_dir;
flat out vec3 v_origin;
flat out vec4 v_size;
flat out vec4 v_look;
flat out vec4 v_form;
flat out vec2 v_more;

const float TOP = ${FUNNEL_TOP.toFixed(2)};

void main() {
  float H = a_size.x;
  float R = a_size.y;
  v_size = a_size;
  v_look = a_look;
  v_form = a_form;
  v_more = a_more;

  vec2 lo = vec2(1e9);
  vec2 hi = vec2(-1e9);
  float near = 1.0;
  bool behind = false;
  for (int i = 0; i < 8; i += 1) {
    vec3 c = vec3(
      (i & 1) == 0 ? -R : R,
      (i & 2) == 0 ? 0.0 : TOP,
      (i & 4) == 0 ? -R : R);
    // Local (east, up, north) to mercator (east, south, up).
    vec4 clip = u_matrix * vec4(a_pos.x + c.x * H, a_pos.y - c.z * H, c.y * H, 1.0);
    if (clip.w <= 1e-9) { behind = true; break; }
    vec3 ndc = clip.xyz / clip.w;
    lo = min(lo, ndc.xy);
    hi = max(hi, ndc.xy);
    near = min(near, ndc.z);
  }
  // A corner behind the camera means the camera is at or in the box: cover
  // the screen and let the ray-cylinder test sort it out.
  if (behind) { lo = vec2(-1.0); hi = vec2(1.0); near = -1.0; }
  lo = clamp(lo - 0.002, -1.0, 1.0);
  hi = clamp(hi + 0.002, -1.0, 1.0);

  vec2 ndc = mix(lo, hi, a_corner * 0.5 + 0.5);
  // Culled entirely when the box is off screen.
  if (hi.x <= lo.x || hi.y <= lo.y) ndc = vec2(2.0);

  // The ray through this corner: toward the far-plane point, from the camera.
  vec4 far = u_inverse * vec4(ndc, 1.0, 1.0);
  vec3 d = far.xyz - far.w * u_camera;
  v_dir = vec3(d.x, d.z, -d.y);
  v_origin = vec3(u_camera.x - a_pos.x, u_camera.z, -(u_camera.y - a_pos.y)) / H;

  gl_Position = vec4(ndc, max(near, -0.999), 1.0);
}
`;

export const FUNNEL_FRAG = `#version 300 es
precision highp float;
precision highp sampler3D;

in vec3 v_dir;
flat in vec3 v_origin;
flat in vec4 v_size;     // heightMerc, bound radius, intensity, reach
flat in vec4 v_look;     // darkness, debris, seed, spin
flat in vec4 v_form;     // rb, tilt, lean direction
flat in vec2 v_more;     // bend, wobble

uniform sampler3D u_noise;
uniform float u_time;    // seconds of wall-clock, for the rotation
uniform vec3  u_cloud;   // cloud-base colour, from the solar grade
uniform vec3  u_sun;     // toward the sun, local space
uniform float u_flash;
uniform float u_steps;   // samples across the column; the performance dial, adapted to the frame rate
uniform float u_fade;    // 0 in the flat view, 1 once the map is tilted

out vec4 fragColor;
${RADII}

const float TOP = ${FUNNEL_TOP.toFixed(2)};

float g_rb, g_rt, g_rc, g_spin, g_debris, g_low, g_streak;
vec2  g_lean, g_side;

/** Where the column's axis is at height y: leaning downshear, and wandering. */
vec2 axisAt(float y) {
  float bend = v_more.x * sin(y * 3.1 + u_time * 0.5) * y * (1.0 - y) * 4.0;
  float wander = v_more.y * sin(u_time * 0.35 + v_look.z * 6.28) * y;
  return g_lean * (v_form.y * 0.9 * y * y) + g_side * (bend + wander);
}

/**
 * The outer radius the density can reach at height y, including the taper at
 * the tip of a funnel still on its way down.
 */
float bound(float y) {
  if (y < g_low) return 0.0;
  float tip = g_low > 0.0 ? sqrt(smoothstep(g_low, g_low + 0.22, y)) : 1.0;
  return rMax(g_rb, g_rt, g_rc, y) * tip;
}

/*
 * The three parts of the volume at a point, returned separately because they
 * are coloured, lit and made opaque differently: the condensation column, the
 * debris cloud at the ground, and the wall cloud the column hangs from.
 *
 * The noise is sampled on a cylinder in noise space — (cos s, sin s, height)
 * with s the angle around the column — so it wraps around the funnel without
 * a seam, and it is stretched along the helix the column is turning on. That
 * is what draws striations: streaks wound around the funnel, rising as it
 * turns. Sampling the plain (x, z, y) volume instead gave horizontal bands,
 * the lattice showing through as the rays crossed it.
 */
vec3 parts(float y, vec2 q, out float n) {
  float r   = length(q);
  float tip = g_low > 0.0 ? sqrt(smoothstep(g_low, g_low + 0.22, y)) : 1.0;
  float rc  = rCore(g_rb, g_rt, y) * tip;
  float rr  = r / max(rc, 1e-4);
  float ang = atan(q.y, q.x);
  float seed = v_look.z * 7.0;

  // Cyclonic — counter-clockwise from above — and wound up with height.
  float spin = u_time * g_spin * 1.3;
  float s = ang - spin + y * 4.2;
  vec2 cyl = vec2(cos(s), sin(s));
  vec4 a = texture(u_noise, vec3(cyl * 0.34 + seed, y * 0.8 - u_time * 0.03 + rr * 0.06));
  vec4 b = texture(u_noise, vec3(cyl * 1.05 + 0.5 * seed, y * 2.6 + rr * 0.25 + seed));
  n = a.r * 0.62 + b.g * 0.38;

  // Each part is only sampled where it can exist: the noise lookups are the
  // cost of a step, and most steps are in only one of the three.

  // The column: a ragged edge, not a machined cone. It dissolves into the
  // wall cloud at the top rather than ending in a lid.
  float body = 0.0;
  g_streak = 0.5;
  float e = rc * (0.84 + 0.42 * (n - 0.45));
  if (r < e && y < 1.02) {
    body = smoothstep(e, e * 0.55, r) * (1.0 + 0.9 * n) * (0.78 + 0.44 * b.b)
         * smoothstep(1.02, 0.8, y);
    // Thins to nothing at the tip of a funnel still on its way down.
    if (g_low > 0.0) body *= smoothstep(g_low, g_low + 0.07, y);
    // Stretched along the helix: fine around the column, long up it.
    g_streak = texture(u_noise, vec3(cyl * 1.5 - seed, y * 0.45 + rr * 0.12)).g;
  }

  // The debris cloud: wider, browner and busier than the column, taller for
  // a violent tornado, and only once it is on the ground. A churning dome,
  // billowing slightly outward as it rises, with specks — the debris itself —
  // flung around faster than the cloud turns. Every sample carries some
  // radius as well as angle; angle alone draws spokes.
  float debris = 0.0;
  float hd = 0.12 + 0.16 * v_look.y;
  if (y < hd * 1.3 && g_debris > 0.0) {
    float br = (g_rb * 1.7 + 0.035) * (0.85 + 0.35 * clamp(y / hd, 0.0, 1.0));
    float rd = r / br;
    float fast = ang - spin * 1.7 + y * 6.0;
    vec2 cf = vec2(cos(fast), sin(fast)) * (0.6 + 0.5 * rd);
    vec4 c = texture(u_noise, vec3(cf * 0.9 - seed, y / hd * 0.9 - u_time * 0.2));
    float nd = c.r * 0.65 + b.r * 0.35;
    float dome = smoothstep(hd * (0.8 + 0.5 * nd), hd * 0.25, y);
    float core = smoothstep(0.8 + 0.5 * nd, 0.1, rd) * (0.3 + 1.5 * nd);
    float specks = 0.0;
    if (rd < 1.35) {
      // Sampled in the plane, turned with the debris: round specks, not
      // streaks raying out from the centre.
      float fa = spin * 1.7 - y * 6.0;
      vec2 qf = mat2(cos(fa), -sin(fa), sin(fa), cos(fa)) * q / br;
      specks = smoothstep(0.64, 0.8, texture(u_noise, vec3(qf * 1.3 + seed, y / hd * 1.6 - u_time * 0.5)).b)
             * smoothstep(1.35, 0.5, rd) * 1.6;
    }
    debris = dome * (core + specks) * g_debris;
  }

  // The wall cloud: broad and soft-edged, lowest where the column meets it
  // and rising outward, fading out at the top. Radially it falls away
  // smoothly, so there is no rim — no lid on a stick. Its texture turns
  // slowly with the storm, sampled in the plane so it has no spokes.
  float cap = 0.0;
  if (y > 0.55) {
    float R  = g_rc;
    float rn = r / R;
    float ca = spin * 0.18 + y * 0.8;
    vec2 qc = mat2(cos(ca), -sin(ca), sin(ca), cos(ca)) * q / R;
    vec4 w = texture(u_noise, vec3(qc * 0.55 + seed, y * 1.4 + seed));
    float yb = 0.66 + 0.2 * smoothstep(0.0, 0.9, rn) - 0.12 * (w.g - 0.5);
    cap = smoothstep(yb, yb + 0.1, y) * smoothstep(1.06, 0.93, y)
        * exp(-1.7 * rn * rn) * (0.45 + 1.0 * w.b) * 1.3;
  }

  return vec3(body, debris, cap);
}

void main() {
  float intensity = v_size.z * u_fade;
  if (intensity <= 0.002) discard;

  vec3 rd = normalize(v_dir);
  vec3 ro = v_origin;
  float R = v_size.y;

  // Into the bounding cylinder...
  float A = dot(rd.xz, rd.xz);
  float B = dot(ro.xz, rd.xz);
  float C = dot(ro.xz, ro.xz) - R * R;
  float t0 = 0.0, t1 = 1e9;
  if (A > 1e-10) {
    float disc = B * B - A * C;
    if (disc <= 0.0) discard;
    float s = sqrt(disc);
    t0 = (-B - s) / A;
    t1 = (-B + s) / A;
  } else if (C > 0.0) {
    discard;
  }
  // ...and between the ground and the top of the cap.
  if (abs(rd.y) > 1e-8) {
    float ya = (0.0 - ro.y) / rd.y;
    float yb = (TOP - ro.y) / rd.y;
    t0 = max(t0, min(ya, yb));
    t1 = min(t1, max(ya, yb));
  } else if (ro.y < 0.0 || ro.y > TOP) {
    discard;
  }
  t0 = max(t0, 0.0);
  if (t1 <= t0) discard;

  g_rb = v_form.x;
  g_rt = g_rb * 1.3 + 0.06;
  g_rc = min(g_rt * 2.6, g_rt + 0.35);
  g_spin = v_look.w;
  g_low = 1.0 - v_size.w;
  g_debris = (0.45 + v_look.y) * smoothstep(0.55, 1.0, v_size.w);
  g_lean = v_form.zw;
  g_side = vec2(-g_lean.y, g_lean.x);

  /*
   * The palette: dark earth at the contact, slate through the body, cloud
   * grey at the cap. The sky tints it — a dusk funnel looks like dusk — but
   * does not set the level, so it never goes black on a dark basemap.
   */
  vec3 debrisCol = vec3(0.290, 0.231, 0.173);
  vec3 slateCol  = vec3(0.180, 0.204, 0.231);
  vec3 cloudCol  = vec3(0.322, 0.357, 0.400);
  vec3 skyTint   = max(u_cloud, vec3(0.34, 0.37, 0.42));
  slateCol = mix(slateCol, slateCol * skyTint * 2.4, 0.18);
  cloudCol = mix(cloudCol, cloudCol * skyTint * 2.4, 0.18);
  float darkness = 1.0 - v_look.x * 0.18;

  // The sun, horizontally, for the lit and shadowed sides; and from above.
  vec2 sunH = normalize(u_sun.xz + vec2(1e-4));
  float sunUp = clamp(u_sun.y, 0.0, 1.0);

  float steps = clamp(u_steps, 8.0, 32.0);
  // Jitter the start within one step, so banding becomes fine grain.
  // Interleaved gradient noise: grain that reads as texture, not static.
  float dither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float debrisTop = 0.12 + 0.16 * v_look.y;

  vec3  acc = vec3(0.0);
  float alpha = 0.0;
  float n;
  float t = t0;
  bool entered = false;

  for (int i = 0; i < 64; i += 1) {
    if (t >= t1) break;
    vec3 p = ro + rd * t;
    float y = p.y;
    vec2 q = p.xz - axisAt(y);
    float r = length(q);
    float rm = bound(y);

    // Outside the density boundary: jump toward it. The boundary changes with
    // height, so the jump is shortened to stay safely short of it.
    float gap = r - rm;
    float dt = clamp(2.0 * rm / steps, 0.003, 0.05);
    if (gap > 0.0) {
      // Never slower than a fraction of an inside step: a ray grazing the
      // boundary would otherwise crawl along it and run out of iterations
      // before reaching the column, leaving a row of see-through pixels.
      t += max(gap * 0.7, dt * 0.4);
      continue;
    }

    // Finer through the debris, which is thin and busy.
    if (y < debrisTop) dt = min(dt, 0.018);
    if (!entered) {
      entered = true;
      t += dt * dither;
      continue;
    }

    vec3 d3 = parts(y, q, n);
    float streak = g_streak;
    float d = d3.x + d3.y + d3.z;
    if (d > 0.01) {
      /*
       * Beer-Lambert, each part normalised by its own scale: the column by
       * its radius, so a rope and a wedge reach comparable opacity; the wall
       * cloud by its breadth, so a rope's cloud is not a solid slab.
       */
      float sigma = d3.x / max(g_rb, 0.018) * 1.7
                  + d3.y / (g_rb * 1.7 + 0.035) * 1.4
                  + d3.z / (g_rc * 0.32) * 1.0;
      float al = 1.0 - exp(-sigma * dt);

      // Side lighting from the real sun, with a floor: a funnel is lit by
      // the whole sky and has no true shadow side.
      vec2 nr = q / max(r, 1e-5);
      float side = 0.62 + 0.38 * dot(nr, sunH);

      // The column: slate low, cloud grey high, and a bright rim where it
      // thins, which separates condensation from whatever is behind it.
      vec3 bodyCol = mix(slateCol, cloudCol, smoothstep(0.3, 0.95, y)) * (0.55 + 0.75 * side);
      float rc = rCore(g_rb, g_rt, y);
      bodyCol += vec3(0.10, 0.11, 0.12) * smoothstep(0.55, 1.1, r / max(rc, 0.001));
      // Striations: light and dark streaks wound around the column.
      bodyCol *= 0.7 + 0.6 * streak;

      // The debris: earth, darker in its core.
      // The debris: dark earth in the churn, paler dust at the edge.
      vec3 debrisCol2 = mix(debrisCol * 0.7, debrisCol * 1.3, smoothstep(0.2, 1.1, r / (g_rb * 1.7 + 0.035)))
                      * (0.75 + 0.4 * side);

      // The wall cloud: dark underneath, lit from above and from the sun's side.
      float capLift = smoothstep(0.7, 1.0, y);
      vec3 capCol = cloudCol * (0.62 + 0.34 * capLift + 0.18 * sunUp * capLift) * (0.86 + 0.24 * side);

      vec3 col = (bodyCol * d3.x + debrisCol2 * d3.y + capCol * d3.z) / d;
      col *= darkness;

      // Touchdown flash, at the ground contact.
      col += u_flash * exp(-y * 7.0) * 0.45;

      acc += (1.0 - alpha) * al * col;
      alpha += (1.0 - alpha) * al;
      if (alpha > 0.98) break;
    }
    t += dt;
  }

  if (alpha < 0.005) discard;

  // Premultiplied, to match the layer's ONE / ONE_MINUS_SRC_ALPHA blending.
  fragColor = vec4(acc * intensity, alpha * intensity);
}
`;
