import { Platform, StyleSheet, View } from 'react-native';
import { RouteMap } from './RouteMap';
import { ConvenienceSpot, RankedCourse } from '../types/travel';
import { colors, radii } from '../theme';

function buildLeafletHtml(course: RankedCourse) {
  const places = course.places.filter(
    (place) => typeof place.latitude === 'number' && typeof place.longitude === 'number',
  );
  const conveniences = (course.conveniences || []).filter(
    (spot): spot is ConvenienceSpot & { latitude: number; longitude: number } =>
      typeof spot.latitude === 'number' && typeof spot.longitude === 'number',
  );

  if (!places.length) return null;

  const centerLat = places.reduce((sum, p) => sum + (p.latitude as number), 0) / places.length;
  const centerLng = places.reduce((sum, p) => sum + (p.longitude as number), 0) / places.length;
  const placeMarkers = places.map((place, index) => ({
    lat: place.latitude,
    lng: place.longitude,
    label: `${index + 1}. ${place.name}`,
    kind: 'place',
  }));
  const convenienceMarkers = conveniences.map((spot) => ({
    lat: spot.latitude,
    lng: spot.longitude,
    label: `${spot.type === 'locker' ? '보관함' : spot.type === 'bike' ? '자전거' : '편의'} · ${spot.name}`,
    kind: spot.type,
  }));
  const path = places.map((place) => [place.latitude, place.longitude]);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; background: #E8F0E4; }
    .leaflet-container { font-family: sans-serif; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', { zoomControl: true }).setView([${centerLat}, ${centerLng}], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    const places = ${JSON.stringify(placeMarkers)};
    const conveniences = ${JSON.stringify(convenienceMarkers)};
    const path = ${JSON.stringify(path)};
    if (path.length > 1) {
      L.polyline(path, { color: '#0D5C45', weight: 4, opacity: 0.85 }).addTo(map);
    }
    places.forEach((p, i) => {
      L.circleMarker([p.lat, p.lng], {
        radius: 10,
        color: '#fff',
        weight: 2,
        fillColor: i === 0 ? '#E4572E' : '#0D5C45',
        fillOpacity: 1
      }).addTo(map).bindPopup(p.label);
    });
    conveniences.forEach((c) => {
      const color = c.kind === 'locker' ? '#E4572E' : c.kind === 'bike' ? '#347D91' : '#7A5A3A';
      L.circleMarker([c.lat, c.lng], {
        radius: 7,
        color: '#fff',
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95
      }).addTo(map).bindPopup(c.label);
    });
    const all = places.concat(conveniences).map((p) => [p.lat, p.lng]);
    if (all.length) map.fitBounds(all, { padding: [28, 28] });
  </script>
</body>
</html>`;
}

/**
 * Web: Leaflet(OSM) 지도 SDK 렌더링
 * Native: 기존 RouteMap 폴백 (좌표 투영)
 */
export function CourseMap({ course }: { course: RankedCourse }) {
  const html = buildLeafletHtml(course);

  if (Platform.OS === 'web' && html) {
    return (
      <View style={styles.wrap}>
        {/* eslint-disable-next-line react/no-danger */}
        <iframe title="course-map" srcDoc={html} style={styles.iframe as any} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <RouteMap course={course} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 280,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: '#D9E8D4',
    borderWidth: 1,
    borderColor: colors.line,
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
  },
});
