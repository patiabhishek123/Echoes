import { NextResponse } from "next/server";
import { getGameState, resetGame, injectRumor, failMinigame } from "@/lib/gameService";

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
    
    if (body.action === "failMinigame") {
      const cost = body.cost || 10;
      const updatedState = failMinigame(cost);
      return NextResponse.json(updatedState);
    }
    
    if (body.action === "injectRumor") {
      const { targetNpcId, rumor } = body;
      if (!targetNpcId || !rumor) {
        return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
      }
      try {
        const updatedState = await injectRumor(targetNpcId, rumor);
        return NextResponse.json(updatedState);
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }
    
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error in POST /api/state:", error);
    return NextResponse.json({ error: "Failed to perform action" }, { status: 500 });
  }
}
