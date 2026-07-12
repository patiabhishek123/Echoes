import { NextResponse } from "next/server";
import { getPlayerJournalNotes, addPlayerJournalNote } from "@/lib/gameService";

export async function GET() {
  try {
    const notes = await getPlayerJournalNotes();
    return NextResponse.json(notes);
  } catch (error: any) {
    console.error("Error in GET /api/journal:", error);
    return NextResponse.json({ error: error.message || "Failed to retrieve journal notes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { content } = await request.json();
    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }

    await addPlayerJournalNote(content);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in POST /api/journal:", error);
    return NextResponse.json({ error: error.message || "Failed to add journal note" }, { status: 500 });
  }
}
