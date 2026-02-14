import { haversineDistance } from "./utils";

/**
 * DistanceProvider interface — pluggable for future routing APIs.
 * MVP uses Haversine (straight-line) distance.
 */
export interface DistanceProvider {
  /** Returns distance in km between two lat/lng points */
  getDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): Promise<number>;
  /** Human-readable name of the method */
  methodName: string;
  /** Disclaimer text for the user */
  disclaimer: string;
}

export class HaversineProvider implements DistanceProvider {
  methodName = "Haversine (rak linje)";
  disclaimer =
    "Avstånd beräknat som fågelvägen. Verklig körsträcka kan vara längre.";

  async getDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): Promise<number> {
    return haversineDistance(lat1, lng1, lat2, lng2);
  }
}

export const defaultDistanceProvider: DistanceProvider =
  new HaversineProvider();
