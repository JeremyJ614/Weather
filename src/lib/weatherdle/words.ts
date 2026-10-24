/**
 * Weatherdle's own word list: the fallback when Gemini can't answer, and the guard on what
 * it suggests (`checkWord`). Every word is weather or severe weather, 3 to 14 letters.
 */
export type WordPick = { word: string; hint: string };

export const WORDS: WordPick[] = [
  {
    word: "TORNADO",
    hint: "A violently rotating column of air touching the ground.",
  },
  { word: "SUPERCELL", hint: "A thunderstorm with a deep, rotating updraft." },
  {
    word: "DERECHO",
    hint: "A long-lived, widespread windstorm from a line of storms.",
  },
  { word: "HAIL", hint: "Balls of ice that grow inside strong updrafts." },
  {
    word: "MESOCYCLONE",
    hint: "The rotating updraft at the heart of a supercell.",
  },
  {
    word: "WALLCLOUD",
    hint: "A lowering under a storm's rain-free base where tornadoes may form.",
  },
  {
    word: "SHELFCLOUD",
    hint: "A wedge-shaped cloud on the leading edge of a gust front.",
  },
  {
    word: "DOWNBURST",
    hint: "A sudden, strong blast of air rushing down out of a storm.",
  },
  {
    word: "MICROBURST",
    hint: "A small, intense blast of sinking air, under 2.5 miles across.",
  },
  {
    word: "LIGHTNING",
    hint: "An electrical discharge inside or below a storm.",
  },
  { word: "THUNDER", hint: "The sound of air heated explosively by a flash." },
  {
    word: "HURRICANE",
    hint: "A tropical cyclone with winds of at least 74 mph in the Atlantic.",
  },
  {
    word: "TYPHOON",
    hint: "The western Pacific's name for the strongest tropical cyclones.",
  },
  {
    word: "CYCLONE",
    hint: "Any large system of winds turning around low pressure.",
  },
  {
    word: "BLIZZARD",
    hint: "Blowing snow, strong wind and visibility under a quarter mile for hours.",
  },
  {
    word: "SQUALL",
    hint: "A sudden, sharp jump in wind speed that lasts a minute or more.",
  },
  {
    word: "GUSTNADO",
    hint: "A brief, shallow whirl along a gust front, not tied to the storm's updraft.",
  },
  {
    word: "LANDSPOUT",
    hint: "A tornado that grows from the ground up under a building cloud, not a supercell.",
  },
  { word: "WATERSPOUT", hint: "A rotating column of air over water." },
  {
    word: "FUNNEL",
    hint: "A rotating cloud extending from the base that hasn't reached the ground.",
  },
  { word: "UPDRAFT", hint: "Rising air that feeds a storm." },
  { word: "DOWNDRAFT", hint: "Sinking, rain-cooled air in a storm." },
  { word: "ANVIL", hint: "The flat, spreading top of a mature thunderstorm." },
  {
    word: "MAMMATUS",
    hint: "Pouch-like clouds hanging under a storm's flat top.",
  },
  { word: "CUMULONIMBUS", hint: "The towering cloud that makes thunder." },
  { word: "CUMULUS", hint: "A puffy fair-weather cloud with a flat base." },
  { word: "STRATUS", hint: "A flat, gray, featureless layer of low cloud." },
  { word: "CIRRUS", hint: "Thin, wispy ice clouds high in the sky." },
  {
    word: "NIMBOSTRATUS",
    hint: "A thick, dark layer of cloud bringing steady rain.",
  },
  {
    word: "ALTOCUMULUS",
    hint: "Mid-level clouds in rows or patches, often called a mackerel sky.",
  },
  { word: "SHEAR", hint: "Wind changing speed or direction with height." },
  {
    word: "HELICITY",
    hint: "How much the wind twists with height, fuel for rotating storms.",
  },
  {
    word: "INSTABILITY",
    hint: "When a lifted parcel of air keeps rising on its own.",
  },
  { word: "INVERSION", hint: "A layer where temperature rises with height." },
  {
    word: "CAPPING",
    hint: "A warm layer aloft that holds storms down until it breaks.",
  },
  {
    word: "DRYLINE",
    hint: "The boundary between moist Gulf air and dry desert air on the Plains.",
  },
  {
    word: "OUTFLOW",
    hint: "Cool air spreading out along the ground from a storm.",
  },
  {
    word: "BOUNDARY",
    hint: "Any line where two air masses meet; storms love to form on one.",
  },
  { word: "FRONT", hint: "The leading edge of a different air mass." },
  {
    word: "OCCLUSION",
    hint: "When a cold front catches up with a warm front.",
  },
  { word: "JETSTREAM", hint: "A river of fast wind high in the atmosphere." },
  { word: "TROUGH", hint: "A dip in the flow aloft that often brings storms." },
  {
    word: "RIDGE",
    hint: "A bulge of high pressure aloft that brings fair, warm weather.",
  },
  { word: "BAROMETER", hint: "The instrument that measures air pressure." },
  { word: "PRESSURE", hint: "The weight of the air above you." },
  { word: "HUMIDITY", hint: "How much water vapor the air holds." },
  {
    word: "DEWPOINT",
    hint: "The temperature air must cool to before it's saturated.",
  },
  {
    word: "MONSOON",
    hint: "A seasonal wind shift that brings a rainy season.",
  },
  { word: "DROUGHT", hint: "A long stretch with far too little rain." },
  { word: "FLOOD", hint: "Water rising over normally dry land." },
  {
    word: "FLASHFLOOD",
    hint: "Water rising fast, within hours of heavy rain.",
  },
  { word: "DELUGE", hint: "A sudden, overwhelming downpour." },
  { word: "DOWNPOUR", hint: "Very heavy rain falling all at once." },
  { word: "DRIZZLE", hint: "Very small raindrops falling close together." },
  {
    word: "SLEET",
    hint: "Raindrops that freeze into ice pellets before landing.",
  },
  { word: "GRAUPEL", hint: "Soft, snowy pellets of rimed ice." },
  {
    word: "FREEZINGRAIN",
    hint: "Rain that freezes on contact with cold surfaces.",
  },
  {
    word: "SNOWSQUALL",
    hint: "A short, intense burst of snow and wind that drops visibility to nothing.",
  },
  { word: "WHITEOUT", hint: "When blowing snow erases the horizon." },
  {
    word: "NOREASTER",
    hint: "A coastal storm whose strongest winds blow in from that direction.",
  },
  { word: "SNOWFALL", hint: "How much snow comes down over a period." },
  {
    word: "FROST",
    hint: "Ice crystals that form on surfaces on a clear, cold night.",
  },
  {
    word: "RIME",
    hint: "Feathery ice from supercooled fog freezing on contact.",
  },
  { word: "FOG", hint: "A cloud at ground level." },
  { word: "HAZE", hint: "Fine particles that soften the view." },
  {
    word: "SMOKE",
    hint: "What wildfires send downwind for hundreds of miles.",
  },
  { word: "WILDFIRE", hint: "An uncontrolled fire in brush, grass or forest." },
  { word: "PYROCUMULUS", hint: "A cloud built by the heat of a fire." },
  { word: "HEATWAVE", hint: "A stretch of dangerously hot days." },
  {
    word: "HEATBURST",
    hint: "A rare, sudden rush of hot, dry wind from a collapsing storm at night.",
  },
  { word: "WINDCHILL", hint: "How cold the wind makes it feel on skin." },
  {
    word: "HEATINDEX",
    hint: "How hot it feels when humidity is added to the temperature.",
  },
  { word: "RAINBOW", hint: "Sunlight split into colors by raindrops." },
  { word: "HALO", hint: "A ring around the sun or moon from ice crystals." },
  {
    word: "SUNDOG",
    hint: "A bright spot beside the sun from plate-shaped ice crystals.",
  },
  {
    word: "AURORA",
    hint: "Curtains of light from the solar wind meeting the upper air.",
  },
  { word: "VIRGA", hint: "Rain that evaporates before reaching the ground." },
  { word: "HABOOB", hint: "A wall of dust pushed ahead of a storm's outflow." },
  {
    word: "DUSTSTORM",
    hint: "Strong wind lifting soil and dust into a thick cloud.",
  },
  {
    word: "CHINOOK",
    hint: "A warm, dry wind racing down the lee of the Rockies.",
  },
  { word: "SANTAANA", hint: "Hot, dry offshore winds of Southern California." },
  { word: "GALE", hint: "A strong wind of 39 to 54 mph." },
  {
    word: "STORMSURGE",
    hint: "Ocean water pushed ashore by a hurricane's winds.",
  },
  {
    word: "EYEWALL",
    hint: "The ring of fiercest winds around a hurricane's center.",
  },
  {
    word: "RAINBAND",
    hint: "A curved line of showers spiraling into a tropical storm.",
  },
  {
    word: "RADAR",
    hint: "Sends out pulses and listens for what bounces back from rain.",
  },
  {
    word: "DOPPLER",
    hint: "The shift that lets radar measure motion toward or away.",
  },
  { word: "HOOKECHO", hint: "The radar curl that marks a rotating storm." },
  {
    word: "COUPLET",
    hint: "Side-by-side inbound and outbound winds on velocity radar.",
  },
  {
    word: "DEBRISBALL",
    hint: "A radar signature of things lofted by a tornado.",
  },
  {
    word: "BOWECHO",
    hint: "A curved line of storms on radar known for damaging winds.",
  },
  {
    word: "SQUALLLINE",
    hint: "A long line of thunderstorms marching together.",
  },
  { word: "WATCH", hint: "Conditions are favorable; be ready." },
  { word: "WARNING", hint: "It's happening or about to: act now." },
  {
    word: "OUTLOOK",
    hint: "The Storm Prediction Center's forecast of risk days ahead.",
  },
  {
    word: "SOUNDING",
    hint: "A balloon's profile of the atmosphere from the ground up.",
  },
  { word: "HODOGRAPH", hint: "A plot of how wind changes with height." },
  {
    word: "SKEWT",
    hint: "The slanted chart meteorologists read soundings on.",
  },
  { word: "FORECAST", hint: "A prediction of the weather to come." },
  { word: "CLIMATE", hint: "The long-term average of weather." },
  {
    word: "ELNINO",
    hint: "Warm water in the eastern Pacific that shifts weather worldwide.",
  },
  {
    word: "LANINA",
    hint: "Cool water in the eastern Pacific, El Niño's opposite.",
  },
  { word: "ISOBAR", hint: "A line joining places of equal pressure." },
  { word: "CONVECTION", hint: "Warm air rising and carrying heat upward." },
  { word: "CONDENSATION", hint: "Vapor turning into liquid droplets." },
  { word: "EVAPORATION", hint: "Liquid water turning into vapor." },
  { word: "PRECIPITATION", hint: "Any water falling from the sky." },
  {
    word: "OVERSHOOT",
    hint: "A dome punching above a storm's flat top: a sign of a strong updraft.",
  },
  { word: "INFLOW", hint: "Warm, moist air streaming into a storm." },
  {
    word: "REARFLANK",
    hint: "The side of a supercell where a drying downdraft wraps around.",
  },
  { word: "WEDGE", hint: "A tornado wider than it is tall." },
  { word: "ROPE", hint: "A thin, twisting tornado, often in its last stage." },
  {
    word: "MULTIVORTEX",
    hint: "A tornado with several smaller whirls inside it.",
  },
  { word: "CHASER", hint: "Someone who drives toward storms to see them." },
  {
    word: "SPOTTER",
    hint: "A trained volunteer who reports storms to the Weather Service.",
  },
  { word: "SHELTER", hint: "Where to go when a tornado warning is issued." },
  { word: "SIREN", hint: "The outdoor horn sounded in a warning." },
  { word: "THUNDERSNOW", hint: "Snowfall with thunder and lightning." },
  {
    word: "ICESTORM",
    hint: "A storm that glazes everything in a heavy coat of ice.",
  },
  { word: "COLDWAVE", hint: "A sudden, deep drop into bitter cold." },
  { word: "POLARVORTEX", hint: "The big pool of cold air circling the pole." },
  {
    word: "SUBTROPICAL",
    hint: "A storm with traits of both tropical and mid-latitude systems.",
  },
];

/** A word Weatherdle can use: letters only, 3 to 14, and a hint that doesn't give it away. */
export function checkWord(raw: unknown, hint: unknown): WordPick | null {
  const word = String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  const h = String(hint ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  if (word.length < 3 || word.length > 14 || h.length < 4) return null;
  // A hint naming the word (even split across a space) gives the game away.
  if (
    h
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .includes(word)
  )
    return null;
  return { word, hint: h };
}
