import { NextResponse } from "next/server";
import { fetchWeather } from "@/lib/weather";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const location = (searchParams.get("location") ?? "orlando") as "orlando" | "tallahassee";

  try {
    const data = await fetchWeather(location);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("Weather fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch weather" }, { status: 500 });
  }
}
