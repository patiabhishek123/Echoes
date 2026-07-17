import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini
const geminiApiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(geminiApiKey);

// Supermemory configuration
const supermemoryUrl = process.env.SUPERMEMORY_API_URL || "http://localhost:6767";
const supermemoryKey = process.env.SUPERMEMORY_API_KEY || "";

// For serverless/Vercel support, write to /tmp since the project root is read-only
const isServerless = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
const STATE_FILE_PATH = isServerless
  ? path.join("/tmp", "gamestate.json")
  : path.join(process.cwd(), "gamestate.json");

export interface NPCMetrics {
  trust: number;
  respect: number;
  fear: number;
  friendship: number;
}

export interface NPC {
  id: string;
  name: string;
  role: string;
  portrait: string;
  metrics: NPCMetrics;
  relationships: string;
  personality: string;
  mood?: "calm" | "suspicious" | "corrupted";
}

export interface ChatMessage {
  sender: "player" | "npc";
  content: string;
  timestamp: string;
}

export interface GossipLog {
  day: number;
  fromNpc: string;
  toNpc: string;
  rumor: string;
}

export interface MemoryItem {
  id: string;
  content: string;
}

export interface GameState {
  sessionId: string;
  day: number;
  coins: number;
  gameEnded: boolean;
  endingType: "mayor" | "friend" | "outcast" | "arrested" | "merchant" | "corruption" | null;
  npcs: Record<string, NPC>;
  conversations: Record<string, ChatMessage[]>;
  gossipLogs: GossipLog[];
  corruption?: number;
}

const INITIAL_NPCS: Record<string, NPC> = {
  blacksmith: {
    id: "blacksmith",
    name: "Hagar",
    role: "Blacksmith",
    portrait: "/portraits/blacksmith.png",
    metrics: { trust: 50, respect: 40, fear: 10, friendship: 30 },
    relationships: "Close friend of Captain Kael (Guard). Dislikes Silas the Merchant.",
    personality: "Gruff, hard-working, honest, and blunt. Values sweat, steel, and absolute honesty. Despises sweet talkers and inconsistency.",
    mood: "calm"
  },
  guard: {
    id: "guard",
    name: "Captain Kael",
    role: "Captain of the Guard",
    portrait: "/portraits/guard.png",
    metrics: { trust: 40, respect: 50, fear: 20, friendship: 20 },
    relationships: "Close friend of Hagar the Blacksmith. Suspicious of outsiders.",
    personality: "Stern, vigilant, orderly, and highly disciplined. Values consistency, law, and security. Suspicious of anyone whose story changes or who acts shifty.",
    mood: "calm"
  },
  merchant: {
    id: "merchant",
    name: "Silas",
    role: "Merchant",
    portrait: "/portraits/merchant.png",
    metrics: { trust: 60, respect: 30, fear: 5, friendship: 40 },
    relationships: "Always looking for trade secrets. Finds Mayor Evelyn intimidating.",
    personality: "Sly, charismatic, gossipy, and greedy. Loves gold, rumors, and knowing things others don't. Can be bribed with info or promises, but will sell out secrets just as fast.",
    mood: "calm"
  },
  mayor: {
    id: "mayor",
    name: "Mayor Evelyn",
    role: "Village Mayor",
    portrait: "/portraits/mayor.png",
    metrics: { trust: 30, respect: 60, fear: 15, friendship: 10 },
    relationships: "Demands respect. Keeps a close eye on Silas.",
    personality: "Dignified, elderly, politically minded, and secretive. Values status, respect, decorum, and the safety of the village. Suspicious of outsiders trying to gain influence.",
    mood: "calm"
  }
};

