/**
 * The funnel: a volumetric raymarch, instanced, in world space.
 *
 * ---------------------------------------------------------------------------
 * What this replaces, and why
 *
 * The first version of this file drew a flat billboard with 2D noise on it. It
 * was worse than the app this one was meant to improve on, and it was worse for
 * a structural reason: a funnel is a *volume*, and no amount of texturing a
 * plane produces the depth you get from marching through one.
 *
 * The app being copied did it properly — a WebGL2 raymarch through a 3D noise
 * texture — and its density model is good enough to keep. What it did not do
 * well was pay for it: each tornado was rendered into its own DOM canvas and
 * blitted, which is a GL pass plus a composite per funnel per frame, and it
 * lagged.
 *
 * This keeps the density model and throws away the cost. One instanced draw
 * call puts every funnel on the map, each raymarched in its own local space,
 * in the map's own 3D world — so they stand up, tilt with the camera, and sit
 * behind and in front of each other correctly, with no canvases to composite.
 * ---------------------------------------------------------------------------
 *
 * The geometry is a cylindrical billboard: upright in the world, rotating
 * about its vertical axis to face the camera. That is not a compromise here,
 * it is the right proxy plane — the ray direction through the volume is the
 * view direction, so the quad's plane is exactly the slab the march crosses.
 *
 * The spec this was built to asks for a tight cone bounding mesh, to stop the
 * GPU marching empty air. The analytic bound does the same job better: `rMax`
 * gives the exact outer radius of the density field at every height, so a
 * fragment outside it is discarded before a single step is taken, and the
 * entry and exit points of the slab are computed in closed form rather than
 * searched for. No step is ever spent outside the funnel.
 */

/** Rotation rate by rating. The spec's mapping, and it is the right shape. */
export const EF_SPIN: Record<string, number> = {
  EFU: 1.0,
  EF0: 1.0,
  EF1: 1.35,
  EF2: 1.8,
  EF3: 2.3,
  EF4: 3.0,
  EF5: 3.8,
};

/**
 * The radius functions, shared by both shaders.
 *
 * The vertex shader needs them to build the bounding silhouette and the
 * fragment shader needs them to bound the march. Sharing the source is the
 * point: the spec asks that the mesh's silhouette align with the shader's
 * mathematical density boundary, and the only way to guarantee that is for
 * both to be the same function rather than two that agree today.
 */
const RADII = `
float rCore(float rb, float rt, float y) {
  // Exponential, so the column is narrow for four fifths of its length and
  // flares hard into the base. A linear cone is the single most recognisable
  // "this is a 3D model of a tornado" tell.
  return mix(rb, rt, (exp(3.4 * y) - 1.0) / 28.964);
}

float rMax(float rb, float rt, float rc, float y) {
  float g    = clamp((0.22 - y) / 0.22, 0.0, 1.0);          // debris bowl falloff
  float bowl = (rb * (1.15 + 0.9 * g) + 0.02) * 1.35 * step(y, 0.22);
  float top  = smoothstep(0.74, 0.85, y) * rc * (0.80 + 0.55 * smoothstep(0.78, 1.05, y)) * 1.20;
  return max(max(rCore(rb, rt, y) * 1.5, bowl), top);
}
`;

