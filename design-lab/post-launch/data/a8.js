/* A8: 5 new Randoms for Extras, each playable live in the lab (demos/randoms.js). */
(window.PL = window.PL || {}).a8 = {
  title: "5 new Randoms",
  intro:
    "Five new toys for the Randoms tab, each one playable right here. They join the 13 we have without repeating any (and not Plasma Globe, which you passed on). In the app each gets the usual Stage (paused off screen), lighter settings on slow phones, a still frame with Reduce Motion, and an admin switch.",
  items: [
    {
      id: "bolt", tag: "Touch to strike", title: "Lightning Sculptor",
      what: "Touch anywhere and a lightning bolt searches its way down from the clouds to your finger, branching as it goes, then the return stroke flashes and the channel glows and fades. Drag to steer the next one.",
      pros: ["Instantly fun, works with one tap", "Branching follows how real stepped leaders grow"],
      cons: ["Bright flashes: a softer flash with Reduce Motion"],
      effort: "Small", impact: 5,
    },
    {
      id: "flake", tag: "Grow your own", title: "Snowflake Forge",
      what: "Grow a snowflake crystal live. Two sliders set the temperature and humidity of the cloud, and the crystal grows the shape real ice does there (the Nakaya diagram): thin plates, needles, or wild branching dendrites. Every flake is one of a kind and can be saved as an image.",
      pros: ["Beautiful and educational at once", "Shareable: 'here's my snowflake'"],
      cons: ["Calm rather than action-packed"],
      effort: "Small", impact: 4,
    },
    {
      id: "glass", tag: "Rainy window", title: "Rain on Glass",
      what: "A rainy window at night with the city lights blurred behind it. Drops land, bead up, merge and race down leaving trails, each one bending the lights like a tiny lens. Tap to make it pour.",
      pros: ["Deeply relaxing, the kind of thing people leave running", "Very realistic for its size"],
      cons: ["The lens effect is the heaviest part (fewer drops on slow phones)"],
      effort: "Small", impact: 4,
    },
    {
      id: "aurora", tag: "Paint the sky", title: "Aurora Painter",
      what: "Drag across a starry night sky above the mountains and paint your own northern lights: green curtains with purple tops that ripple and fade, the way real aurora arcs fold and drift.",
      pros: ["Gorgeous with almost no instructions", "Pairs with Aurora Center"],
      cons: ["Needs a dark room to look its best (like the real thing)"],
      effort: "Small", impact: 4,
    },
    {
      id: "doppler", tag: "How radar sees wind", title: "Doppler Playground",
      what: "Drag a storm around and watch its waves bunch up in front and stretch out behind. A radar on the side reads the storm as coming toward it (green) or going away (red), exactly how velocity radar sees rotation. A quiet lesson in why a red and green couplet means a tornado.",
      pros: ["Teaches the most important radar idea in seconds", "Fun to fling"],
      cons: ["More of a lesson than the other four"],
      effort: "Small", impact: 3,
    },
  ],
};