// Seeding initial background memories for NPCs to give them context on the world
const SEED_MEMORIES: Record<string, string[]> = {
  blacksmith: [
    "I am Hagar, the blacksmith. I work at the forge all day.",
    "Captain Kael is my close friend. We often drink at the tavern together.",
    "Silas the merchant is a swindler who values gold over hard work.",
    "A strange new visitor arrived in the village today. I should find out who they are."
  ],
  guard: [
    "I am Captain Kael, head of the village guard. I protect Echoes.",
    "Hagar the blacksmith is a reliable man. I trust him completely.",
    "I am on high alert for thieves, spies, and troublemakers.",
    "An unknown traveler entered the village. I must monitor their intentions."
  ],
  merchant: [
    "I am Silas, the wealthiest merchant in Echoes.",
    "I love a good piece of gossip. Information is just another currency.",
    "I want to make sure I am on the good side of anyone with money or power.",
    "A new traveler has arrived. They might have goods to sell or secrets to share."
  ],
  mayor: [
    "I am Mayor Evelyn. I have governed Echoes for twenty years.",
    "I keep this village safe and orderly. Outsiders must respect our laws.",
    "Silas the merchant needs to be watched; his greed can cause trouble.",
    "A new stranger has walked into town. I must assess if they pose a threat or can be useful."
  ]
};

export function getGameState(): GameState {
  if (!fs.existsSync(STATE_FILE_PATH)) {
    const newState: GameState = {
      sessionId: Math.random().toString(36).substring(2, 10),
      day: 1,
      coins: 30,
      gameEnded: false,
      endingType: null,
      npcs: JSON.parse(JSON.stringify(INITIAL_NPCS)),
      conversations: {
        blacksmith: [],
        guard: [],
        merchant: [],
        mayor: []
      },
      gossipLogs: [],
      corruption: 15
    };
    saveGameState(newState);
    return newState;
  }

  try {
    const data = fs.readFileSync(STATE_FILE_PATH, "utf-8");
    const parsed = JSON.parse(data);
    if (parsed.coins === undefined) {
      parsed.coins = 30;
    }
    if (parsed.corruption === undefined) {
      parsed.corruption = 15;
    }
    // Set default mood for all NPCs if missing
    for (const npcId of Object.keys(parsed.npcs)) {
      if (!parsed.npcs[npcId].mood) {
        parsed.npcs[npcId].mood = "calm";
      }
    }
    return parsed;
  } catch (error) {
    console.error("Error reading game state, recreating:", error);
    const newState: GameState = {
      sessionId: Math.random().toString(36).substring(2, 10),
      day: 1,
      coins: 30,
      gameEnded: false,
      endingType: null,
      npcs: JSON.parse(JSON.stringify(INITIAL_NPCS)),
      conversations: {
        blacksmith: [],
        guard: [],
        merchant: [],
        mayor: []
      },
      gossipLogs: [],
      corruption: 15
    };
    saveGameState(newState);
    return newState;
  }
}

