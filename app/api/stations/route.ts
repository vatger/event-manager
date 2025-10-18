// app/api/stations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchAllStations, fetchStationsByAirport } from "@/lib/stations/fetchStations";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const airport = searchParams.get("airport");

  const stations = airport
    ? await fetchStationsByAirport(airport)
    : await fetchAllStations();

  return NextResponse.json({ stations });
}
