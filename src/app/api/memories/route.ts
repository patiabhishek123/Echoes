import { NextResponse } from "next/server";
import { getNPCMemoriesForFront } from "@/lib/gameService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const npcId = searchParams.get("npcId");
    
    if (!npcId) {
      return NextResponse.json({ error: "Missing npcId" }, { status: 400 });
    }

    const memories = await getNPCMemoriesForFront(npcId);
    return NextResponse.json(memories);
  } catch (error: any) {
    console.error("Error in GET /api/memories:", error);
    return NextResponse.json({ error: error.message || "Failed to retrieve memories" }, { status: 500 });
  }
}