export function saveGameState(state: GameState): void {
  fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

export async function resetGame(): Promise<GameState> {
  const sessionId = Math.random().toString(36).substring(2, 10);
  const newState: GameState = {
    sessionId,
    day: 1,
    coins: 30,
    gameEnded: false,
    endingType: null,
    npcs: JSON.parse(JSON.stringify(INITIAL_NPCS)),
    conversations: {
      blacksmith: [],
      guard: [],
      merchant: [],
      mayor: []
    },
    gossipLogs: [],
    corruption: 15
  };

  saveGameState(newState);
  resetMockMemories(newState.sessionId);

  // Seed the fresh Supermemory tags in the background
  for (const [npcId, memories] of Object.entries(SEED_MEMORIES)) {
    const containerTag = `${npcId}_${sessionId}`;
    for (const memory of memories) {
      addMemoryToSupermemory(containerTag, memory).catch(err => 
        console.error(`Error seeding memory for ${npcId}:`, err)
      );
    }
  }

  // Clear player journal under player_${sessionId} tag by seeding it empty or with a default entry
  addMemoryToSupermemory(`player_${sessionId}`, "Entered the village of Echoes on Day 1. Looking to blend in and learn secrets.").catch(err => 
    console.error("Error seeding player journal:", err)
  );

  return newState;
}

export async function injectRumor(targetNpcId: string, rumor: string): Promise<GameState> {
  const state = getGameState();
  if ((state.coins ?? 30) < 15) {
    throw new Error("Insufficient coins to synthesize rumor (needs 15)");
  }
  state.coins = (state.coins ?? 30) - 15;
  state.corruption = Math.min(100, (state.corruption || 15) + 3);

  const containerTag = `${targetNpcId}_${state.sessionId}`;
  await addMemoryToSupermemory(containerTag, `Rumor heard in town: "${rumor}"`);

  checkGameEndings(state);
  saveGameState(state);
  return state;
}

export function failMinigame(cost: number): GameState {
  const state = getGameState();
  state.coins = Math.max(0, (state.coins ?? 30) - cost);
  state.corruption = Math.min(100, (state.corruption || 15) + 15);
  checkGameEndings(state);
  saveGameState(state);
  return state;
}

// Local Mock Memory Fallback System Definitions
interface MockMemory {
  id: string;
  containerTag: string;
  content: string;
}

const MOCK_MEMORIES_FILE_PATH = isServerless
  ? path.join("/tmp", "mock_memories.json")
  : path.join(process.cwd(), "mock_memories.json");

function getMockMemories(): MockMemory[] {
  if (!fs.existsSync(MOCK_MEMORIES_FILE_PATH)) {
    const memories: MockMemory[] = [];
    try {
      const state = getGameState();
      const sessionId = state.sessionId;
      for (const [npcId, seedContents] of Object.entries(SEED_MEMORIES)) {
        const containerTag = `${npcId}_${sessionId}`;
        for (const content of seedContents) {
          memories.push({
            id: `mock_doc_${Math.random().toString(36).substring(2, 11)}`,
            containerTag,
            content
          });
        }
      }
      memories.push({
        id: `mock_doc_${Math.random().toString(36).substring(2, 11)}`,
        containerTag: `player_${sessionId}`,
        content: "Entered the village of Echoes on Day 1. Looking to blend in and learn secrets."
      });
      fs.writeFileSync(MOCK_MEMORIES_FILE_PATH, JSON.stringify(memories, null, 2), "utf-8");
    } catch (e) {
      console.error("Error seeding initial mock memories:", e);
    }
    return memories;
  }
  try {
    const data = fs.readFileSync(MOCK_MEMORIES_FILE_PATH, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveMockMemories(memories: MockMemory[]) {
  try {
    fs.writeFileSync(MOCK_MEMORIES_FILE_PATH, JSON.stringify(memories, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving mock memories:", e);
  }
}

function resetMockMemories(sessionId: string) {
  const memories: MockMemory[] = [];
  for (const [npcId, seedContents] of Object.entries(SEED_MEMORIES)) {
    const containerTag = `${npcId}_${sessionId}`;
    for (const content of seedContents) {
      memories.push({
        id: `mock_doc_${Math.random().toString(36).substring(2, 11)}`,
        containerTag,
        content
      });
    }
  }
  memories.push({
    id: `mock_doc_${Math.random().toString(36).substring(2, 11)}`,
    containerTag: `player_${sessionId}`,
    content: "Entered the village of Echoes on Day 1. Looking to blend in and learn secrets."
  });
  saveMockMemories(memories);
}

function addMockMemory(containerTag: string, content: string) {
  const memories = getMockMemories();
  if (memories.some(m => m.containerTag === containerTag && m.content === content)) return;
  memories.push({
    id: `mock_doc_${Math.random().toString(36).substring(2, 11)}`,
    containerTag,
    content
  });
  saveMockMemories(memories);
}

function getMockMemoriesForTag(containerTag: string, query: string): string[] {
  const memories = getMockMemories();
  let filtered = memories.filter(m => m.containerTag === containerTag);
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(m => m.content.toLowerCase().includes(q));
  }
  return filtered.map(m => m.content);
}

function getMockMemoriesWithIdsForTag(containerTag: string, query: string): MemoryItem[] {
  const memories = getMockMemories();
  let filtered = memories.filter(m => m.containerTag === containerTag);
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(m => m.content.toLowerCase().includes(q));
  }
  return filtered.map(m => ({ id: m.id, content: m.content }));
}

function deleteMockMemory(docId: string): boolean {
  const memories = getMockMemories();
  const index = memories.findIndex(m => m.id === docId);
  if (index !== -1) {
    memories.splice(index, 1);
    saveMockMemories(memories);
    return true;
  }
  return false;
}

// Supermemory API Helpers
async function addMemoryToSupermemory(containerTag: string, content: string): Promise<void> {
  try {
    const response = await fetch(`${supermemoryUrl}/v3/documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supermemoryKey}`
      },
      body: JSON.stringify({ content, containerTag })
    });
    
    if (!response.ok) {
      console.warn(`Supermemory add error: ${response.status}. Using mock fallback.`);
      addMockMemory(containerTag, content);
    }
  } catch (error) {
    addMockMemory(containerTag, content);
  }
}

async function getNPCMemories(containerTag: string, query: string): Promise<string[]> {
  try {
    const response = await fetch(`${supermemoryUrl}/v4/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supermemoryKey}`
      },
      body: JSON.stringify({ containerTag, q: query })
    });

    if (!response.ok) {
      console.warn(`Supermemory profile warning: ${response.status}. Using mock fallback.`);
      return getMockMemoriesForTag(containerTag, query);
    }

    const data = await response.json();
    const dynamicMemories = data?.profile?.dynamic || [];
    const staticMemories = data?.profile?.static || [];
    const searchResults = data?.searchResults?.results?.map((r: any) => r.memory) || [];

    const all = Array.from(new Set([...staticMemories, ...dynamicMemories, ...searchResults]));
    return all as string[];
  } catch (error) {
    return getMockMemoriesForTag(containerTag, query);
  }
}

