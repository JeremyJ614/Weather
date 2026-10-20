/**
 * The tornado as seen from above (#5): a spinning swirl on the ground.
 *
 * In the flat view the volumetric funnel is edge-on and fades out, so this is
 * the tornado there. It keeps the old app's drawing — an earthy debris disc,
 * five dark spiral arms with light edges, debris arcs orbiting faster the
 * closer they are to the middle, a dark eye, and a dashed ring in the rating's
 * colour — and draws it on the GPU, every tornado in one call, so a
 * thirty-tornado afternoon spins as smoothly as one.
 *
 * On top of that, what a drawing on a canvas could not afford: a soft glow in
 * the rating's colour that breathes, a pressure ring that pulses outward, and
 * a burst at the moment of touchdown.
 *
 * Tilted into 3D it stays, quieter, as the swirl on the ground under the
 * funnel — the ring and the debris, without the arms competing with the
 * column standing on them.
 *
 * Space: the quad lies flat on the map in mercator, sized in screen pixels.
 * uv is in units of the icon radius, x east and y south (mercator's own), so
 * a positive angle turns clockwise as seen from above; cyclonic rotation is
 * therefore toward decreasing angle.
 */

export const ICON_VERT = `#version 300 es
precision highp float;

in vec2 a_corner;
in vec2 a_pos;       // mercator
in vec4 a_look;      // radiusPx, intensity, spin (rad/s), seed
in vec4 a_colour;    // rgb, rank 0..1
in float a_flash;

uniform mat4  u_matrix;
uniform float u_pxToMerc;

out vec2 v_uv;
flat out vec4 v_look;
flat out vec4 v_colour;
flat out float v_flash;

const float REACH = 1.62;   // the quad covers the glow and the pulse beyond the ring

void main() {
  v_uv = a_corner * REACH;
  v_look = a_look;
  v_colour = a_colour;
  v_flash = a_flash;
  float half_ = a_look.x * REACH * u_pxToMerc;
  vec2 p = a_pos + a_corner * half_;
  gl_Position = u_matrix * vec4(p, 0.0, 1.0);
}
`;

export const ICON_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
flat in vec4 v_look;
flat in vec4 v_colour;
flat in float v_flash;

uniform float u_time;
uniform float u_ground;   // 0 flat, 1 tilted: the swirl becomes the funnel's footprint

out vec4 fragColor;

const float TAU = 6.2831853;

float hash(float n) { return fract(sin(n * 127.1 + 11.7) * 43758.5453); }

/* Paint src over (col, a), both straight alpha. */
void over(inout vec3 col, inout float a, vec3 src, float sa) {
  float na = sa + a * (1.0 - sa);
  col = na > 1e-4 ? (src * sa + col * a * (1.0 - sa)) / na : col;
  a = na;
}

