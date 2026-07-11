import { NextResponse } from "next/server";
import { getGameState, resetGame } from "@/lib/gameService";

export async function GET() {
  try {
    const state = getGameState();
    return NextResponse.json(state);
  } catch (error) {
    console.error("Error in GET /api/state:", error);
    return NextResponse.json({ error: "Failed to get state" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.action === "reset") {
      const newState = await resetGame();
      return NextResponse.json(newState);
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error in POST /api/state:", error);
    return NextResponse.json({ error: "Failed to perform action" }, { status: 500 });
  }
}
