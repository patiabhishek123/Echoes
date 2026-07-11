"use client";

import { useEffect, useState, useRef } from "react";
import { 
  MessageSquare, Hammer, Shield, Coins, Crown, 
  AlertTriangle, Moon, RefreshCw, BookOpen, Activity,
  ThumbsUp, Award, Flame, Heart, ChevronRight, User, Loader2
} from "lucide-react";
import { GameState, NPC, ChatMessage, GossipLog } from "@/lib/gameService";

// Helper to map NPC icons
const npcIcons: Record<string, any> = {
  blacksmith: Hammer,
  guard: Shield,
  merchant: Coins,
  mayor: Crown,
};

// Coordinate mapping for SVG graph nodes
const nodeCoordinates: Record<string, { x: number; y: number }> = {
  blacksmith: { x: 100, y: 80 },
  guard: { x: 300, y: 80 },
  player: { x: 200, y: 200 },
  merchant: { x: 100, y: 320 },
  mayor: { x: 300, y: 320 },
};

export default function GamePage() {
  const [state, setState] = useState<GameState | null>(null);
  const [selectedNpcId, setSelectedNpcId] = useState<string>("blacksmith");
  const [inputValue, setInputValue] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [isTalking, setIsTalking] = useState<boolean>(false);
  const [isGossiping, setIsGossiping] = useState<boolean>(false);
  const [gossipAnimationLog, setGossipAnimationLog] = useState<GossipLog[]>([]);
  const [currentGossipIndex, setCurrentGossipIndex] = useState<number>(-1);
  const [lastNotification, setLastNotification] = useState<{
    message: string;
    type: "info" | "success" | "warning" | "error";
  } | null>(null);
  const [npcMemories, setNpcMemories] = useState<Record<string, string[]>>({});
  const [loadingMemories, setLoadingMemories] = useState<boolean>(false);
  const [activeRightTab, setActiveRightTab] = useState<"mind" | "memories">("mind");

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch current game state
  const fetchState = async () => {
    try {
      const res = await fetch("/api/state");
      const data = await res.json();
      setState(data);
      if (data) {
        // Fetch memories for the selected NPC on start
        fetchMemories(data.sessionId);
      }
    } catch (error) {
      showNotification("Failed to connect to the server.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Fetch memories directly from Supermemory via a helper endpoint or state API
  const fetchMemories = async (sessionId: string) => {
    if (!sessionId) return;
    setLoadingMemories(true);
    const memories: Record<string, string[]> = {};
    try {
      // Query each NPC's profile tag
      for (const npcId of ["blacksmith", "guard", "merchant", "mayor"]) {
        const res = await fetch("http://localhost:6767/v4/profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer sm_TJVd76vDvby6L3X1A7odNR_kcvgdl6FJk7bsxsh3G3QtcKTI0jAITaR6xzbeTe2YHUnKearEM0JkEC3Fc7EeFxS"
          },
          body: JSON.stringify({
            containerTag: `${npcId}_${sessionId}`,
            q: ""
          })
        });
        if (res.ok) {
          const data = await res.json();
          const facts = Array.from(new Set([
            ...(data?.profile?.static || []),
            ...(data?.profile?.dynamic || [])
          ])) as string[];
          // Filter out full conversation logs to keep it readable, showing just concrete facts
          memories[npcId] = facts.filter(f => !f.startsWith("Conversation on Day"));
        }
      }
      setNpcMemories(memories);
    } catch (e) {
      console.error("Error loading memories:", e);
    } finally {
      setLoadingMemories(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.conversations, selectedNpcId]);

  const showNotification = (message: string, type: "info" | "success" | "warning" | "error") => {
    setLastNotification({ message, type });
    setTimeout(() => {
      setLastNotification(prev => prev?.message === message ? null : prev);
    }, 6000);
  };

  // Handle chat submission
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isTalking || !state) return;

    const message = inputValue;
    setInputValue("");
    setIsTalking(true);

    // Optimistically update player message locally first for instant feedback
    const originalState = JSON.parse(JSON.stringify(state));
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updatedState = { ...state };
    updatedState.conversations[selectedNpcId] = [
      ...updatedState.conversations[selectedNpcId],
      { sender: "player", content: message, timestamp }
    ];
    setState(updatedState);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npcId: selectedNpcId, message })
      });

      if (!res.ok) {
        throw new Error("API call failed");
      }

      const result = await res.json();

      // Refresh full game state
      const stateRes = await fetch("/api/state");
      const freshState = await stateRes.json();
      setState(freshState);

      // Trigger alerts/notifications based on AI response
      if (result.contradiction?.detected) {
        showNotification(
          `LIE DETECTED! ${freshState.npcs[selectedNpcId].name} noticed an inconsistency: "${result.contradiction.reason}"`,
          "warning"
        );
      } else {
        const changes = result.metricChanges;
        const changeTexts = [];
        if (changes.trust !== 0) changeTexts.push(`Trust ${changes.trust > 0 ? "+" : ""}${changes.trust}`);
        if (changes.friendship !== 0) changeTexts.push(`Friendship ${changes.friendship > 0 ? "+" : ""}${changes.friendship}`);
        
        if (changeTexts.length > 0) {
          showNotification(`${freshState.npcs[selectedNpcId].name}: ${changeTexts.join(", ")}`, "success");
        }
      }

      // Refresh memories display
      fetchMemories(freshState.sessionId);

    } catch (error) {
      setState(originalState);
      showNotification("Failed to send message. Is the server running?", "error");
    } finally {
      setIsTalking(false);
    }
  };

  // Advance Day & Trigger Gossip phase
  const handleAdvanceDay = async () => {
    if (isGossiping || !state) return;

    setIsGossiping(true);
    showNotification("Gathering at the tavern... rumors are starting to spread.", "info");

    try {
      const res = await fetch("/api/gossip", { method: "POST" });
      if (!res.ok) throw new Error("Gossip phase failed");

      const data = await res.json();
      setGossipAnimationLog(data.gossipLogs);
      
      // Run sequential gossip animation
      if (data.gossipLogs.length > 0) {
        let idx = 0;
        setCurrentGossipIndex(0);
        
        const interval = setInterval(() => {
          idx += 1;
          if (idx < data.gossipLogs.length) {
            setCurrentGossipIndex(idx);
          } else {
            clearInterval(interval);
            setCurrentGossipIndex(-1);
            setGossipAnimationLog([]);
            setState(data.state);
            showNotification(`Day ${data.state.day} has begun. The village whispers...`, "info");
            fetchMemories(data.state.sessionId);
            setIsGossiping(false);
          }
        }, 5000); // 5 seconds per rumor
      } else {
        setState(data.state);
        setIsGossiping(false);
      }
    } catch (error) {
      showNotification("Failed to advance day. Connection error.", "error");
      setIsGossiping(false);
    }
  };

  // Reset Game
  const handleResetGame = async () => {
    if (!confirm("Are you sure you want to restart? This will clear all memories.")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" })
      });
      const data = await res.json();
      setState(data);
      setSelectedNpcId("blacksmith");
      setNpcMemories({});
      showNotification("Game reset. Welcome back to Echoes.", "success");
      setTimeout(() => fetchMemories(data.sessionId), 1000);
    } catch (e) {
      showNotification("Failed to reset game.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading || !state) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-100 min-h-screen">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-400 font-mono tracking-widest text-sm">LOADING VILLAGE OF ECHOES...</p>
      </div>
    );
  }

  const selectedNpc = state.npcs[selectedNpcId];
  const conversations = state.conversations[selectedNpcId] || [];

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 font-sans min-h-screen overflow-x-hidden relative">
      
      {/* Glow Effects */}
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-emerald-950/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[10%] w-[600px] h-[600px] rounded-full bg-blue-950/10 blur-[150px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h1 className="text-xl font-bold tracking-widest font-mono text-emerald-400">ECHOES</h1>
            <p className="text-[10px] text-slate-500 tracking-wider">A SOCIAL SIMULATION POWERED BY SUPERMEMORY</p>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-1.5 flex items-center space-x-3">
            <span className="text-slate-400 text-xs font-mono">CALENDAR:</span>
            <span className="text-emerald-400 font-mono font-bold tracking-wider">DAY {state.day}</span>
          </div>

          <button 
            onClick={handleAdvanceDay}
            disabled={isGossiping || state.gameEnded}
            className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-slate-950 font-bold px-4 py-2 rounded-lg text-sm transition shadow-lg shadow-emerald-950/20 cursor-pointer"
          >
            <Moon className="w-4 h-4" />
            <span>{isGossiping ? "GOSSIPING..." : "END DAY (SLEEP)"}</span>
          </button>

          <button 
            onClick={handleResetGame}
            title="Reset Game"
            className="p-2 border border-slate-800 hover:bg-slate-900 rounded-lg transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-slate-400 hover:text-white" />
          </button>
        </div>
      </header>

      {/* Notification Toast */}
      {lastNotification && (
        <div className={`fixed top-20 right-6 z-50 flex items-center space-x-3 px-5 py-3 rounded-xl border max-w-md shadow-2xl animate-in slide-in-from-top-4 duration-300 ${
          lastNotification.type === "warning" ? "bg-amber-950/80 border-amber-800 text-amber-200" :
          lastNotification.type === "success" ? "bg-emerald-950/80 border-emerald-800 text-emerald-200" :
          lastNotification.type === "error" ? "bg-red-950/80 border-red-800 text-red-200" :
          "bg-slate-900/90 border-slate-700 text-slate-100"
        }`}>
          {lastNotification.type === "warning" && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />}
          <p className="text-sm font-medium">{lastNotification.message}</p>
        </div>
      )}

      {/* Gossip Overlay */}
      {currentGossipIndex !== -1 && gossipAnimationLog[currentGossipIndex] && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md p-6 animate-fade-in">
          <div className="absolute top-[20%] text-center">
            <Moon className="w-16 h-16 text-indigo-400 animate-bounce mx-auto mb-4" />
            <h2 className="text-2xl font-bold tracking-widest font-mono text-indigo-400">THE TAVERN AT NIGHT</h2>
            <p className="text-slate-500 text-sm mt-1">Whispers fill the dark corner booths...</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 max-w-2xl text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
            
            <div className="flex items-center justify-center space-x-6 mb-6">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-indigo-500">
                  <img src={state.npcs[gossipAnimationLog[currentGossipIndex].fromNpc].portrait} alt="Gossip speaker" className="w-full h-full object-cover" />
                </div>
                <span className="text-xs text-indigo-400 mt-2 font-mono">{state.npcs[gossipAnimationLog[currentGossipIndex].fromNpc].name}</span>
              </div>

              <div className="flex items-center space-x-2 text-indigo-500 animate-pulse">
                <span className="h-0.5 w-16 bg-indigo-900 relative">
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                </span>
                <MessageSquare className="w-6 h-6" />
                <span className="h-0.5 w-16 bg-indigo-900 relative">
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                </span>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-indigo-500">
                  <img src={state.npcs[gossipAnimationLog[currentGossipIndex].toNpc].portrait} alt="Gossip target" className="w-full h-full object-cover" />
                </div>
                <span className="text-xs text-indigo-400 mt-2 font-mono">{state.npcs[gossipAnimationLog[currentGossipIndex].toNpc].name}</span>
              </div>
            </div>

            <p className="text-xl italic font-serif text-slate-100 px-4 leading-relaxed">
              &ldquo;{gossipAnimationLog[currentGossipIndex].rumor}&rdquo;
            </p>
          </div>

          <div className="absolute bottom-[20%] text-slate-600 font-mono text-xs">
            RUMOR {currentGossipIndex + 1} OF {gossipAnimationLog.length} · AUTOMATICALLY PROGRESSING
          </div>
        </div>
      )}

      {/* Main Game Interface */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-hidden">
        
        {/* Left Panel: NPC Selection & Village Map (3 cols) */}
        <div className="lg:col-span-3 flex flex-col space-y-4">
          <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 flex-1 flex flex-col">
            <h2 className="text-xs font-bold tracking-widest text-slate-500 font-mono mb-4 uppercase">VILLAGE INHABITANTS</h2>
            
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {Object.values(state.npcs).map((npc) => {
                const Icon = npcIcons[npc.id];
                const isSelected = selectedNpcId === npc.id;
                
                return (
                  <button
                    key={npc.id}
                    onClick={() => {
                      setSelectedNpcId(npc.id);
                      showNotification(`Inspecting ${npc.name}`, "info");
                    }}
                    className={`w-full text-left rounded-xl p-3 border transition flex items-center space-x-3 cursor-pointer ${
                      isSelected
                        ? "bg-slate-900/90 border-emerald-800/80 shadow-md shadow-emerald-950/10"
                        : "bg-slate-950 border-slate-900 hover:border-slate-800 hover:bg-slate-900/30"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-800 shrink-0">
                      <img src={npc.portrait} alt={npc.name} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-200 truncate">{npc.name}</span>
                        {Icon && <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-emerald-400 animate-pulse" : "text-slate-600"}`} />}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{npc.role}</p>
                      
                      {/* Mini trust bar */}
                      <div className="mt-1.5 w-full bg-slate-900 rounded-full h-1 relative overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            npc.metrics.trust > 70 ? "bg-emerald-500" :
                            npc.metrics.trust < 30 ? "bg-red-500" : "bg-blue-500"
                          }`}
                          style={{ width: `${npc.metrics.trust}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-slate-900 pt-4 mt-4">
              <div className="bg-slate-950 border border-slate-900 rounded-xl p-3 text-xs text-slate-400">
                <span className="font-bold text-slate-300 block mb-1">💡 Gameplay Tip</span>
                Tell Silas a lie, but tell Kael the truth. See if Silas gossips and gets you arrested! NPCs share memories via Supermemory at day end.
              </div>
            </div>
          </div>
        </div>

        {/* Center Panel: Dialogue Area (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="bg-slate-900/40 border border-slate-900 rounded-xl flex-1 flex flex-col overflow-hidden">
            
            {/* Active NPC Header */}
            <div className="border-b border-slate-900 bg-slate-900/20 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-800">
                  <img src={selectedNpc.portrait} alt={selectedNpc.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-200 text-sm">{selectedNpc.name}</h3>
                  <p className="text-xs text-emerald-400 tracking-wide">{selectedNpc.role}</p>
                </div>
              </div>

              <span className="text-[10px] bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full font-mono text-slate-400">
                RELATIONSHIP LOG
              </span>
            </div>

            {/* Chat Box */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {conversations.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-6">
                  <MessageSquare className="w-10 h-10 text-slate-700 mb-2 animate-bounce" />
                  <p className="text-slate-500 text-sm">No words have been exchanged yet.</p>
                  <p className="text-xs text-slate-600 max-w-xs mt-1">Speak naturally to Hagar. Tell them who you are, or ask about other villagers.</p>
                </div>
              ) : (
                conversations.map((msg, i) => {
                  const isPlayer = msg.sender === "player";
                  return (
                    <div 
                      key={i} 
                      className={`flex ${isPlayer ? "justify-end" : "justify-start"} animate-in fade-in duration-200`}
                    >
                      <div className={`max-w-[85%] rounded-2xl p-3.5 text-sm ${
                        isPlayer 
                          ? "bg-emerald-600 text-slate-950 rounded-tr-none font-medium shadow-md shadow-emerald-950/10" 
                          : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none font-serif leading-relaxed"
                      }`}>
                        <div className="flex items-center justify-between space-x-4 mb-1">
                          <span className={`text-[10px] font-bold tracking-wider font-mono ${
                            isPlayer ? "text-slate-900" : "text-emerald-400"
                          }`}>
                            {isPlayer ? "YOU" : selectedNpc.name.toUpperCase()}
                          </span>
                          <span className="text-[9px] opacity-60 font-mono">{msg.timestamp}</span>
                        </div>
                        <p className="whitespace-pre-line">{msg.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
              {isTalking && (
                <div className="flex justify-start">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none p-3 max-w-[85%] flex items-center space-x-3">
                    <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                    <span className="text-slate-400 text-xs font-mono">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="border-t border-slate-900 p-4 bg-slate-950/60">
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={`Speak to ${selectedNpc.name}... (e.g., 'I am a brave knight' or 'Silas told me a secret')`}
                  disabled={isTalking || state.gameEnded}
                  className="flex-1 bg-slate-900/90 border border-slate-800 hover:border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isTalking || state.gameEnded}
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold px-5 py-3 rounded-xl text-sm transition flex items-center space-x-1.5 cursor-pointer shrink-0"
                >
                  <span>SPEAK</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </form>

          </div>
        </div>

        {/* Right Panel: Village Mind (4 cols) */}
        <div className="lg:col-span-4 flex flex-col space-y-4">
          
          {/* Ending State Overlay */}
          {state.gameEnded && (
            <div className="bg-red-950/20 border-2 border-red-800/80 rounded-xl p-6 text-center relative overflow-hidden shadow-xl animate-pulse">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-orange-600" />
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              
              <h3 className="text-xl font-bold font-mono tracking-widest text-red-400 uppercase">
                {state.endingType === "arrested" && "GAME OVER: ARRESTED"}
                {state.endingType === "outcast" && "GAME OVER: OUTCAST"}
                {state.endingType === "mayor" && "VICTORY: VILLAGE LEADER"}
                {state.endingType === "merchant" && "VICTORY: MERCHANT KINGPIN"}
                {state.endingType === "friend" && "VICTORY: EVERYONE'S FRIEND"}
              </h3>
              
              <p className="text-sm text-slate-300 mt-2 leading-relaxed font-serif italic">
                {state.endingType === "arrested" && "Your lies caught up with you. Captain Kael found a contradiction in your stories, declared you a liar and a spy, and locked you in the dungeon forever."}
                {state.endingType === "outcast" && "Rumors of your inconsistencies and shifty behavior spread like wildfire. Nobody trusts you, and they have driven you out of Echoes."}
                {state.endingType === "mayor" && "Through charisma, honesty, and strategic alliances, Mayor Evelyn trust you entirely and has appointed you as the new leader of the village."}
                {state.endingType === "merchant" && "Silas loved your business secrets. You've established a trade monopoly and become the richest merchant partner in Echoes."}
                {state.endingType === "friend" && "Your warmth, helpfulness, and consistent honesty made you a legend in Echoes. The village welcomes you as one of their own."}
              </p>

              <button
                onClick={handleResetGame}
                className="mt-5 bg-red-800 hover:bg-red-700 text-white font-mono text-xs tracking-wider px-6 py-2.5 rounded-lg transition"
              >
                PLAY AGAIN
              </button>
            </div>
          )}

          {/* Tab selectors */}
          <div className="flex bg-slate-900 border border-slate-900 rounded-xl p-1 shrink-0">
            <button
              onClick={() => setActiveRightTab("mind")}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs font-mono rounded-lg transition cursor-pointer ${
                activeRightTab === "mind" 
                  ? "bg-slate-800 text-emerald-400 font-bold" 
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>VILLAGE MIND</span>
            </button>
            <button
              onClick={() => setActiveRightTab("memories")}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs font-mono rounded-lg transition cursor-pointer ${
                activeRightTab === "memories" 
                  ? "bg-slate-800 text-emerald-400 font-bold" 
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>AI MEMORY VAULT</span>
            </button>
          </div>

          {activeRightTab === "mind" ? (
            /* Village Mind Panel */
            <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 flex-1 flex flex-col">
              <h2 className="text-xs font-bold tracking-widest text-slate-500 font-mono mb-2 uppercase">SOCIAL DYNAMICS</h2>
              
              {/* SVG Relationship Graph */}
              <div className="flex-1 bg-slate-950 rounded-xl border border-slate-900 relative overflow-hidden flex items-center justify-center min-h-[300px]">
                
                {/* Background Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#090d16_1px,transparent_1px),linear-gradient(to_bottom,#090d16_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none opacity-40" />

                <svg className="w-full h-full absolute inset-0" viewBox="0 0 400 400">
                  <defs>
                    <marker id="arrow" viewBox="0 0 10 10" refX="15" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#047857" />
                    </marker>
                    <marker id="gossip-arrow" viewBox="0 0 10 10" refX="15" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#818cf8" />
                    </marker>
                  </defs>

                  {/* 1. Permanent Social Bonds */}
                  {/* Blacksmith <-> Guard */}
                  <line x1={nodeCoordinates.blacksmith.x} y1={nodeCoordinates.blacksmith.y} x2={nodeCoordinates.guard.x} y2={nodeCoordinates.guard.y} stroke="#1e293b" strokeWidth="2" strokeDasharray="3,3" />
                  
                  {/* Blacksmith <-> Merchant */}
                  <line x1={nodeCoordinates.blacksmith.x} y1={nodeCoordinates.blacksmith.y} x2={nodeCoordinates.merchant.x} y2={nodeCoordinates.merchant.y} stroke="#311" strokeWidth="2" />
                  
                  {/* Guard <-> Mayor */}
                  <line x1={nodeCoordinates.guard.x} y1={nodeCoordinates.guard.y} x2={nodeCoordinates.mayor.x} y2={nodeCoordinates.mayor.y} stroke="#1e293b" strokeWidth="2" strokeDasharray="3,3" />
                  
                  {/* Merchant <-> Mayor */}
                  <line x1={nodeCoordinates.merchant.x} y1={nodeCoordinates.merchant.y} x2={nodeCoordinates.mayor.x} y2={nodeCoordinates.mayor.y} stroke="#1e293b" strokeWidth="2" strokeDasharray="3,3" />

                  {/* 2. Active Player Trust Bonds (glowing colored lines) */}
                  {Object.entries(state.npcs).map(([id, npc]) => {
                    const coords = nodeCoordinates[id];
                    const playerCoords = nodeCoordinates.player;
                    const trustPercent = npc.metrics.trust / 100;
                    
                    // Color based on trust
                    const strokeColor = 
                      npc.metrics.trust > 70 ? "rgba(16,185,129,0.4)" :
                      npc.metrics.trust < 30 ? "rgba(239,68,68,0.4)" : 
                      "rgba(59,130,246,0.3)";

                    return (
                      <g key={id}>
                        <line 
                          x1={playerCoords.x} 
                          y1={playerCoords.y} 
                          x2={coords.x} 
                          y2={coords.y} 
                          stroke={strokeColor} 
                          strokeWidth={2 + trustPercent * 3}
                          markerEnd="url(#arrow)"
                        />
                        {/* Trust text on the lines */}
                        <text 
                          x={(playerCoords.x + coords.x) / 2} 
                          y={(playerCoords.y + coords.y) / 2 - 5}
                          fill={npc.metrics.trust > 70 ? "#10b981" : npc.metrics.trust < 30 ? "#ef4444" : "#3b82f6"}
                          fontSize="9"
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          T:{npc.metrics.trust}
                        </text>
                      </g>
                    );
                  })}

                  {/* 3. Render Nodes */}
                  {/* Player Node */}
                  <g className="cursor-pointer">
                    <circle cx={nodeCoordinates.player.x} cy={nodeCoordinates.player.y} r="16" fill="#1e293b" stroke="#10b981" strokeWidth="2" />
                    <User className="w-5 h-5 text-emerald-400 absolute" style={{ 
                      left: nodeCoordinates.player.x - 10, 
                      top: nodeCoordinates.player.y - 10,
                      transform: 'translate(4px, 4px)'
                    }} />
                    <text x={nodeCoordinates.player.x} y={nodeCoordinates.player.y + 26} fill="#10b981" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">PLAYER</text>
                  </g>

                  {/* NPC Nodes */}
                  {Object.entries(state.npcs).map(([id, npc]) => {
                    const coords = nodeCoordinates[id];
                    const isSelected = selectedNpcId === id;
                    
                    return (
                      <g 
                        key={id} 
                        className="cursor-pointer"
                        onClick={() => setSelectedNpcId(id)}
                      >
                        <circle 
                          cx={coords.x} 
                          cy={coords.y} 
                          r="20" 
                          fill="#0f172a" 
                          stroke={isSelected ? "#10b981" : "#1e293b"} 
                          strokeWidth={isSelected ? "3" : "1.5"} 
                        />
                        <foreignObject 
                          x={coords.x - 16} 
                          y={coords.y - 16} 
                          width="32" 
                          height="32" 
                          className="rounded-full overflow-hidden"
                        >
                          <img src={npc.portrait} alt={npc.name} className="w-full h-full object-cover" />
                        </foreignObject>
                        <text 
                          x={coords.x} 
                          y={coords.y + 32} 
                          fill={isSelected ? "#10b981" : "#94a3b8"} 
                          fontSize="9" 
                          fontFamily="monospace" 
                          textAnchor="middle"
                        >
                          {npc.name.toUpperCase()}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Metrics block for selected NPC */}
              <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 mt-4 space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-800">
                    <img src={selectedNpc.portrait} alt={selectedNpc.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 tracking-wider font-mono">{selectedNpc.name.toUpperCase()}&rsquo;S STANDING</h4>
                    <p className="text-[10px] text-slate-500 font-serif italic">{selectedNpc.relationships}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-slate-900/60 border border-slate-900 rounded-lg p-2.5 flex items-center space-x-2.5">
                    <ThumbsUp className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <span className="text-[9px] text-slate-500 block font-mono">TRUST</span>
                      <span className="text-sm font-bold font-mono text-slate-200">{selectedNpc.metrics.trust}%</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-900 rounded-lg p-2.5 flex items-center space-x-2.5">
                    <Award className="w-4 h-4 text-blue-500 shrink-0" />
                    <div>
                      <span className="text-[9px] text-slate-500 block font-mono">RESPECT</span>
                      <span className="text-sm font-bold font-mono text-slate-200">{selectedNpc.metrics.respect}%</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-900 rounded-lg p-2.5 flex items-center space-x-2.5">
                    <Flame className="w-4 h-4 text-orange-500 shrink-0" />
                    <div>
                      <span className="text-[9px] text-slate-500 block font-mono">FEAR</span>
                      <span className="text-sm font-bold font-mono text-slate-200">{selectedNpc.metrics.fear}%</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-900 rounded-lg p-2.5 flex items-center space-x-2.5">
                    <Heart className="w-4 h-4 text-pink-500 shrink-0" />
                    <div>
                      <span className="text-[9px] text-slate-500 block font-mono">FRIENDSHIP</span>
                      <span className="text-sm font-bold font-mono text-slate-200">{selectedNpc.metrics.friendship}%</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            /* Stored Memories Vault (Supermemory inspector) */
            <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-bold tracking-widest text-slate-500 font-mono uppercase">NPC MEMORIES</h2>
                {loadingMemories && <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />}
              </div>

              <div className="flex-1 bg-slate-950 rounded-xl border border-slate-900 overflow-y-auto p-4 space-y-4">
                
                <div className="flex items-center space-x-2 border-b border-slate-900 pb-2">
                  <div className="w-6 h-6 rounded-full overflow-hidden border border-slate-800">
                    <img src={selectedNpc.portrait} alt={selectedNpc.name} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-xs text-slate-300 font-bold">{selectedNpc.name} holds {npcMemories[selectedNpcId]?.length || 0} memories:</span>
                </div>

                {npcMemories[selectedNpcId] && npcMemories[selectedNpcId].length > 0 ? (
                  <ul className="space-y-2.5">
                    {npcMemories[selectedNpcId].map((mem, index) => (
                      <li 
                        key={index}
                        className="bg-slate-900/60 border border-slate-850 rounded-lg p-3 text-xs leading-relaxed text-slate-300 font-serif border-l-2 border-l-emerald-500 hover:bg-slate-900 transition"
                      >
                        {mem}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6">
                    <BookOpen className="w-8 h-8 text-slate-800 mb-2" />
                    <p className="text-slate-600 text-xs">No stored facts in {selectedNpc.name}&rsquo;s mind.</p>
                    <p className="text-[10px] text-slate-700 max-w-xs mt-1">Talk to them or advance the day to spread gossip and seed memories.</p>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-900 pt-3 mt-3 flex items-center justify-between text-[10px] text-slate-500">
                <span>NAMESPACE: <code className="text-emerald-500 font-mono">{selectedNpcId}_{state.sessionId}</code></span>
                <button 
                  onClick={() => fetchMemories(state.sessionId)}
                  className="hover:text-white transition flex items-center space-x-1 font-mono uppercase tracking-wider"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>REFRESH VAULT</span>
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
