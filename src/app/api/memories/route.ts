import { NextResponse } from "next/server";
import { 
  getNPCMemoriesForFront, 
  searchNPCMemories, 
  deleteSupermemoryDocument, 
  getGameState, 
  saveGameState 
} from "@/lib/gameService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const npcId = searchParams.get("npcId");
    const query = searchParams.get("query");
    
    if (!npcId) {
      return NextResponse.json({ error: "Missing npcId" }, { status: 400 });
    }

    if (query) {
      // Vector Hacking - Deduct 5 coins
      const state = getGameState();
      if ((state.coins ?? 30) < 5) {
        return NextResponse.json({ error: "Insufficient coins for vector scan (needs 5)" }, { status: 403 });
      }
      state.coins = (state.coins ?? 30) - 5;
      saveGameState(state);

      const memories = await searchNPCMemories(npcId, query);
      return NextResponse.json({ memories, coins: state.coins });
    } else {
      const memories = await getNPCMemoriesForFront(npcId);
      return NextResponse.json(memories);
    }
  } catch (error: any) {
    console.error("Error in GET /api/memories:", error);
    return NextResponse.json({ error: error.message || "Failed to retrieve memories" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("docId");

    if (!docId) {
      return NextResponse.json({ error: "Missing docId" }, { status: 400 });
    }

    const state = getGameState();
    if ((state.coins ?? 30) < 20) {
      return NextResponse.json({ error: "Insufficient coins for Oblivion Potion (needs 20)" }, { status: 403 });
    }

    // Attempt to delete from Supermemory
    const success = await deleteSupermemoryDocument(docId);
    if (!success) {
      return NextResponse.json({ error: "Supermemory failed to delete the memory" }, { status: 502 });
    }

    state.coins = (state.coins ?? 30) - 20;
    saveGameState(state);

    return NextResponse.json({ success: true, coins: state.coins });
  } catch (error: any) {
    console.error("Error in DELETE /api/memories:", error);
    return NextResponse.json({ error: error.message || "Failed to delete memory" }, { status: 500 });
  }
}