export const FUNNEL_VERT = `#version 300 es
precision highp float;

/*
 * The bounding silhouette.
 *
 * a_corner.x is -1 or +1 (the left or right edge) and a_corner.y is the
 * height up the funnel. The strip has many rows, and each row is pulled in to
 * exactly rMax at that height — so the mesh is the density boundary, not a
 * rectangle around it.
 *
 * This replaces a two-triangle quad. The quad worked, because the fragment
 * shader discarded everything outside rMax before marching, so no ray step
 * was ever spent in empty air. But a discarded fragment is still a rasterised
 * fragment: the GPU sets up and invokes the shader for every pixel of the
 * bounding box, including the large empty corners beside a narrow rope, and
 * then throws the work away. Shaping the mesh means those pixels are never
 * generated at all.
 */
in vec2 a_corner;${RADII}

// Per instance.
in vec2  a_pos;      // mercator x, y
in vec4  a_shape;    // halfWidthMerc, heightMerc, intensity, tilt
in vec4  a_style;    // opacity, darkness, debris, wobbleMerc
in vec4  a_life;     // seed, reach, spin, baseRadius (in height units)
in vec2  a_extra;    // X (half-quad in height units), bend

uniform mat4  u_matrix;
uniform float u_bearing;
uniform float u_time;

out vec2  v_uv;      // x in [-1,1] across the quad's full width, y in [0,1] up it
out vec4  v_style;
out vec4  v_life;
out vec2  v_extra;
out float v_intensity;
out float v_tilt;

void main() {
  float halfW  = a_shape.x;
  float height = a_shape.y;
  v_intensity  = a_shape.z;
  v_tilt       = a_shape.w;
  v_uv.y  = a_corner.y;
  v_style = a_style;
  v_life  = a_life;
  v_extra = a_extra;

  /*
   * The quad is sized on the CPU to the widest thing in the volume — the
   * debris bowl, or the flare into the cloud base — and the fragment shader
   * discards whatever falls outside the density bound. A discarded fragment is
   * nearly free; a volume clipped by its own quad is a straight edge through
   * the middle of a tornado, which is what the first attempt showed.
   */
  /*
   * Pull each row of the strip in to the density boundary at its own height.
   *
   * X is the half-width the quad would have had; the ratio below is how much
   * of that width the funnel actually occupies at this height. A little slack
   * (1.04) keeps the soft edge of the volume inside the mesh — cutting exactly
   * on the boundary leaves a visible hard edge where the density was still
   * fading out.
   */
  float rb = a_life.w;
  float rt = rb * 1.3 + 0.06;
  float rc = min(rt * 1.9, rt + 0.20);
  float X  = a_extra.x;
  float edge = min(1.0, rMax(rb, rt, rc, a_corner.y) * 1.04 / max(X, 1e-4));

  v_uv.x = a_corner.x * edge;

  float c = cos(-u_bearing);
  float s = sin(-u_bearing);
  vec2 across = vec2(c, s) * (a_corner.x * edge * halfW);

  // The whole column leans downshear as it ropes out, and wanders while mature.
  float wander = sin(u_time * 0.35 + a_life.x * 6.28) * a_style.w;
  vec2 lean = vec2(c, s) * (v_tilt * height * a_corner.y * 0.9)
            + vec2(-s, c) * (wander * a_corner.y);

  vec3 world = vec3(a_pos + across + lean, a_corner.y * height);
  gl_Position = u_matrix * vec4(world, 1.0);
}
`;

