import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini
const geminiApiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(geminiApiKey);

// Supermemory configuration
const supermemoryUrl = process.env.SUPERMEMORY_API_URL || "http://localhost:6767";
const supermemoryKey = process.env.SUPERMEMORY_API_KEY || "";

const STATE_FILE_PATH = path.join(process.cwd(), "gamestate.json");

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

export interface GameState {
  sessionId: string;
  day: number;
  gameEnded: boolean;
  endingType: "mayor" | "friend" | "outcast" | "arrested" | "merchant" | null;
  npcs: Record<string, NPC>;
  conversations: Record<string, ChatMessage[]>;
  gossipLogs: GossipLog[];
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
  },
  guard: {
    id: "guard",
    name: "Captain Kael",
    role: "Captain of the Guard",
    portrait: "/portraits/guard.png",
    metrics: { trust: 40, respect: 50, fear: 20, friendship: 20 },
    relationships: "Close friend of Hagar the Blacksmith. Suspicious of outsiders.",
    personality: "Stern, vigilant, orderly, and highly disciplined. Values consistency, law, and security. Suspicious of anyone whose story changes or who acts shifty.",
  },
  merchant: {
    id: "merchant",
    name: "Silas",
    role: "Merchant",
    portrait: "/portraits/merchant.png",
    metrics: { trust: 60, respect: 30, fear: 5, friendship: 40 },
    relationships: "Always looking for trade secrets. Finds Mayor Evelyn intimidating.",
    personality: "Sly, charismatic, gossipy, and greedy. Loves gold, rumors, and knowing things others don't. Can be bribed with info or promises, but will sell out secrets just as fast.",
  },
  mayor: {
    id: "mayor",
    name: "Mayor Evelyn",
    role: "Village Mayor",
    portrait: "/portraits/mayor.png",
    metrics: { trust: 30, respect: 60, fear: 15, friendship: 10 },
    relationships: "Demands respect. Keeps a close eye on Silas.",
    personality: "Dignified, elderly, politically minded, and secretive. Values status, respect, decorum, and the safety of the village. Suspicious of outsiders trying to gain influence.",
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
      gameEnded: false,
      endingType: null,
      npcs: JSON.parse(JSON.stringify(INITIAL_NPCS)),
      conversations: {
        blacksmith: [],
        guard: [],
        merchant: [],
        mayor: []
      },
      gossipLogs: []
    };
    saveGameState(newState);
    return newState;
  }

  try {
    const data = fs.readFileSync(STATE_FILE_PATH, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading game state, recreating:", error);
    const newState: GameState = {
      sessionId: Math.random().toString(36).substring(2, 10),
      day: 1,
      gameEnded: false,
      endingType: null,
      npcs: JSON.parse(JSON.stringify(INITIAL_NPCS)),
      conversations: {
        blacksmith: [],
        guard: [],
        merchant: [],
        mayor: []
      },
      gossipLogs: []
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
    gameEnded: false,
    endingType: null,
    npcs: JSON.parse(JSON.stringify(INITIAL_NPCS)),
    conversations: {
      blacksmith: [],
      guard: [],
      merchant: [],
      mayor: []
    },
    gossipLogs: []
  };

  saveGameState(newState);

  // Seed the fresh Supermemory tags in the background (fire-and-forget for speed)
  for (const [npcId, memories] of Object.entries(SEED_MEMORIES)) {
    const containerTag = `${npcId}_${sessionId}`;
    for (const memory of memories) {
      addMemoryToSupermemory(containerTag, memory).catch(err => 
        console.error(`Error seeding memory for ${npcId}:`, err)
      );
    }
  }

  return newState;
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
      console.error(`Supermemory add error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error("Failed to add memory to Supermemory:", error);
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
      console.error(`Supermemory profile error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const dynamicMemories = data?.profile?.dynamic || [];
    const staticMemories = data?.profile?.static || [];
    const searchResults = data?.searchResults?.results?.map((r: any) => r.memory) || [];

    // Combine unique memories
    const all = Array.from(new Set([...staticMemories, ...dynamicMemories, ...searchResults]));
    return all as string[];
  } catch (error) {
    console.error("Failed to fetch memories from Supermemory:", error);
    return [];
  }
}

export async function getNPCMemoriesForFront(npcId: string): Promise<string[]> {
  const state = getGameState();
  const containerTag = `${npcId}_${state.sessionId}`;
  const memories = await getNPCMemories(containerTag, "");
  return memories.filter(f => !f.startsWith("Conversation on Day"));
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

  // 2. Build the LLM prompt
  const systemPrompt = `You are playing the role of ${npc.name}, the ${npc.role} in a medieval village simulation.
Personality: ${npc.personality}
Relationships: ${npc.relationships}

Current relationship metrics with the Player:
- Trust: ${npc.metrics.trust}/100 (High trust means they believe you, low trust means suspicious/hostile)
- Respect: ${npc.metrics.respect}/100 (High respect means they value your words, low respect means they look down on you)
- Fear: ${npc.metrics.fear}/100 (High fear means they are intimidated, low fear means they feel safe/dominant)
- Friendship: ${npc.metrics.friendship}/100 (High friendship means they are warm/helpful, low means cold)

Here are your retrieved memories & facts about the player or village:
${memoriesContext}

The player says: "${playerMessage}"

Generate your response as a valid JSON object matching the schema below. Keep the dialogue concise (1-3 sentences), highly thematic, and in character.
You must analyze the player's message:
- Check for contradictions or lies: compare what the player says against your memories. For example, if your memories say "The player claimed they are a knight" and they now say "I'm just a simple traveler", that is a contradiction/lie!
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
  "contradictionReason": "Explain what contradiction you noticed in their statements relative to your memories (leave empty if none)",
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

    // 3. Update NPC metrics in Game State
    npc.metrics.trust = Math.max(0, Math.min(100, npc.metrics.trust + (data.trustChange || 0)));
    npc.metrics.respect = Math.max(0, Math.min(100, npc.metrics.respect + (data.respectChange || 0)));
    npc.metrics.fear = Math.max(0, Math.min(100, npc.metrics.fear + (data.fearChange || 0)));
    npc.metrics.friendship = Math.max(0, Math.min(100, npc.metrics.friendship + (data.friendshipChange || 0)));

    // 4. Save player message and NPC response in conversation log
    state.conversations[npcId].push({
      sender: "player",
      content: playerMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    state.conversations[npcId].push({
      sender: "npc",
      content: data.response,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    // 5. Ingest new facts into Supermemory
    if (data.newFactsToRemember && data.newFactsToRemember.length > 0) {
      for (const fact of data.newFactsToRemember) {
        await addMemoryToSupermemory(containerTag, `The player told you: ${fact}`);
      }
    }

    // Ingest the conversation snippet too for dynamic context
    await addMemoryToSupermemory(containerTag, `Conversation on Day ${state.day} - Player: "${playerMessage}" | You: "${data.response}"`);

    // If contradiction detected, add that memory too so they remember the lie
    if (data.contradictionDetected) {
      await addMemoryToSupermemory(containerTag, `You caught the player lying: ${data.contradictionReason}`);
    }

    // Check endings
    checkGameEndings(state);
    saveGameState(state);

    return {
      response: data.response,
      metricChanges: {
        trust: data.trustChange || 0,
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
  checkGameEndings(state);
  saveGameState(state);

  return newGossipLogs;
}

function checkGameEndings(state: GameState) {
  if (state.gameEnded) return;

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
