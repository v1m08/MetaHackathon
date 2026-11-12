// All trip cost math lives here, in code, from seeded prices. The model never adds numbers.
// Every trip gets TWO totals: `ifYes` (host and/or ride say yes) and `otherwise` (hostel + public transport).
import { cityById, milesBetween } from "@/data/cities";
import type { City } from "@/types";

export const PRICES = {
  gasPerGallon: 3.1,
  mpg: 27,
  /** Intercity bus: base + per mile (FlixBus/Greyhound-ish). */
  busBase: 12,
  busPerMile: 0.07,
  /** Round-trip flight estimate for the distance band. */
  flight: (miles: number) => (miles < 400 ? 150 : miles < 1000 ? 180 : miles < 1500 ? 230 : 300),
  /** Food per day when a local is pointing you at cheap places vs. default. */
  foodPerDayWithLocal: 18,
  foodPerDay: 35,
  /** Share of gas a passenger chips in (driver was going anyway). */
  rideShare: 0.5,
  localTransitPerDay: 4,
};

export type TransportMode = "ride" | "own-car" | "bus" | "flight";
export type LodgingMode = "host" | "hostel" | "hotel";

export interface CostInput {
  fromCity: string;
  toCity: string;
  nights: number;
  /** Mode if everything goes to plan. */
  transport: TransportMode;
  lodging: LodgingMode;
  /** How many people share the car (incl. driver) when transport is ride/own-car. */
  carOccupants?: number;
  /** A local friend will be around to show you cheap food. */
  withLocal?: boolean;
  /** The driver's own asking price per rider (round trip). Overrides the gas formula for transport "ride". */
  rideShareUsd?: number;
}

export interface CostLine {
  label: string;
  usd: number;
}
export interface CostBreakdown {
  total: number;
  lines: CostLine[];
  transport: TransportMode;
  lodging: LodgingMode;
}

const r5 = (n: number) => Math.round(n / 5) * 5;

export function transportCost(from: City, to: City, mode: TransportMode, occupants = 2, rideShareUsd?: number): CostLine {
  const miles = milesBetween(from, to);
  const gasRoundTrip = ((miles * 2) / PRICES.mpg) * PRICES.gasPerGallon;
  switch (mode) {
    case "ride":
      if (rideShareUsd !== undefined) return { label: `gas split, what the driver asked (${miles} mi each way)`, usd: rideShareUsd };
      return { label: `ride share of gas (${miles} mi each way, ${occupants} in the car)`, usd: (gasRoundTrip * PRICES.rideShare) / Math.max(1, occupants - 1) };
    case "own-car":
      return { label: `gas, driving yourself (${miles} mi each way)`, usd: gasRoundTrip / Math.max(1, occupants) };
    case "bus":
      return { label: `bus, round trip (${miles} mi)`, usd: 2 * (PRICES.busBase + miles * PRICES.busPerMile) };
    case "flight":
      return { label: `flight, round trip (~${miles} mi)`, usd: PRICES.flight(miles) };
  }
}
export function lodgingCost(to: City, mode: LodgingMode, nights: number): CostLine {
  switch (mode) {
    case "host":
      return { label: `staying with a friend (${nights} night${nights === 1 ? "" : "s"})`, usd: 0 };
    case "hostel":
      return { label: `hostel, ${nights} night${nights === 1 ? "" : "s"} × $${to.hostelNight}`, usd: to.hostelNight * nights };
    case "hotel":
      return { label: `hotel, ${nights} night${nights === 1 ? "" : "s"} × $${to.hotelNight}`, usd: to.hotelNight * nights };
  }
}

export function costBreakdown(input: CostInput): CostBreakdown {
  const from = cityById(input.fromCity);
  const to = cityById(input.toCity);
  if (!from || !to) throw new Error(`unknown city ${input.fromCity} → ${input.toCity}`);
  const days = input.nights + 1;
  const lines: CostLine[] = [
    transportCost(from, to, input.transport, input.carOccupants ?? 2, input.rideShareUsd),
    lodgingCost(to, input.lodging, input.nights),
    { label: `food, ${days} days${input.withLocal ? " (local's cheap spots)" : ""}`, usd: days * (input.withLocal ? PRICES.foodPerDayWithLocal : PRICES.foodPerDay) },
    { label: `getting around, ${days} days`, usd: input.lodging === "host" && input.withLocal ? days * PRICES.localTransitPerDay * 0.5 : days * PRICES.localTransitPerDay },
  ];
  const total = r5(lines.reduce((n, l) => n + l.usd, 0));
  return { total, lines: lines.map((l) => ({ ...l, usd: Math.round(l.usd) })), transport: input.transport, lodging: input.lodging };
}

/** The honest pair: plan A if people say yes, plan B if they don't. */
export function twoPrices(input: CostInput) {
  const ifYes = costBreakdown(input);
  const from = cityById(input.fromCity)!;
  const to = cityById(input.toCity)!;
  const miles = milesBetween(from, to);
  const fallbackTransport: TransportMode = input.transport === "own-car" ? "own-car" : miles > 600 ? "flight" : "bus";
  const otherwise = costBreakdown({ ...input, transport: fallbackTransport, lodging: input.lodging === "host" ? "hostel" : input.lodging, withLocal: false });
  // What the same trip costs with no network at all: hotel + solo transport.
  const solo = costBreakdown({ ...input, transport: miles > 600 ? "flight" : "bus", lodging: "hotel", withLocal: false });
  return { ifYes, otherwise, solo, miles, driveHours: Math.round((miles / 68) * 10) / 10 };
}