export const FUNNEL_FRAG = `#version 300 es
precision highp float;
precision highp sampler3D;

in vec2  v_uv;
in vec4  v_style;     // opacity, darkness, debris, wobble
in vec4  v_life;      // seed, reach, spin, baseRadius
in vec2  v_extra;     // X, bend
in float v_intensity;
in float v_tilt;

uniform sampler3D u_noise;
uniform float u_time;
uniform vec3  u_cloud;    // cloud-base colour, from the solar grade
uniform vec3  u_sun;      // unit vector toward the sun, in billboard space
uniform float u_flash;
uniform float u_steps;    // march steps; lowered by the performance preset

out vec4 fragColor;
${RADII}


/** How far the column is displaced sideways at height y — it is never straight. */
float bendX(float bend, float y, float t) {
  return bend * sin(y * 3.1 + t * 0.5) * y * (1.0 - y) * 4.0;
}


/** Optical density at a point in the funnel's local space, plus the noise there. */
float density(vec3 p, float rb, float rt, float rc, float bend, float spin,
              float debris, out float n) {
  float y = p.y;
  p.x -= bendX(bend, y, u_time);
  float r  = length(p.xz);
  float rcore = rCore(rb, rt, y);
  float ang = atan(p.z, p.x);

  /*
   * The rotation, and why the angle rises with height.
   *
   * Condensation is being wound up as it rises, not merely spun, so the phase
   * has to advance with y as well as with time. That is what produces the
   * helical striations you see on a real funnel rather than a column that
   * turns like a drill bit.
   */
  float a = u_time * spin * 1.3 + y * 2.6;
  float cs = cos(a), sn = sin(a);
  vec2 q = mat2(cs, sn, -sn, cs) * p.xz;

  /*
   * The noise is sampled in a space normalised to the funnel, not to the
   * world, so an EF5 wedge and an EF0 rope carry the same amount of detail
   * rather than the wedge looking smooth because it is bigger.
   *
   * The frequencies here are the difference between a tornado and a grey
   * pipe. The first version sampled at 0.22 of this, which spans less than
   * one tile of the texture across the whole column — the funnel came out
   * perfectly smooth, because there was no detail in range to see.
   */
  vec2 qn = q / max(rb, 0.012);
  vec3 c1 = vec3(qn * 0.85, y * 3.4 - u_time * spin * 0.55);
  vec4 t1 = texture(u_noise, c1);
  vec4 t2 = texture(u_noise, c1 * 2.9 + vec3(0.31, 0.17, 0.53));
  vec4 t3 = texture(u_noise, c1 * 7.3 + vec3(0.77, 0.12, 0.29));
  n = t1.r * 0.55 + t2.g * 0.30 + t3.b * 0.15;

  /*
   * Striations: bright and dark helices wrapped around the column.
   *
   * The single most recognisable thing about a tornado from a distance, and
   * the thing a noise field alone will not give you, because they are
   * structured rather than random.
   */
  float stria = sin(ang * 7.0 + a * 1.6 + n * 6.0) * 0.5 + 0.5;

  // --- the condensation body ------------------------------------------------
  // The edge is displaced by noise so the silhouette is ragged rather than a
  // machined cone, and the displacement grows with height where the funnel is
  // being torn apart by inflow.
  float ragged = rcore * (0.90 + 0.34 * (n - 0.5) * (0.5 + y * 1.3));
  // A tight edge. The silhouette is most of what reads at distance, and a
  // soft one is what made the first attempts look like fog.
  float body = smoothstep(ragged, ragged * 0.78, r);
  float d = body * (1.5 + 1.1 * n) * (0.80 + 0.40 * stria);

  // --- the debris bowl ------------------------------------------------------
  // Wider, browner, busier, and only near the ground, where the tornado is
  // actually lifting soil rather than condensing water.
  float g  = clamp((0.22 - y) / 0.22, 0.0, 1.0);
  float br = (rb * (1.15 + 0.9 * g) + 0.02) * (0.72 + 0.62 * t2.b);
  float bowl = smoothstep(br, br * 0.25, r) * g * g;
  d += bowl * (0.45 + 1.5 * n) * (0.45 + debris);

  /*
   * The lowered cloud base.
   *
   * A wall cloud is a wide, flat-bottomed, ragged shelf the funnel hangs out
   * of — not a mushroom cap sitting on a stick. So: a hard bottom edge, a
   * soft top, and a radius that does not taper much across its depth.
   */
  float k = smoothstep(0.78, 0.85, y);
  // Spreads with height: a shelf leaning out over the funnel, not a drum.
  float spread = 0.80 + 0.55 * smoothstep(0.78, 1.05, y);
  float wall = rc * spread * (0.82 + 0.34 * t2.r);
  d += k * smoothstep(wall, wall * 0.30, r) * (0.55 + 0.75 * n) * 1.05;

  return d;
}

void main() {
  float reach = v_life.y;
  float spin  = v_life.z;

  // Below the reach of the condensation there is nothing: a funnel that has
  // not touched down must not stand on the ground.
  float ground = 1.0 - reach;
  float yy = (v_uv.y - ground) / max(0.001, reach);
  if (yy < 0.0 || yy > 1.06) discard;

  /*
   * Everything below is in funnel heights, so x and y share a unit and the
   * column is not stretched. v_extra.x converts the quad's own [-1,1] back
   * into that space.
   */
  float X    = v_extra.x;
  float bend = v_extra.y;
  float rb   = v_life.w;
  float rt   = rb * 1.3 + 0.06;
  float rc   = min(rt * 1.9, rt + 0.20);

  float x = v_uv.x * X;
  float xx = x - bendX(bend, yy, u_time);
  float rm = rMax(rb, rt, rc, yy);
  if (abs(xx) >= rm) discard;

  // Analytic slab: where the view ray enters and leaves the bounding volume.
  float zh = sqrt(max(0.0, rm * rm - xx * xx));
  float steps = clamp(u_steps, 8.0, 32.0);
  float dt = 2.0 * zh / steps;

  /*
   * Dither the ray's start within one step.
   *
   * Without it the march lands on the same depths for every pixel and the
   * volume shows concentric banding — slices of the density field made
   * visible. Jittering turns that banding into fine grain, which reads as
   * atmosphere, and lets 24 steps look like 64.
   */
  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);

  /*
   * March from the near face toward the far one, not the other way.
   *
   * The compositing below is front-to-back — each sample is weighted by
   * (1 - alpha), the light still getting through everything already
   * accumulated. Marching back-to-front while compositing front-to-back makes
   * the FAR side of the column dominate, so the lit face and the shadowed face
   * average together and the funnel renders as a flat grey silhouette with no
   * form at all. That is what it was doing.
   *
   * +z is toward the camera, so the near face is +zh and the step is negative.
   */
  float z = zh - dt * dither;

  /*
   * The palette, and the floor under it.
   *
   * The sky's own light tints the funnel — a dusk funnel should look like a
   * dusk funnel — but only as a tint. Letting the sky set the level outright
   * made the funnel go nearly black at dusk and disappear into a dark map,
   * which is the wrong trade: this is a data display before it is a picture,
   * and a tornado you cannot see is not a rendering style.
   *
   * So the sky moves the hue and a little of the level; a floor keeps the
   * column readable on the darkest basemap at the darkest hour.
   */
  /*
   * The specified palette, exactly.
   *
   *   #4a3b2c  dark earth / debris, at the ground (y 0 .. 0.15)
   *   #2e343b  deep slate charcoal, the funnel's body
   *   #525b66  cloud grey, near the top
   *
   * These drifted lighter once, while fixing a separate problem — the funnel
   * going black against a dark basemap at dusk. That was the wrong lever. The
   * colours are the specification; the exposure is not, so the floor that
   * keeps the column readable now lives in the lighting term below, and the
   * sky only tints.
   */
  vec3 debrisCol = vec3(0.290, 0.231, 0.173);   // #4a3b2c
  vec3 slateCol  = vec3(0.180, 0.204, 0.231);   // #2e343b
  vec3 cloudCol  = vec3(0.322, 0.357, 0.400);   // #525b66
  // The sky tints, it does not set the level.
  vec3 skyTint   = max(u_cloud, vec3(0.34, 0.37, 0.42));
  slateCol = mix(slateCol, slateCol * skyTint * 2.4, 0.18);
  cloudCol = mix(cloudCol, cloudCol * skyTint * 2.4, 0.18);

  vec3  acc = vec3(0.0);
  float alpha = 0.0;
  float n;

  for (int i = 0; i < 32; i += 1) {
    if (float(i) >= steps) break;

    float d = density(vec3(x, yy, z), rb, rt, rc, bend, spin, v_style.z, n);

    if (d > 0.02) {
      // Beer-Lambert over the step, normalised by the funnel's own scale so a
      // wedge and a rope reach the same opacity for the same optical depth.
      // Beer-Lambert over the step, normalised by the funnel's own scale so a
      // wedge and a rope reach comparable opacity for the same optical depth.
      float al = 1.0 - exp(-d * dt / max(rb, 0.02) * 3.4);

      /*
       * The vertical colour ramp.
       *
       * Earth at the contact, the funnel's own slate through the body, and the
       * cloud base it hangs from at the top — and the wall cloud is the
       * DARKEST part of the frame, because it is a mile of water vapour with
       * no light getting through it. A funnel that gets brighter all the way
       * up reads as a searchlight.
       */
      // Earth at the contact through to Y = 0.15, then slate, then cloud grey
      // near the top — the ramp as specified.
      vec3 col = yy < 0.15
        ? mix(debrisCol, slateCol, smoothstep(0.02, 0.15, yy))
        : mix(slateCol, cloudCol, smoothstep(0.25, 0.80, yy));
      // The shelf is cloud lit from above, so it is the LIGHTEST thing here,
      // with the funnel reading darker beneath it. Darkening it instead — the
      // previous attempt — turned the top of every tornado into a black slab
      // that swallowed the funnel at map scale.
      col = mix(col, cloudCol * 1.18, smoothstep(0.74, 0.90, yy));

      /*
       * Lighting from the real sun.
       *
       * The sun's direction comes from the same solar model the sky is graded
       * with, so a funnel at dusk is lit from where the sun actually was. The
       * surface normal is the outward radial direction, which for a column is
       * the honest approximation — and it is what gives the funnel a lit side
       * and a dark side instead of reading as a flat silhouette.
       */
      vec2 nr = normalize(vec2(xx, z) + 1e-4);
      float lambert = 0.5 + 0.5 * dot(nr, u_sun.xy);
      // A wide swing between the lit and shadowed sides. This is what turns a
      // flat grey silhouette into a cylinder you can see the shape of, and it
      // is the single biggest difference between reading as an object and
      // reading as a smear.
      // The lit and shadowed sides, with a floor: even the shadow side of a
      // condensation funnel is lit by the sky all around it.
      /*
       * The lit and shadowed sides, and the exposure floor.
       *
       * This is where the column is kept readable on a dark basemap, rather
       * than by lightening the specified colours — which is what drifted last
       * time. The shadow side never falls below 0.78, because a real funnel is
       * lit by the whole sky rather than a point source and has no true
       * shadow; the lit side reaches 1.70. Against the app's darkest basemap
       * that puts even the dimmest part of the column several times brighter
       * than the ground it stands on.
       */
      col *= 0.78 + 0.92 * lambert;
      col *= 1.0 - v_style.y * 0.22;          // rating-driven darkness

      // The rim brightens where the column is optically thin, which is what
      // makes a condensation funnel read against a dark ground.
      // A thin bright rim where the column goes optically thin, which is what
      // separates condensation from the sky behind it. Small on purpose: it
      // accumulates over every step, so a value that looks modest per sample
      // washes the whole funnel out.
      col += vec3(0.055, 0.060, 0.068)
           * smoothstep(0.62, 1.18, length(vec2(xx, z)) / max(rCore(rb, rt, yy), 0.001));

      // Touchdown flash, at the ground contact only.
      col += u_flash * exp(-yy * 7.0) * 0.45;

      acc += (1.0 - alpha) * al * col;
      alpha += (1.0 - alpha) * al;

      // Early termination: nothing behind an opaque column can be seen.
      if (alpha > 0.98) break;
    }
    z -= dt;
  }

  if (alpha < 0.005) discard;

  /*
   * Premultiplied, and blended as such.
   *
   * The march accumulates '(1 - alpha) * step * colour', which is already
   * colour times coverage — that is what premultiplied means. Blending it with
   * SRC_ALPHA multiplies by coverage a second time and the funnel comes out
   * washed out and too dark at once, which is how the first attempt looked.
   * The layer pairs this with glBlendFunc(ONE, ONE_MINUS_SRC_ALPHA).
   *
   * The rating's own opacity and the lifecycle's intensity scale both together
   * so the premultiplication stays consistent.
   */
  /*
   * The lifecycle fades the funnel in and out; the rating does not.
   *
   * Scaling the finished alpha by the rating's own opacity was making every
   * funnel translucent — an EF3 at 0.75 can never look like a solid object.
   * Rating now shows in density, darkness and width, where it belongs, and
   * only the lifecycle's forming and roping fade touches the final alpha.
   */
  fragColor = vec4(acc * v_intensity, alpha * v_intensity);
}
`;
