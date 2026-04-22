import { NextResponse } from "next/server";
import { generateBrief } from "@/lib/max-agent";

export async function GET() {
  try {
    const brief = await generateBrief();
    return NextResponse.json({ brief });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ brief: "Systems online. What do you need, Max?" });
  }
}
