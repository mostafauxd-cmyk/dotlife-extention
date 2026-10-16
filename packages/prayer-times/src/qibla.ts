import { atan2, cos, fixAngle, sin, tan } from "./sun";
import type { Location } from "./types";

/** The Kaaba, Makkah. */
export const KAABA: Location = { latitude: 21.422487, longitude: 39.826206 };

/** Initial great-circle bearing from `from` to the Kaaba, in degrees clockwise from true north [0, 360). */
export function qiblaBearing(from: Location): number {
  const dLng = KAABA.longitude - from.longitude;
  const y = sin(dLng);
  const x = cos(from.latitude) * tan(KAABA.latitude) - sin(from.latitude) * cos(dLng);
  return fixAngle(atan2(y, x));
}

/** Great-circle distance to the Kaaba in kilometres (mean Earth radius). */
export function distanceToKaabaKm(from: Location): number {
  const r = 6371.0088;
  const dLat = KAABA.latitude - from.latitude;
  const dLng = KAABA.longitude - from.longitude;
  const a = sin(dLat / 2) ** 2 + cos(from.latitude) * cos(KAABA.latitude) * sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}
