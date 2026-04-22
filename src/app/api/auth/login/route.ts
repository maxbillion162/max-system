import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { password } = await request.json() as { password: string };
    const correct = process.env.MAX_PASSWORD ?? "max2024";
    if (password === correct) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
