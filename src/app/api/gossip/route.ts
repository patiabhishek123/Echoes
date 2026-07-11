import { NextResponse } from "next/server";
import { runGossipPhase, getGameState } from "@/lib/gameService";

export async function POST() {
  try {
    const gossipLogs = await runGossipPhase();
    const state = getGameState();
    return NextResponse.json({ gossipLogs, state });
  } catch (error: any) {
    console.error("Error in POST /api/gossip:", error);
    return NextResponse.json({ error: error.message || "Failed to process gossip" }, { status: 500 });
  }
}
