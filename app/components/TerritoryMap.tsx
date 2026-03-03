"use client";
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// ── City coordinates — target territories ─────────────────────────────────────
const CITY_COORDS: Record<string, [number, number]> = {
  // Coachella Valley
  "Palm Springs":        [33.8303, -116.5453],
  "Palm Desert":         [33.7225, -116.3745],
  "Rancho Mirage":       [33.7395, -116.4106],
  "Cathedral City":      [33.7797, -116.4653],
  "Indio":               [33.7206, -116.2156],
  "La Quinta":           [33.6634, -116.3100],
  "Desert Hot Springs":  [33.9614, -116.5019],
  "Coachella":           [33.6803, -116.1739],
  "Thousand Palms":      [33.8208, -116.3939],
  "Bermuda Dunes":       [33.7450, -116.2917],

  // LA County
  "Los Angeles":         [34.0522, -118.2437],
  "Long Beach":          [33.7701, -118.1937],
  "Glendale":            [34.1425, -118.2551],
  "Santa Clarita":       [34.3917, -118.5426],
  "Lancaster":           [34.6868, -118.1542],
  "Palmdale":            [34.5794, -118.1165],
  "Pomona":              [34.0551, -117.7500],
  "Torrance":            [33.8358, -118.3406],
  "Pasadena":            [34.1478, -118.1445],
  "El Monte":            [34.0686, -118.0276],
  "Downey":              [33.9401, -118.1326],
  "Inglewood":           [33.9617, -118.3531],
  "West Covina":         [34.0686, -117.9390],
  "Norwalk":             [33.9022, -118.0817],
  "Burbank":             [34.1808, -118.3090],
  "Compton":             [33.8958, -118.2201],
  "South Gate":          [33.9547, -118.2120],
  "Carson":              [33.8317, -118.2823],
  "Santa Monica":        [34.0195, -118.4912],
  "Hawthorne":           [33.9164, -118.3526],
  "Whittier":            [33.9792, -118.0328],
  "Alhambra":            [34.0953, -118.1270],
  "Arcadia":             [34.1397, -118.0353],
  "Baldwin Park":        [34.0853, -117.9606],
  "Bellflower":          [33.8817, -118.1170],
  "Cerritos":            [33.8584, -118.0648],
  "Covina":              [34.0900, -117.8903],
  "Diamond Bar":         [34.0289, -117.8103],
  "Duarte":              [34.1395, -117.9773],
  "El Segundo":          [33.9192, -118.4165],
  "Gardena":             [33.8883, -118.3090],
  "Glendora":            [34.1361, -117.8653],
  "Hacienda Heights":    [34.0003, -117.9726],
  "La Mirada":           [33.9172, -117.9920],
  "La Puente":           [34.0203, -117.9487],
  "Lakewood":            [33.8536, -118.1178],
  "Lawndale":            [33.8875, -118.3531],
  "Lynwood":             [33.9303, -118.2120],
  "Manhattan Beach":     [33.8847, -118.4109],
  "Monrovia":            [34.1442, -117.9981],
  "Montebello":          [34.0153, -118.1137],
  "Monterey Park":       [34.0625, -118.1228],
  "Pico Rivera":         [33.9831, -118.0967],
  "Redondo Beach":       [33.8492, -118.3884],
  "Rosemead":            [34.0805, -118.0731],
  "San Gabriel":         [34.0961, -118.1059],
  "South Pasadena":      [34.1161, -118.1303],
  "Temple City":         [34.1047, -118.0573],
  "Van Nuys":            [34.1897, -118.4489],
  "Walnut":              [34.0206, -117.8659],
  "Azusa":               [34.1336, -117.9076],
  "Bell":                [33.9775, -118.1870],
  "Bell Gardens":        [33.9653, -118.1514],
  "Calabasas":           [34.1583, -118.6603],
  "Chatsworth":          [34.2569, -118.6031],
  "Claremont":           [34.0967, -117.7198],
  "Commerce":            [33.9964, -118.1609],
  "Culver City":         [34.0211, -118.3965],
  "Encino":              [34.1522, -118.5011],
  "Florence":            [33.9730, -118.2328],
  "Hawaiian Gardens":    [33.8325, -118.0717],
  "Hidden Hills":        [34.1648, -118.6664],
  "Huntington Park":     [33.9819, -118.2248],
  "Industry":            [34.0153, -117.9620],
  "Irwindale":           [34.1122, -117.9307],
  "La Canada Flintridge":[34.1997, -118.2006],
  "La Habra Heights":    [33.9586, -117.9476],
  "La Verne":            [34.1006, -117.7678],
  "Lomita":              [33.7925, -118.3153],
  "Malibu":              [34.0259, -118.7798],
  "Maywood":             [33.9872, -118.1856],
  "North Hollywood":     [34.1870, -118.3831],
  "Northridge":          [34.2311, -118.5353],
  "Pacoima":             [34.2611, -118.4097],
  "Paramount":           [33.8894, -118.1578],
  "Reseda":              [34.1997, -118.5347],
  "Rolling Hills":       [33.7614, -118.3531],
  "San Dimas":           [34.1067, -117.8067],
  "San Fernando":        [34.2822, -118.4367],
  "San Marino":          [34.1211, -118.1067],
  "Santa Fe Springs":    [33.9469, -118.0741],
  "Sierra Madre":        [34.1617, -118.0529],
  "Signal Hill":         [33.8042, -118.1681],
  "South El Monte":      [34.0517, -118.0467],
  "South Whittier":      [33.9336, -118.0313],
  "Studio City":         [34.1394, -118.3886],
  "Sun Valley":          [34.2197, -118.3797],
  "Sunland":             [34.2586, -118.3086],
  "Sylmar":              [34.3022, -118.4464],
  "Tarzana":             [34.1672, -118.5533],
  "Topanga":             [34.0908, -118.6025],
  "Valencia":            [34.4133, -118.6017],
  "Valinda":             [34.0453, -117.9354],
  "View Park":           [33.9878, -118.3492],
  "West Hollywood":      [34.0900, -118.3617],
  "Wilmington":          [33.7836, -118.2720],
  "Woodland Hills":      [34.1686, -118.6061],

  // Charlotte NC metro
  "Charlotte":           [35.2271, -80.8431],
  "Huntersville":        [35.4107, -80.8428],
  "Concord":             [35.4088, -80.5796],
  "Gastonia":            [35.2621, -81.1873],
  "Rock Hill":           [34.9249, -81.0251],
  "Matthews":            [35.1301, -80.7206],
  "Mooresville":         [35.5746, -80.8098],
  "Indian Trail":        [35.0762, -80.6481],
  "Fort Mill":           [35.0076, -80.9423],
  "Kannapolis":          [35.4874, -80.6215],
  "Monroe":              [34.9854, -80.5492],
  "Mint Hill":           [35.1817, -80.6456],
  "Pineville":           [35.0837, -80.8887],
  "Davidson":            [35.4993, -80.8192],
  "Cornelius":           [35.4857, -80.8656],
  "Waxhaw":              [34.9240, -80.7403],
  "Weddington":          [35.0354, -80.7178],
  "Harrisburg":          [35.3226, -80.6556],
  "Stallings":           [35.1026, -80.6628],
  "Belmont":             [35.2437, -81.0375],
  "Hickory":             [35.7332, -81.3440],
  "Statesville":         [35.7826, -80.8873],
  "Shelby":              [35.2923, -81.5354],
  "Salisbury":           [35.6710, -80.4742],
  "Albemarle":           [35.3601, -80.2003],
  "York":                [34.9940, -81.2415],
};

