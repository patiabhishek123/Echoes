import { NextResponse } from "next/server";
import { talkToNPC } from "@/lib/gameService";

export async function POST(request: Request) {
  try {
    const { npcId, message } = await request.json();
    if (!npcId || !message) {
      return NextResponse.json({ error: "Missing npcId or message" }, { status: 400 });
    }

    const result = await talkToNPC(npcId, message);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in POST /api/chat:", error);
    return NextResponse.json({ error: error.message || "Failed to process chat" }, { status: 500 });
  }
}
