/**
 * The Weather Slider's photos: NOAA and NASA images (public domain), resized to WebP in
 * public/extras/slides. Each slide says what you're looking at and why it matters.
 */
export type Slide = {
  name: string;
  line: string;
  about: string;
  src: string;
  credit: string;
  page: string;
};

const nasa = (id: string) => `https://images.nasa.gov/details/${id}`;
const commons = (file: string) =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replaceAll(" ", "_"))}`;

export const SLIDES: Slide[] = [
  {
    name: "Supercell",
    line: "Kansas",
    about:
      "A supercell: a thunderstorm whose updraft rotates. The rotation is what lets it last for hours and make the biggest hail and the strongest tornadoes.",
    src: "/extras/slides/supercell.webp",
    credit: "NOAA National Severe Storms Laboratory",
    page: commons("Supercell-thunderstorm-in-Kansas.jpg"),
  },
  {
    name: "Mothership",
    line: "Supercell structure",
    about:
      "The stacked, striated look chasers call a mothership. The bands are the rotating updraft drawing air in from all sides; the whole cloud is turning.",
    src: "/extras/slides/mothership.webp",
    credit: "Sean Waugh, NOAA/NSSL",
    page: commons("Nssl0225 - Flickr - NOAA Photo Library.jpg"),
  },
  {
    name: "Shelf cloud",
    line: "The gust front arriving",
    about:
      "A shelf cloud forms where a storm's rain-cooled outflow undercuts warm, moist air and lifts it. It looks menacing but rarely rotates: the danger is the straight-line wind right behind it.",
    src: "/extras/slides/shelf.webp",
    credit: "NOAA National Severe Storms Laboratory",
    page: commons("Nssl0389 - Flickr - NOAA Photo Library.jpg"),
  },
  {
    name: "Wall cloud",
    line: "Under the updraft",
    about:
      "A wall cloud is a lowering under a storm's rain-free base, where the updraft pulls in moist air. A wall cloud that rotates, with fast upward motion, is where tornadoes form.",
    src: "/extras/slides/wall-cloud.webp",
    credit: "NOAA",
    page: commons("Wall cloud12 - NOAA.jpg"),
  },
  {
    name: "Tornado",
    line: "Over the Kansas plains",
    about:
      "A violently rotating column of air in contact with the ground. The funnel is condensation; the wind reaches the ground whether the funnel does or not.",
    src: "/extras/slides/tornado.webp",
    credit: "Sean Waugh, NOAA/NSSL",
    page: commons(
      "Tornado over the Kansas plains (Nssl0232 - Flickr - NOAA Photo Library).jpg",
    ),
  },
  {
    name: "Funnel",
    line: "Touching down",
    about:
      "A funnel lowering from the storm base. When debris swirls at the ground beneath it, it is a tornado, even if the funnel hasn't reached the ground yet.",
    src: "/extras/slides/funnel.webp",
    credit: "NOAA National Severe Storms Laboratory",
    page: commons("NOAA Tornado, 2010.jpg"),
  },
  {
    name: "Lightning",
    line: "Cloud to ground",
    about:
      "A single stroke heats the air to about 50,000 °F, five times hotter than the surface of the Sun. The thunder is that air exploding outward.",
    src: "/extras/slides/lightning-bolt.webp",
    credit: "C. Clark, NOAA",
    page: commons("Lightning NOAA.jpg"),
  },
  {
    name: "Towering cumulonimbus",
    line: "Cape Canaveral, August 2014",
    about:
      "Thunderstorm towers boiling up over the Atlantic at sunrise. Each bubble is an updraft punching higher; once the tops freeze and spread, the cloud is a cumulonimbus.",
    src: "/extras/slides/cumulonimbus.webp",
    credit: "NASA/Jim Grossmann",
    page: nasa("KSC-2014-3582"),
  },
  {
    name: "Lightning from space",
    line: "Tropical Storm Erick, from the Space Station",
    about:
      "Lightning lighting up a tropical storm's cloud tops from above. Bursts like this near the center can mean a storm is strengthening.",
    src: "/extras/slides/lightning-space.webp",
    credit: "NASA",
    page: nasa("iss073e0330134"),
  },
  {
    name: "Hurricane",
    line: "Hurricane Igor, from the Space Station, 2010",
    about:
      "A mature hurricane: bands spiralling into a tight center. Igor's winds were near 130 mph when this was taken, about 650 miles east of the Lesser Antilles.",
    src: "/extras/slides/hurricane.webp",
    credit: "NASA",
    page: nasa("iss024e014559"),
  },
  {
    name: "The eye",
    line: "Supertyphoon Yuri, from the Space Shuttle, 1991",
    about:
      "Looking straight down the eye of a super typhoon. The eyewall slopes outward like a stadium, nearly ten miles deep, around calm air that sinks and dries out.",
    src: "/extras/slides/eye.webp",
    credit: "NASA",
    page: nasa("s44-93-080"),
  },
];
