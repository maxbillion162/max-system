import { NextResponse } from "next/server";
import { fetchWeather } from "@/lib/weather";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const name = searchParams.get("name") ?? "Your Location";
  const location = (searchParams.get("location") ?? "orlando") as "orlando" | "tallahassee";

  try {
    const data = await fetchWeather(
      lat && lon
        ? { lat: parseFloat(lat), lon: parseFloat(lon), name }
        : location,
    );
    return NextResponse.json({ data });
  } catch (err) {
    console.error("Weather fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch weather" }, { status: 500 });
  }
}
