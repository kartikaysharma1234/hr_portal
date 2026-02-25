import { Fragment, useMemo } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';

import 'leaflet/dist/leaflet.css';
import type { AttendanceDailyDetail } from '../../types/attendance';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

interface AttendanceMapViewProps {
  detail: AttendanceDailyDetail | null;
}

const getCenter = (detail: AttendanceDailyDetail | null): [number, number] => {
  if (detail?.mapView.officeLocations.length) {
    const first = detail.mapView.officeLocations[0];
    return [first.latitude, first.longitude];
  }

  if (detail?.mapView.punchPoints.length) {
    const first = detail.mapView.punchPoints[0];
    return [first.latitude, first.longitude];
  }

  return [28.6139, 77.209];
};

export const AttendanceMapView = ({ detail }: AttendanceMapViewProps): JSX.Element => {
  const center = useMemo(() => getCenter(detail), [detail]);

  return (
    <section className="attendance-map-card">
      <header>
        <h3>Punch Map View</h3>
        <p>Office geofence + punch location with distance reference.</p>
      </header>

      <div className="attendance-map-shell">
        <MapContainer center={center} zoom={14} scrollWheelZoom className="attendance-map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {(detail?.mapView.officeLocations ?? []).map((office) => (
            <Circle
              key={`office-${office.id}`}
              center={[office.latitude, office.longitude]}
              radius={office.radiusMeters}
              pathOptions={{ color: '#2563eb', fillColor: '#93c5fd', fillOpacity: 0.24 }}
            >
              <Popup>
                <strong>{office.name}</strong>
                <br />
                Radius: {office.radiusMeters}m
              </Popup>
            </Circle>
          ))}

          {(detail?.mapView.punchPoints ?? []).map((point) => {
            const office = detail?.mapView.officeLocations?.[0];
            const line: [number, number][] = office
              ? [
                  [office.latitude, office.longitude],
                  [point.latitude, point.longitude]
                ]
              : [];

            return (
              <Fragment key={`cluster-${point.id}`}>
                <Marker key={`punch-${point.id}`} position={[point.latitude, point.longitude]}>
                  <Popup>
                    Punch: {point.punchType}
                    <br />
                    Distance: {point.distanceMeters ? `${Math.round(point.distanceMeters)}m` : 'N/A'}
                  </Popup>
                </Marker>
                {line.length === 2 ? (
                  <Polyline
                    key={`line-${point.id}`}
                    positions={line}
                    pathOptions={{ color: point.colorHex, dashArray: '5,5' }}
                  />
                ) : null}
              </Fragment>
            );
          })}
        </MapContainer>
      </div>
    </section>
  );
};