// Memory fetching that returns document IDs for deletion/potion mechanics
export async function getNPCMemoriesWithIds(containerTag: string, query: string = ""): Promise<MemoryItem[]> {
  try {
    const response = await fetch(`${supermemoryUrl}/v4/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supermemoryKey}`
      },
      body: JSON.stringify({ containerTag, q: query })
    });

    if (!response.ok) {
      console.warn(`Supermemory profile with IDs warning: ${response.status}. Using mock fallback.`);
      return getMockMemoriesWithIdsForTag(containerTag, query);
    }

    const data = await response.json();
    const results = data?.searchResults?.results || [];

    const items: MemoryItem[] = [];
    const seenContents = new Set<string>();

    for (const r of results) {
      const content = r.memory;
      if (!content || seenContents.has(content)) continue;
      seenContents.add(content);
      const docId = r.documents?.[0]?.id || "";
      if (docId) {
        items.push({ id: docId, content });
      }
    }

    return items;
  } catch (error) {
    return getMockMemoriesWithIdsForTag(containerTag, query);
  }
}

export async function getNPCMemoriesForFront(npcId: string): Promise<MemoryItem[]> {
  const state = getGameState();
  const containerTag = `${npcId}_${state.sessionId}`;
  const memories = await getNPCMemoriesWithIds(containerTag, "");
  return memories.filter(f => !f.content.startsWith("Conversation on Day"));
}

export async function searchNPCMemories(npcId: string, query: string): Promise<MemoryItem[]> {
  const state = getGameState();
  const containerTag = `${npcId}_${state.sessionId}`;
  const memories = await getNPCMemoriesWithIds(containerTag, query);
  return memories.filter(f => !f.content.startsWith("Conversation on Day"));
}

export async function deleteSupermemoryDocument(docId: string): Promise<boolean> {
  try {
    const response = await fetch(`${supermemoryUrl}/v3/documents/${docId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${supermemoryKey}`
      }
    });
    if (response.status === 204 || response.status === 200) {
      deleteMockMemory(docId);
      return true;
    }
    return deleteMockMemory(docId);
  } catch (error) {
    return deleteMockMemory(docId);
  }
}

// Player journal operations
export async function addPlayerJournalNote(note: string): Promise<void> {
  const state = getGameState();
  const containerTag = `player_${state.sessionId}`;
  await addMemoryToSupermemory(containerTag, note);
}

