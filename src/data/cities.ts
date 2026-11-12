import type { City } from "@/types";

// Cities the network spans. Prices are seeded, deliberately round, and used ONLY by code (src/lib/travel/pricing.ts).
export const cities: City[] = [
  { id: "austin", name: "Austin", state: "TX", lat: 30.2672, lng: -97.7431, hotelNight: 150, hostelNight: 48, tags: ["live music", "tacos", "swimming holes", "trail running"] },
  { id: "dallas", name: "Dallas", state: "TX", lat: 32.7767, lng: -96.797, hotelNight: 125, hostelNight: 42, tags: ["Deep Ellum", "art museums", "Tex-Mex", "concerts"] },
  { id: "houston", name: "Houston", state: "TX", lat: 29.7604, lng: -95.3698, hotelNight: 120, hostelNight: 40, tags: ["food", "museums", "Viet-Cajun", "NASA"] },
  { id: "san-antonio", name: "San Antonio", state: "TX", lat: 29.4241, lng: -98.4936, hotelNight: 115, hostelNight: 38, tags: ["Riverwalk", "Pearl", "missions", "breakfast tacos"] },
  { id: "marfa", name: "Marfa", state: "TX", lat: 30.3085, lng: -104.0206, hotelNight: 160, hostelNight: 55, tags: ["desert", "art", "stargazing", "road trip"] },
  { id: "new-orleans", name: "New Orleans", state: "LA", lat: 29.9511, lng: -90.0715, hotelNight: 155, hostelNight: 45, tags: ["jazz", "beignets", "Frenchmen St", "parades"] },
  { id: "nashville", name: "Nashville", state: "TN", lat: 36.1627, lng: -86.7816, hotelNight: 165, hostelNight: 50, tags: ["live music", "hot chicken", "honky tonks", "songwriter nights"] },
  { id: "atlanta", name: "Atlanta", state: "GA", lat: 33.749, lng: -84.388, hotelNight: 135, hostelNight: 44, tags: ["BeltLine", "hip-hop", "Ponce City Market", "food halls"] },
  { id: "denver", name: "Denver", state: "CO", lat: 39.7392, lng: -104.9903, hotelNight: 150, hostelNight: 46, tags: ["Red Rocks", "hiking", "breweries", "RiNo murals"] },
  { id: "chicago", name: "Chicago", state: "IL", lat: 41.8781, lng: -87.6298, hotelNight: 170, hostelNight: 52, tags: ["architecture", "deep dish", "lakefront", "comedy"] },
  { id: "los-angeles", name: "Los Angeles", state: "CA", lat: 34.0522, lng: -118.2437, hotelNight: 190, hostelNight: 55, tags: ["beaches", "tacos", "hikes", "Koreatown"] },
  { id: "new-york", name: "New York", state: "NY", lat: 40.7128, lng: -74.006, hotelNight: 240, hostelNight: 65, tags: ["museums", "pizza", "subway", "parks"] },
];

export const cityById = (id: string) => cities.find((c) => c.id === id);

/** Great-circle distance in miles. */
export function milesBetween(a: City, b: City) {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.18); // ×1.18 ≈ road distance
}
