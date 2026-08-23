import { ConvenienceSpot, RankedCourse, RouteCoordinate } from '../types/travel';

function safeJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function buildLeafletHtml(course: RankedCourse) {
  const places = course.places.filter(
    (place): place is typeof place & { latitude: number; longitude: number } =>
      typeof place.latitude === 'number' && typeof place.longitude === 'number',
  );
  const conveniences = course.conveniences.filter(
    (spot): spot is ConvenienceSpot & { latitude: number; longitude: number } =>
      typeof spot.latitude === 'number' && typeof spot.longitude === 'number',
  );
  if (!places.length) return null;

  const originMarker = course.origin ? {
    lat: course.origin.latitude,
    lng: course.origin.longitude,
    label: `출발 · ${course.origin.name}`,
    address: course.origin.address,
  } : null;
  const markers = places.map((place, index) => ({
    lat: place.latitude,
    lng: place.longitude,
    label: `${index + 1}. ${place.name}`,
  }));
  const facilityMarkers = conveniences.map((spot) => ({
    lat: spot.latitude,
    lng: spot.longitude,
    label: `${spot.type === 'locker' ? '보관함' : spot.type === 'bike' ? '자전거' : '편의시설'} · ${spot.name}`,
    kind: spot.type,
  }));
  const fallbackPoints: RouteCoordinate[] = [
    ...(course.origin ? [course.origin] : []),
    ...places,
  ];
  const routeLines = course.routeSegments?.length
    ? course.routeSegments.map((segment) => ({
      source: segment.source,
      mode: segment.modeLabel,
      points: segment.geometry.map((point) => [point.latitude, point.longitude]),
    }))
    : [{
      source: 'estimated',
      mode: '좌표 추정',
      points: fallbackPoints.map((point) => [point.latitude, point.longitude]),
    }];
  const bounds = [
    ...(originMarker ? [[originMarker.lat, originMarker.lng]] : []),
    ...markers.map((marker) => [marker.lat, marker.lng]),
    ...facilityMarkers.map((marker) => [marker.lat, marker.lng]),
  ];
  const center = bounds[0] ?? [places[0]!.latitude, places[0]!.longitude];
  const routeLabel = course.routeSource === 'tmap-transit'
    ? 'TMAP 실제 대중교통 경로'
    : course.routeSource === 'mixed'
      ? 'TMAP + 좌표 추정 경로'
      : '좌표 기반 예상 경로';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html,body,#map{height:100%;margin:0;background:#E8F0E4}.leaflet-container{font-family:sans-serif}
    .route-source{position:absolute;z-index:999;right:8px;top:8px;background:rgba(255,255,255,.94);padding:7px 9px;border-radius:10px;color:#0D5C45;font:700 11px sans-serif;box-shadow:0 2px 9px rgba(0,0,0,.12)}
    .origin-icon{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9px;background:#E4572E;color:white;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.25);font:bold 15px sans-serif}
    .place-icon{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:#0D5C45;color:white;border:2px solid white;box-shadow:0 2px 7px rgba(0,0,0,.22);font:bold 11px sans-serif}
  </style>
</head>
<body>
  <div id="map"></div><div class="route-source">${routeLabel}</div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map=L.map('map',{zoomControl:true}).setView(${safeJson(center)},13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    const origin=${safeJson(originMarker)};
    const places=${safeJson(markers)};
    const facilities=${safeJson(facilityMarkers)};
    const routeLines=${safeJson(routeLines)};
    if(origin){
      const icon=L.divIcon({className:'',html:'<div class="origin-icon">출</div>',iconSize:[28,28],iconAnchor:[14,14]});
      L.marker([origin.lat,origin.lng],{icon,zIndexOffset:1000}).addTo(map).bindPopup('<strong>'+origin.label+'</strong><br>'+origin.address).openPopup();
    }
    routeLines.forEach((line)=>{
      if(line.points.length>1)L.polyline(line.points,{color:line.source==='tmap-transit'?'#0D5C45':'#7A8B82',weight:5,opacity:.88,dashArray:line.source==='tmap-transit'?null:'8 7'}).addTo(map).bindTooltip(line.mode);
    });
    places.forEach((p,i)=>{
      const icon=L.divIcon({className:'',html:'<div class="place-icon">'+(i+1)+'</div>',iconSize:[26,26],iconAnchor:[13,13]});
      L.marker([p.lat,p.lng],{icon}).addTo(map).bindPopup(p.label);
    });
    facilities.forEach((p)=>L.circleMarker([p.lat,p.lng],{radius:7,color:'#fff',weight:2,fillColor:p.kind==='locker'?'#E4572E':'#347D91',fillOpacity:.95}).addTo(map).bindPopup(p.label));
    const bounds=${safeJson(bounds)};
    if(bounds.length>1)map.fitBounds(bounds,{padding:[34,34]});
  </script>
</body>
</html>`;
}