export async function getPlayerJournalNotes(): Promise<string[]> {
  const state = getGameState();
  const containerTag = `player_${state.sessionId}`;
  const memories = await getNPCMemories(containerTag, "");
  return memories;
}

// LLM Interaction Helpers
export async function talkToNPC(npcId: string, playerMessage: string): Promise<{
  response: string;
  metricChanges: NPCMetrics;
  contradiction: { detected: boolean; reason?: string } | null;
}> {
  const state = getGameState();
  const npc = state.npcs[npcId];
  if (!npc) {
    throw new Error(`NPC ${npcId} not found`);
  }

  const containerTag = `${npcId}_${state.sessionId}`;

  // 1. Retrieve relevant memories from Supermemory
  const relevantMemories = await getNPCMemories(containerTag, playerMessage);
  const memoriesContext = relevantMemories.length > 0 
    ? relevantMemories.map(m => `- ${m}`).join("\n")
    : "- You don't have any specific memories about this or the traveler yet.";

  // 2. Retrieve player journal notes from Supermemory for self-contradiction checking
  const playerJournalNotes = await getPlayerJournalNotes();
  const journalContext = playerJournalNotes.length > 0
    ? playerJournalNotes.map(n => `- ${n}`).join("\n")
    : "- The player has not recorded any past actions or statements in their journal.";

  // 3. Build the LLM prompt
  const npcMood = npc.mood || "calm";
  const globalCorruption = state.corruption || 15;

  const systemPrompt = `You are playing the role of ${npc.name}, the ${npc.role} in a medieval village simulation.
Personality: ${npc.personality}
Relationships: ${npc.relationships}
Current Cognitive Mood: ${npcMood.toUpperCase()} (calm/suspicious/corrupted)
Global System Corruption: ${globalCorruption}%

Current relationship metrics with the Player:
- Trust: ${npc.metrics.trust}/100 (High trust means they believe you, low trust means suspicious/hostile)
- Respect: ${npc.metrics.respect}/100 (High respect means they value your words, low respect means they look down on you)
- Fear: ${npc.metrics.fear}/100 (High fear means they are intimidated, low fear means they feel safe/dominant)
- Friendship: ${npc.metrics.friendship}/100 (High friendship means they are warm/helpful, low means cold)

Mood Behaviors:
- CALM: Speak normally in character.
- SUSPICIOUS: Highly defensive, suspicious of lies, does not trust changes in story. Any trust changes generated by you should be minimal/halved.
- CORRUPTED: Speeches may feel slightly disjointed or fragmented.

Here are your retrieved memories & facts about the player or village:
${memoriesContext}

Here is the player's private journal / statement logs (representing what the player has done, claimed, or told others in the village):
${journalContext}

The player says: "${playerMessage}"

Generate your response as a valid JSON object matching the schema below. Keep the dialogue concise (1-3 sentences), highly thematic, and in character.
You must analyze the player's message:
- Check for contradictions or lies: compare what the player says against your memories AND what they've claimed to other NPCs in their journal logs. For example, if they told someone else they are a peasant, but they tell you they are a knight, or if your memories say they claimed they are a knight and they now say "I'm just a simple traveler", that is a contradiction/lie!
- Adjust relationship metrics based on the interaction. Trust should decrease if you detect a lie or inconsistency. Friendship increases with friendliness. Respect increases with competence/authority.
- Extract any new concrete facts about the player or their statements to store in your memory.

RESPONSE SCHEMA (Return ONLY this JSON, no markdown blocks, no extra text):
{
  "response": "Your dialogue spoken to the player...",
  "trustChange": number,
  "respectChange": number,
  "fearChange": number,
  "friendshipChange": number,
  "contradictionDetected": boolean,
  "contradictionReason": "Explain what contradiction you noticed in their statements relative to your memories or their journal (leave empty if none)",
  "newFactsToRemember": ["Fact 1", "Fact 2"]
}
`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
    const result = await model.generateContent(systemPrompt);
    const responseText = result.response.text().trim();
    
    // Parse JSON
    // Clean up potential markdown formatting in LLM output
    const jsonStr = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(jsonStr);

    // If contradiction detected, increase system corruption and toggle mood to suspicious
    if (data.contradictionDetected) {
      state.corruption = Math.min(100, (state.corruption || 15) + 10);
      npc.mood = "suspicious";
    } else {
      // If corruption is high (>60%) and mood is calm, 40% chance to glitch
      if ((state.corruption || 15) > 60 && npc.mood === "calm") {
        if (Math.random() < 0.4) {
          npc.mood = "corrupted";
        }
      }
    }

    // 4. Update NPC metrics in Game State
    // Suspicious state halves positive trust changes
    let tChange = data.trustChange || 0;
    if (npc.mood === "suspicious" && tChange > 0) {
      tChange = Math.floor(tChange / 2);
    }
    npc.metrics.trust = Math.max(0, Math.min(100, npc.metrics.trust + tChange));
    npc.metrics.respect = Math.max(0, Math.min(100, npc.metrics.respect + (data.respectChange || 0)));
    npc.metrics.fear = Math.max(0, Math.min(100, npc.metrics.fear + (data.fearChange || 0)));
    npc.metrics.friendship = Math.max(0, Math.min(100, npc.metrics.friendship + (data.friendshipChange || 0)));

    // Post-process response if CORRUPTED: substitute words with binary/glitched bits
    let finalResponse = data.response;
    if (npc.mood === "corrupted") {
      finalResponse = data.response.split(" ").map((word: string) => {
        if (Math.random() < 0.35) {
          return word.split("").map(() => Math.random() < 0.55 ? "0" : "1").join("");
        }
        return word;
      }).join(" ");
    }

    // 5. Save player message and NPC response in conversation log
    state.conversations[npcId].push({
      sender: "player",
      content: playerMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    state.conversations[npcId].push({
      sender: "npc",
      content: finalResponse,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    // 6. Ingest new facts into Supermemory
    if (data.newFactsToRemember && data.newFactsToRemember.length > 0) {
      for (const fact of data.newFactsToRemember) {
        await addMemoryToSupermemory(containerTag, `The player told you: ${fact}`);
      }
    }

    // Ingest the conversation snippet too for dynamic context
    await addMemoryToSupermemory(containerTag, `Conversation on Day ${state.day} - Player: "${playerMessage}" | You: "${finalResponse}"`);

    // If contradiction detected, add that memory too so they remember the lie
    if (data.contradictionDetected) {
      await addMemoryToSupermemory(containerTag, `You caught the player lying: ${data.contradictionReason}`);
    }

    // Check endings
    checkGameEndings(state);
    saveGameState(state);

    return {
      response: finalResponse,
      metricChanges: {
        trust: tChange,
        respect: data.respectChange || 0,
        fear: data.fearChange || 0,
        friendship: data.friendshipChange || 0
      },
      contradiction: data.contradictionDetected ? {
        detected: true,
        reason: data.contradictionReason
      } : null
    };

  } catch (error) {
    console.error("Error generating NPC response:", error);
    // Fallback response if JSON parse or API fails
    return {
      response: "I... have nothing to say to you right now. Move along.",
      metricChanges: { trust: 0, respect: 0, fear: 0, friendship: 0 },
      contradiction: null
    };
  }
}

// Gossip System
export async function runGossipPhase(): Promise<GossipLog[]> {
  const state = getGameState();
  const sessionId = state.sessionId;
  const currentDay = state.day;

  // Gossip mapping (NPC ID -> List of possible targets they might gossip with)
  const gossipTargets: Record<string, string[]> = {
    blacksmith: ["guard", "merchant"],
    guard: ["blacksmith", "mayor"],
    merchant: ["guard", "mayor", "blacksmith"],
    mayor: ["guard", "merchant"]
  };

  const newGossipLogs: GossipLog[] = [];

  for (const [npcId, npc] of Object.entries(state.npcs)) {
    const containerTag = `${npcId}_${sessionId}`;
    
    // 1. Get all memories for this NPC
    const memories = await getNPCMemories(containerTag, "");
    if (memories.length === 0) continue;

    // Pick a target
    const targets = gossipTargets[npcId];
    const targetNpcId = targets[Math.floor(Math.random() * targets.length)];
    const targetNpcName = state.npcs[targetNpcId].name;

    const memoriesText = memories.map(m => `- ${m}`).join("\n");

    const prompt = `You are ${npc.name}, the ${npc.role}.
You are gossiping with ${targetNpcName} at the local tavern.
Here are all your memories and things you know:
${memoriesText}

Choose ONE juicy, interesting, or critical piece of information about the traveler (player) or a rumor that you have heard to share with ${targetNpcName}.
Do not share basic background facts about yourself (like "I am Hagar"). Share gossip about the player's claims, lies, actions, or reputation.
If you know nothing interesting, share that "the stranger is acting mysterious".

Return your answer as a JSON object matching this schema (Return ONLY JSON, no markdown):
{
  "gossipStatement": "The rumor you share (written in your voice)..."
}
`;

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();
      
      const jsonStr = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const data = JSON.parse(jsonStr);

      const gossipText = data.gossipStatement;

      // 2. Add this gossip to the target NPC's Supermemory
      const targetContainerTag = `${targetNpcId}_${sessionId}`;
      await addMemoryToSupermemory(targetContainerTag, `${npc.name} told you: "${gossipText}"`);

      // 3. Record in gossip logs
      newGossipLogs.push({
        day: currentDay,
        fromNpc: npcId,
        toNpc: targetNpcId,
        rumor: gossipText
      });

    } catch (err) {
      console.error(`Error generating gossip for ${npcId}:`, err);
    }
  }

  // Save logs and advance day
  state.gossipLogs.push(...newGossipLogs);
  state.day += 1;
  // Reward player with 15 coins for surviving the day
  state.coins = (state.coins ?? 30) + 15;
  
  // Decrease corruption by 15 for overnight buffer flushing
  state.corruption = Math.max(0, (state.corruption || 15) - 15);

  // Decaying suspicious states and resetting glitch/corrupted states overnight
  for (const npcId of Object.keys(state.npcs)) {
    const npc = state.npcs[npcId];
    if (npc.mood === "suspicious") {
      npc.metrics.trust = Math.max(0, npc.metrics.trust - 5);
    }
    if (npc.mood === "corrupted") {
      npc.mood = "calm";
    }
  }

  checkGameEndings(state);
  saveGameState(state);

  return newGossipLogs;
}

function checkGameEndings(state: GameState) {
  if (state.gameEnded) return;

  // Ending 0: System Lockdown (Global Corruption reaches 100%)
  if ((state.corruption || 15) >= 100) {
    state.gameEnded = true;
    state.endingType = "corruption";
    return;
  }

  const blacksmith = state.npcs.blacksmith.metrics;
  const guard = state.npcs.guard.metrics;
  const merchant = state.npcs.merchant.metrics;
  const mayor = state.npcs.mayor.metrics;

  // Ending 1: Get Arrested (Guard trust gets extremely low, fear/respect low)
  if (guard.trust < 15) {
    state.gameEnded = true;
    state.endingType = "arrested";
    return;
  }

  // Ending 2: Outcast (Everyone distrusts you)
  if (blacksmith.trust < 20 && guard.trust < 20 && merchant.trust < 20 && mayor.trust < 20) {
    state.gameEnded = true;
    state.endingType = "outcast";
    return;
  }

  // Ending 3: Become Mayor (Mayor trusts you completely and you have high respect)
  if (mayor.trust > 85 && mayor.respect > 80 && blacksmith.trust > 60 && guard.trust > 60) {
    state.gameEnded = true;
    state.endingType = "mayor";
    return;
  }

  // Ending 4: Become Wealthy Merchant's partner
  if (merchant.trust > 85 && merchant.friendship > 80) {
    state.gameEnded = true;
    state.endingType = "merchant";
    return;
  }

  // Ending 5: Everyone's Friend
  if (blacksmith.friendship > 80 && guard.friendship > 80 && merchant.friendship > 80 && mayor.friendship > 60) {
    state.gameEnded = true;
    state.endingType = "friend";
    return;
  }
}