void main() {
  float r = length(v_uv);
  if (r > 1.62) discard;
  float ang = atan(v_uv.y, v_uv.x);
  float intensity = v_look.y;
  float seed = v_look.w * 97.0;
  vec3 ef = v_colour.rgb;
  float rank = v_colour.a;
  // Cyclonic: the pattern turns toward decreasing angle.
  float th = u_time * v_look.z;
  float busy = 1.0 - 0.6 * u_ground;   // arms, debris and eye step back under a funnel

  vec3 col = vec3(0.0);
  float a = 0.0;

  // --- a glow in the rating's colour, breathing -----------------------------
  float breathe = 0.82 + 0.18 * sin(u_time * 1.7 + seed);
  float glow = exp(-pow((r - 0.95) / 0.34, 2.0)) * 0.34 * breathe * (0.6 + 0.4 * rank);
  over(col, a, ef, glow);

  // --- the pressure ring, pulsing outward ------------------------------------
  float period = 2.6 - 1.0 * rank;
  float k = fract(u_time / period + hash(seed));
  float pr = 1.0 + k * 0.58;
  float pulse = smoothstep(0.045, 0.0, abs(r - pr)) * pow(1.0 - k, 2.0) * 0.55;
  over(col, a, mix(ef, vec3(1.0), 0.35), pulse);

  // --- the debris disc --------------------------------------------------------
  float dA = r < 0.35 ? mix(0.9, 0.62, r / 0.35)
           : r < 0.75 ? mix(0.62, 0.32, (r - 0.35) / 0.4)
           : mix(0.32, 0.0, clamp((r - 0.75) / 0.57, 0.0, 1.0));
  vec3 dCol = mix(vec3(0.19, 0.165, 0.15), vec3(0.55, 0.49, 0.43), smoothstep(0.0, 1.3, r));
  over(col, a, dCol, dA * mix(1.0, 0.75, u_ground));

  // --- five spiral arms, wound inward ----------------------------------------
  float f = clamp(-log(max(r, 1e-3) / 1.28) / 2.2, 0.0, 1.6);
  float ph = 5.0 * (ang + th + 3.6 * f);
  float mask = smoothstep(1.3, 0.95, r) * smoothstep(0.06, 0.22, r);
  float arm = smoothstep(0.62, 1.0, cos(ph)) * mask;
  float edge = smoothstep(0.9, 1.0, cos(ph - 0.45)) * mask;
  over(col, a, vec3(0.18, 0.15, 0.13), arm * 0.6 * busy);
  over(col, a, vec3(0.84, 0.80, 0.74), edge * 0.38 * busy);

  // --- debris, orbiting faster nearer the middle ------------------------------
  for (int i = 0; i < 22; i += 1) {
    float fi = float(i);
    float pr_ = 0.24 + 0.98 * hash(fi * 1.7 + seed);
    float w = (0.55 + 0.85 / sqrt(pr_ + 0.12)) * v_look.z;
    float head = hash(fi * 3.1 + seed) * TAU - u_time * w;
    float len = min(1.3, 0.22 + 0.32 / (pr_ + 0.2));
    float da = mod(ang - head, TAU);          // the tail trails behind the head
    if (da > len) continue;
    float thick = 0.018 + 0.022 * hash(fi * 7.7 + seed);
    float m = smoothstep(thick, thick * 0.25, abs(r - pr_)) * (1.0 - da / len);
    bool light = hash(fi * 5.3 + seed) > 0.55;
    over(col, a, light ? vec3(0.89, 0.85, 0.78) : vec3(0.15, 0.125, 0.11),
         m * (light ? 0.62 : 0.72) * busy);
  }

  // --- the eye ----------------------------------------------------------------
  float eye = smoothstep(0.36, 0.0, r);
  over(col, a, vec3(0.11, 0.094, 0.086), eye * 0.95 * busy);
  float rim = smoothstep(0.035, 0.0, abs(r - 0.21)) * 0.35;
  over(col, a, mix(vec3(0.85, 0.82, 0.76), ef, 0.4), rim * busy);

  // --- the dashed ring, in the rating's colour, turning ------------------------
  float dash = step(fract((ang + th * 0.35) / TAU * 16.0), 0.64);
  float outline = smoothstep(0.075, 0.045, abs(r - 1.0)) * dash;
  float line = smoothstep(0.042, 0.018, abs(r - 1.0)) * dash;
  over(col, a, vec3(0.0), outline * 0.55);
  over(col, a, ef, line);

  // --- touchdown: a burst -------------------------------------------------------
  if (v_flash > 0.0) {
    float br = 1.0 + (1.0 - v_flash) * 0.9;
    float burst = smoothstep(0.09, 0.0, abs(r - br)) * v_flash;
    over(col, a, mix(ef, vec3(1.0), 0.5), burst);
    over(col, a, vec3(1.0), exp(-r * 4.0) * v_flash * 0.5);
  }

  a *= intensity;
  if (a < 0.004) discard;
  fragColor = vec4(col * a, a);   // premultiplied
}
`;
