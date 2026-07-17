import { NextResponse } from "next/server";
import { 
  getNPCMemoriesForFront, 
  searchNPCMemories, 
  deleteSupermemoryDocument, 
  getGameState, 
  saveGameState,
  checkGameEndings
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
    const npcId = searchParams.get("npcId") || "";
    const isGlitched = searchParams.get("isGlitched") === "true";

    if (!docId) {
      return NextResponse.json({ error: "Missing docId" }, { status: 400 });
    }

    const state = getGameState();
    
    // Determine coin cost based on NPC mood
    let cost = 10;
    if (npcId && state.npcs[npcId]) {
      const mood = state.npcs[npcId].mood || "calm";
      if (mood === "suspicious") {
        cost = 20;
      } else if (mood === "corrupted") {
        cost = 15;
      }
    }

    if ((state.coins ?? 30) < cost) {
      return NextResponse.json({ error: `Insufficient coins for Oblivion Potion (needs ${cost})` }, { status: 403 });
    }

    // Attempt to delete from Supermemory
    const success = await deleteSupermemoryDocument(docId);
    if (!success) {
      return NextResponse.json({ error: "Supermemory failed to delete the memory" }, { status: 502 });
    }

    // Deduct coins
    state.coins = (state.coins ?? 30) - cost;

    // Adjust system corruption
    if (isGlitched) {
      state.corruption = Math.max(0, (state.corruption || 15) - 10);
      // Reset NPC mood back to calm if they were corrupted/glitched
      if (npcId && state.npcs[npcId] && state.npcs[npcId].mood === "corrupted") {
        state.npcs[npcId].mood = "calm";
      }
    } else {
      state.corruption = Math.min(100, (state.corruption || 15) + 5);
    }

    // Check endings and save state
    checkGameEndings(state);
    saveGameState(state);

    return NextResponse.json({ 
      success: true, 
      coins: state.coins, 
      corruption: state.corruption,
      npcs: state.npcs,
      gameEnded: state.gameEnded,
      endingType: state.endingType
    });
  } catch (error: any) {
    console.error("Error in DELETE /api/memories:", error);
    return NextResponse.json({ error: error.message || "Failed to delete memory" }, { status: 500 });
  }
}
