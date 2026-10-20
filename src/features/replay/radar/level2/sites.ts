/**
 * The NEXRAD network: every WSR-88D's call sign, name and position.
 *
 * From the Iowa Environmental Mesonet's network table. Positions are to a
 * hundred metres or so, which is plenty for choosing the nearest radar; the
 * drawing itself uses the position each volume reports for its own antenna,
 * where the volume carries one (every one since 2008 does).
 */
export interface Site {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
}

type Row = [string, string, string, number, number];

const ROWS: readonly Row[] = [
  ["KABR", "Aberdeen", "SD", 45.456, -98.413],
  ["KABX", "Albuquerque", "NM", 35.15, -106.824],
  ["KAKQ", "Wakefield", "VA", 36.984, -77.008],
  ["KAMA", "Amarillo", "TX", 35.233, -101.709],
  ["KAMX", "Miami", "FL", 25.611, -80.413],
  ["KAPX", "Gaylord", "MI", 44.906, -84.72],
  ["KARX", "La Crosse", "WI", 43.823, -91.191],
  ["KATX", "Seattle/Tacoma", "WA", 48.195, -122.496],
  ["KBBX", "Beale AFB", "CA", 39.496, -121.632],
  ["KBGM", "Binghamton", "NY", 42.2, -75.985],
  ["KBHX", "Eureka", "CA", 40.499, -124.292],
  ["KBIS", "Bismarck", "ND", 46.771, -100.76],
  ["KBLX", "Billings", "MT", 45.854, -108.607],
  ["KBMX", "Birmingham", "AL", 33.172, -86.77],
  ["KBOX", "Boston", "MA", 41.956, -71.137],
  ["KBRO", "Brownsville", "TX", 25.916, -97.419],
  ["KBUF", "Buffalo", "NY", 42.949, -78.737],
  ["KBYX", "Key West", "FL", 24.597, -81.703],
  ["KCAE", "Columbia", "SC", 33.949, -81.119],
  ["KCBW", "Caribou", "ME", 46.039, -67.806],
  ["KCBX", "Boise", "ID", 43.49, -116.236],
  ["KCCX", "State College", "PA", 40.923, -78.004],
  ["KCLE", "Cleveland", "OH", 41.413, -81.86],
  ["KCLX", "Charleston", "SC", 32.655, -81.042],
  ["KCRP", "Corpus Christi", "TX", 27.784, -97.511],
  ["KCXX", "Burlington", "VT", 44.511, -73.166],
  ["KCYS", "Cheyenne", "WY", 41.152, -104.806],
  ["KDAX", "Sacramento", "CA", 38.501, -121.678],
  ["KDDC", "Dodge City", "KS", 37.761, -99.969],
  ["KDFX", "Laughlin AFB", "TX", 29.273, -100.28],
  ["KDGX", "Jackson", "MS", 32.28, -89.984],
  ["KDIX", "Philadelphia", "NJ", 39.947, -74.411],
  ["KDLH", "Duluth", "MN", 46.837, -92.21],
  ["KDMX", "Des Moines", "IA", 41.731, -93.723],
  ["KDOX", "Dover AFB", "DE", 38.826, -75.44],
  ["KDTX", "Detroit", "MI", 42.7, -83.472],
  ["KDVN", "Quad Cities", "IA", 41.612, -90.581],
  ["KDYX", "Dyess AFB", "TX", 32.538, -99.254],
  ["KEAX", "Kansas City", "MO", 38.81, -94.264],
  ["KEMX", "Tucson", "AZ", 31.894, -110.63],
  ["KENX", "Albany", "NY", 42.586, -74.064],
  ["KEOX", "Fort Rucker", "AL", 31.46, -85.459],
  ["KEPZ", "El Paso", "TX", 31.873, -106.698],
  ["KESX", "Las Vegas", "NV", 35.701, -114.891],
  ["KEVX", "Eglin AFB", "FL", 30.565, -85.922],
  ["KEWX", "San Antonio", "TX", 29.704, -98.029],
  ["KEYX", "Edwards AFB", "CA", 35.098, -117.561],
  ["KFCX", "Blacksburg", "VA", 37.024, -80.274],
  ["KFDR", "Frederick", "OK", 34.362, -98.977],
  ["KFDX", "Cannon AFB", "NM", 34.634, -103.619],
  ["KFFC", "Atlanta", "GA", 33.363, -84.566],
  ["KFSD", "Sioux Falls", "SD", 43.588, -96.729],
  ["KFSX", "Flagstaff", "AZ", 34.574, -111.198],
  ["KFTG", "Denver/Boulder", "CO", 39.787, -104.546],
  ["KFWS", "Dallas/Fort Worth", "TX", 32.573, -97.303],
  ["KGGW", "Glasgow", "MT", 48.206, -106.625],
  ["KGJX", "Grand Junction", "CO", 39.062, -108.214],
  ["KGLD", "Goodland", "KS", 39.367, -101.7],
  ["KGRB", "Green Bay", "WI", 44.499, -88.111],
  ["KGRK", "Central Texas", "TX", 30.722, -97.383],
  ["KGRR", "Grand Rapids", "MI", 42.894, -85.545],
  ["KGSP", "Greer", "SC", 34.883, -82.22],
  ["KGWX", "Columbus AFB", "MS", 33.897, -88.329],
  ["KGYX", "Portland", "ME", 43.891, -70.256],
  ["KHDC", "Hammond", "LA", 30.519, -90.407],
  ["KHDX", "Holloman AFB", "NM", 33.077, -106.12],
  ["KHGX", "Houston", "TX", 29.472, -95.079],
  ["KHNX", "San Joaquin Valley", "CA", 36.314, -119.632],
  ["KHPX", "Fort Campbell", "KY", 36.737, -87.285],
  ["KHTX", "Huntsville", "AL", 34.931, -86.084],
  ["KICT", "Wichita", "KS", 37.654, -97.443],
  ["KICX", "Cedar City", "UT", 37.591, -112.862],
  ["KILN", "Wilmington", "OH", 39.42, -83.822],
  ["KILX", "Lincoln", "IL", 40.15, -89.337],
  ["KIND", "Indianapolis", "IN", 39.708, -86.28],
  ["KINX", "Tulsa", "OK", 36.175, -95.564],
  ["KIWA", "Phoenix", "AZ", 33.289, -111.67],
  ["KIWX", "Fort Wayne", "IN", 41.359, -85.7],
  ["KJAX", "Jacksonville", "FL", 30.485, -81.702],
  ["KJGX", "Robins AFB", "GA", 32.675, -83.351],
  ["KJKL", "Jackson", "KY", 37.591, -83.313],
  ["KLBB", "Lubbock", "TX", 33.654, -101.814],
  ["KLCH", "Lake Charles", "LA", 30.125, -93.216],
  ["KLGX", "Langley Hill", "WA", 47.116, -124.107],
  ["KLIX", "New Orleans", "LA", 30.337, -89.825],
  ["KLNX", "North Platte", "NE", 41.958, -100.576],
  ["KLOT", "Chicago", "IL", 41.604, -88.085],
  ["KLRX", "Elko", "NV", 40.74, -116.803],
  ["KLSX", "St. Louis", "MO", 38.699, -90.683],
  ["KLTX", "Wilmington", "NC", 33.989, -78.429],
  ["KLVX", "Louisville", "KY", 37.975, -85.944],
  ["KLWX", "Sterling", "MD", 38.976, -77.487],
  ["KLZK", "Little Rock", "AR", 34.836, -92.262],
  ["KMAF", "Midland/Odessa", "TX", 31.943, -102.189],
  ["KMAX", "Medford", "OR", 42.081, -122.717],
  ["KMBX", "Minot AFB", "ND", 48.393, -100.864],
  ["KMHX", "Morehead City", "NC", 34.776, -76.876],
  ["KMKX", "Milwaukee/Sullivan", "WI", 42.968, -88.551],
  ["KMLB", "Melbourne", "FL", 28.113, -80.654],
  ["KMOB", "Mobile", "AL", 30.679, -88.24],
  ["KMPX", "Minneapolis", "MN", 44.849, -93.565],
  ["KMQT", "Marquette", "MI", 46.531, -87.548],
  ["KMRX", "Knoxville", "TN", 36.168, -83.402],
  ["KMSX", "Missoula", "MT", 47.041, -113.986],
  ["KMTX", "Salt Lake City", "UT", 41.263, -112.448],
  ["KMUX", "San Francisco", "CA", 37.155, -121.898],
  ["KMVX", "Grand Forks", "ND", 47.528, -97.325],
  ["KMXX", "Maxwell AFB", "AL", 32.537, -85.79],
  ["KNKX", "San Diego", "CA", 32.919, -117.042],
  ["KNQA", "Memphis", "TN", 35.345, -89.873],
  ["KOAX", "Omaha", "NE", 41.32, -96.367],
  ["KOHX", "Nashville", "TN", 36.247, -86.563],
  ["KOKX", "Upton", "NY", 40.865, -72.864],
  ["KOTX", "Spokane", "WA", 47.681, -117.626],
  ["KPAH", "Paducah", "KY", 37.068, -88.772],
  ["KPBZ", "Pittsburgh", "PA", 40.532, -80.218],
  ["KPDT", "Pendleton", "OR", 45.691, -118.853],
  ["KPOE", "Fort Polk", "LA", 31.155, -92.976],
  ["KPUX", "Pueblo", "CO", 38.46, -104.181],
  ["KRAX", "Raleigh/Durham", "NC", 35.665, -78.49],
  ["KRGX", "Reno", "NV", 39.754, -119.462],
  ["KRIW", "Riverton", "WY", 43.066, -108.477],
  ["KRLX", "Charleston", "WV", 38.311, -81.723],
  ["KRTX", "Portland", "OR", 45.715, -122.965],
  ["KSFX", "Pocatello", "ID", 43.106, -112.686],
  ["KSGF", "Springfield", "MO", 37.235, -93.4],
  ["KSHV", "Shreveport", "LA", 32.451, -93.841],
  ["KSJT", "San Angelo", "TX", 31.371, -100.492],
  ["KSOX", "Santa Ana Mountains", "CA", 33.818, -117.636],
  ["KSRX", "Fort Smith", "AR", 35.29, -94.362],
  ["KTBW", "Tampa", "FL", 27.705, -82.402],
  ["KTFX", "Great Falls", "MT", 47.46, -111.385],
  ["KTLH", "Tallahassee", "FL", 30.398, -84.329],
  ["KTLX", "Oklahoma City", "OK", 35.333, -97.278],
  ["KTWX", "Topeka", "KS", 38.997, -96.232],
  ["KTYX", "Montague", "NY", 43.756, -75.68],
  ["KUDX", "Rapid City", "SD", 44.125, -102.83],
  ["KUEX", "Hastings", "NE", 40.321, -98.442],
  ["KVAX", "Moody AFB", "GA", 30.89, -83.002],
  ["KVBX", "Vandenberg AFB", "CA", 34.839, -120.398],
  ["KVNX", "Vance AFB", "OK", 36.741, -98.128],
  ["KVTX", "Los Angeles", "CA", 34.412, -119.179],
  ["KVWX", "Evansville", "IN", 38.26, -87.724],
  ["KYUX", "Yuma", "AZ", 32.495, -114.656],
  ["PABC", "Bethel", "AK", 60.78, -161.87],
  ["PACG", "Biorka Island", "AK", 56.85, -135.52],
  ["PAEC", "Nome", "AK", 64.5, -165.28],
  ["PAHG", "Kenai", "AK", 60.72, -151.35],
  ["PAIH", "Middleton Island", "AK", 59.45, -146.3],
  ["PAKC", "King Salmon", "AK", 58.67, -156.62],
  ["PAPD", "Pedro Dome", "AK", 65.03, -147.5],
  ["PGUA", "Andersen AFB", "GU", 13.45, 144.8],
  ["PHKI", "Kauai", "HI", 21.88, -159.55],
  ["PHKM", "Kohala", "HI", 20.12, -155.77],
  ["PHMO", "Molokai", "HI", 21.12, -157.17],
  ["PHWA", "South Shore", "HI", 19.08, -155.57],
  ["TJUA", "Puerto Rico", "PR", 18.1, -66.07],
];

export const SITES: readonly Site[] = ROWS.map(
  ([id, name, state, lat, lon]) => ({ id, name, state, lat, lon }),
);

const R = 6371.0088;

/** Great-circle kilometres. */
export function kmBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const p1 = (lat1 * Math.PI) / 180,
    p2 = (lat2 * Math.PI) / 180;
  const dp = p2 - p1,
    dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface NearSite extends Site {
  km: number;
}

/** The `n` radars nearest a point, nearest first. */
export function nearestSites(lat: number, lon: number, n = 4): NearSite[] {
  return SITES.map((s) => ({ ...s, km: kmBetween(lat, lon, s.lat, s.lon) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n);
}

export const siteById = (id: string): Site | undefined =>
  SITES.find((s) => s.id === id);