// Assign colors from a stable palette based on sorted territory index — works for any territory set
const PALETTE = ["#C9A84C", "#3498DB", "#2ECC71", "#9B59B6", "#E74C3C", "#1ABC9C", "#F39C12", "#E67E22"];
function buildColorMap(territories: string[]): Record<string, string> {
  const sorted = [...territories].sort();
  return Object.fromEntries(sorted.map((t, i) => [t, PALETTE[i % PALETTE.length]]));
}

function BoundsFitter({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (points.length > 0 && !fitted.current) {
      fitted.current = true;
      const lats = points.map(p => p[0]);
      const lngs = points.map(p => p[1]);
      const pad = 0.3;
      map.fitBounds([
        [Math.min(...lats) - pad, Math.min(...lngs) - pad],
        [Math.max(...lats) + pad, Math.max(...lngs) + pad],
      ]);
    }
  }, [map, points]);
  return null;
}

interface CityData { total: number; form: number; email: number; territory: string }

export default function TerritoryMap({
  byCity,
  territory,
}: {
  byCity: Record<string, CityData>;
  territory?: string;
}) {
  const allPoints = Object.entries(byCity)
    .map(([city, data]) => ({ city, data, coords: CITY_COORDS[city] }))
    .filter(p => p.coords != null) as Array<{ city: string; data: CityData; coords: [number, number] }>;

  const filtered = territory ? allPoints.filter(p => p.data.territory === territory) : allPoints;
  const territories = [...new Set(allPoints.map(p => p.data.territory))];
  const colorMap = buildColorMap(territories);
  const boundsPoints = filtered.map(p => p.coords);
  const maxSends = Math.max(...filtered.map(p => p.data.total), 1);

  const defaultCenter: [number, number] = filtered.length > 0
    ? [
        filtered.reduce((s, p) => s + p.coords[0], 0) / filtered.length,
        filtered.reduce((s, p) => s + p.coords[1], 0) / filtered.length,
      ]
    : [34.0, -118.0];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={8}
      style={{ height: 420, width: "100%", background: "#080810", borderRadius: 8 }}
      zoomControl
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={19}
      />
      <BoundsFitter points={boundsPoints} />
      {filtered.map(({ city, data, coords }) => {
        const radius = Math.max(5, Math.sqrt(data.total / maxSends) * 28);
        const color  = colorMap[data.territory] ?? "#555570";
        const reach  = data.total > 0
          ? (((data.form + data.email) / data.total) * 100).toFixed(1)
          : "0.0";
        return (
          <CircleMarker
            key={city}
            center={coords}
            radius={radius}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.55, weight: 1.5, opacity: 0.9 }}
          >
            <Popup>
              <div style={{ fontFamily: "monospace", fontSize: 11, minWidth: 140 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{city}</div>
                <div>Sends: <strong>{data.total.toLocaleString()}</strong></div>
                <div>Forms: {data.form} · Emails: {data.email}</div>
                <div>Reach: {reach}%</div>
                <div style={{ marginTop: 4, color, fontSize: 10 }}>{data.territory}</div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
