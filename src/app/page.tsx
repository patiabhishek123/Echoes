"use client";

import { useEffect, useState, useRef } from "react";
import { 
  MessageSquare, Hammer, Shield, Coins, Crown, 
  AlertTriangle, Moon, RefreshCw, BookOpen, Activity,
  ChevronRight, User, Loader2
} from "lucide-react";
import { GameState, NPC, ChatMessage, GossipLog } from "@/lib/gameService";

const npcIcons: Record<string, any> = {
  blacksmith: Hammer,
  guard: Shield,
  merchant: Coins,
  mayor: Crown,
};

// SVG coordinates for blueprint graph
const nodeCoordinates: Record<string, { x: number; y: number }> = {
  blacksmith: { x: 80, y: 70 },
  guard: { x: 270, y: 70 },
  player: { x: 175, y: 175 },
  merchant: { x: 80, y: 280 },
  mayor: { x: 270, y: 280 },
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
  const [activeConsoleTab, setActiveConsoleTab] = useState<"mind" | "vault">("mind");

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch current game state
  const fetchState = async () => {
    try {
      const res = await fetch("/api/state");
      const data = await res.json();
      setState(data);
      if (data) {
        fetchMemories(data.sessionId);
      }
    } catch (error) {
      showNotification("FAILED TO RETRIEVE VILLAGE STATE LOGS.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Fetch memories using our secure backend API to prevent CORS issues
  const fetchMemories = async (sessionId: string) => {
    if (!sessionId) return;
    setLoadingMemories(true);
    const memories: Record<string, string[]> = {};
    try {
      for (const npcId of ["blacksmith", "guard", "merchant", "mayor"]) {
        const res = await fetch(`/api/memories?npcId=${npcId}`);
        if (res.ok) {
          const data = await res.json();
          memories[npcId] = data;
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.conversations, selectedNpcId]);

  const showNotification = (message: string, type: "info" | "success" | "warning" | "error") => {
    setLastNotification({ message, type });
    setTimeout(() => {
      setLastNotification(prev => prev?.message === message ? null : prev);
    }, 6000);
  };

  // Handle player message submission
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isTalking || !state) return;

    const message = inputValue;
    setInputValue("");
    setIsTalking(true);

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

      if (!res.ok) throw new Error("Chat request failed");

      const result = await res.json();

      // Refresh state
      const stateRes = await fetch("/api/state");
      const freshState = await stateRes.json();
      setState(freshState);

      if (result.contradiction?.detected) {
        showNotification(
          `CONTRADICTION DETECTED! ${freshState.npcs[selectedNpcId].name} noticed an inconsistency: "${result.contradiction.reason}"`,
          "warning"
        );
      } else {
        const changes = result.metricChanges;
        const changeTexts = [];
        if (changes.trust !== 0) changeTexts.push(`Trust ${changes.trust > 0 ? "+" : ""}${changes.trust}`);
        if (changes.friendship !== 0) changeTexts.push(`Friendship ${changes.friendship > 0 ? "+" : ""}${changes.friendship}`);
        
        if (changeTexts.length > 0) {
          showNotification(`${freshState.npcs[selectedNpcId].name} reputation updated: ${changeTexts.join(", ")}`, "success");
        }
      }

      fetchMemories(freshState.sessionId);

    } catch (error) {
      setState(originalState);
      showNotification("FAILED TO COMMUNICATE WITH VILLAGER.", "error");
    } finally {
      setIsTalking(false);
    }
  };

  // Sleep/Advance Day
  const handleAdvanceDay = async () => {
    if (isGossiping || !state) return;

    setIsGossiping(true);
    showNotification("THE VINTAGE INN GROWS LOUD... RUMORS PROPAGATING...", "info");

    try {
      const res = await fetch("/api/gossip", { method: "POST" });
      if (!res.ok) throw new Error("Gossip cycle failed");

      const data = await res.json();
      setGossipAnimationLog(data.gossipLogs);
      
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
            showNotification(`DAY ${data.state.day} STARTED. MEMORY VAULTS STABILIZED.`, "info");
            fetchMemories(data.state.sessionId);
            setIsGossiping(false);
          }
        }, 5000);
      } else {
        setState(data.state);
        setIsGossiping(false);
      }
    } catch (error) {
      showNotification("DAY TRANSITION FAILED. DISCONNECTION DETECTED.", "error");
      setIsGossiping(false);
    }
  };

  // Reset Game
  const handleResetGame = async () => {
    if (!confirm("WIPE ENGINE MEMORY VAULTS AND REBOOT?")) return;
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
      showNotification("SYSTEM DEFRAGMENTED. SEED MEMORIES ESTABLISHED.", "success");
      setTimeout(() => fetchMemories(data.sessionId), 1000);
    } catch (e) {
      showNotification("FAILED TO EXECUTE REBOOT.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Helper to generate terminal progress bar
  const renderProgressBar = (value: number) => {
    const barsCount = Math.round(value / 10);
    const emptyCount = 10 - barsCount;
    return `[${"█".repeat(barsCount)}${"░".repeat(emptyCount)}] ${value}%`;
  };

  if (loading || !state) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center bg-[#05010b] text-[#00f0ff] min-h-screen scanlines">
        <Loader2 className="w-12 h-12 text-[#00f0ff] animate-spin mb-4" />
        <p className="font-mono tracking-widest text-xs uppercase animate-pulse">INITIATING COGNITIVE TERMINAL SYSTEM...</p>
      </div>
    );
  }

  const selectedNpc = state.npcs[selectedNpcId];
  const conversations = state.conversations[selectedNpcId] || [];
  const latestNpcMessage = conversations.slice().reverse().find(c => c.sender === "npc")?.content || 
    `Select a target from the location terminal below and state your purpose.`;

  return (
    <div className="min-h-screen flex flex-col bg-[#05010b] text-[#e2e8f0] relative select-none font-sans overflow-hidden pb-10">
      
      {/* Scanline Overlay */}
      <div className="scanlines" />

      {/* Top Banner (VA-11 Hall-A Marquee) */}
      <div className="bg-[#00f0ff] text-[#05010b] h-6 flex items-center overflow-hidden border-b border-[#00f0ff] z-40 select-none">
        <div className="animate-marquee inline-block font-mono text-[10px] font-bold tracking-widest uppercase">
          ECHOES: CYBERPUNK SOCIAL SIMULATION • POWERED BY SUPERMEMORY AI • STATUS: OPERATIONAL • DAY: {state.day} • ECHOES: CYBERPUNK SOCIAL SIMULATION • POWERED BY SUPERMEMORY AI • STATUS: OPERATIONAL • DAY: {state.day} •
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-6 pt-6 gap-6 relative z-10 crt-screen">
        
        {/* Upper Screen View: Player, Location, NPC monitors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          
          {/* Player Monitor */}
          <div className="monitor-bezel rounded p-4 flex flex-col items-center justify-center text-center">
            {/* Design accents */}
            <div className="absolute top-2 left-2 flex space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" />
              <span className="w-1.5 h-1.5 bg-[#2d2640] rounded-full" />
            </div>
            <span className="absolute top-2 right-3 font-mono text-[9px] text-slate-600">SYS_P01</span>
            
            <span className="font-mono text-[10px] text-[#00f0ff] tracking-widest mb-3 uppercase">PLAYER MONITOR</span>
            
            <div className="w-28 h-28 monitor-screen rounded-full overflow-hidden flex items-center justify-center bg-slate-900 border-2 border-[#00f0ff]">
              <div className="w-full h-full relative flex items-center justify-center bg-[#090312]">
                <User className="w-16 h-16 text-[#00f0ff] opacity-80" />
                {/* Neon blueprint circle */}
                <div className="absolute inset-2 rounded-full border border-dashed border-[#00f0ff]/30 animate-spin" style={{ animationDuration: '20s' }} />
              </div>
            </div>
            
            <span className="font-mono text-xs text-emerald-400 mt-3 font-bold tracking-wider uppercase">SIR GALAHAD</span>
            <span className="font-mono text-[10px] text-slate-500 mt-1 uppercase">Traveler Identity</span>
          </div>

          {/* Location / Action Monitor */}
          <div className="monitor-bezel rounded p-4 flex flex-col items-center justify-between text-center min-h-[220px]">
            <div className="absolute top-2 left-2 flex space-x-1">
              <span className="w-1.5 h-1.5 bg-[#2d2640] rounded-full" />
              <span className="w-1.5 h-1.5 bg-[#2d2640] rounded-full" />
            </div>
            <span className="absolute top-2 right-3 font-mono text-[9px] text-slate-600">LOC_M02</span>

            <span className="font-mono text-[10px] text-[#00f0ff] tracking-widest uppercase">LOCATION VISUALIZER</span>

            {/* Stylized Pixel Location Art Frame */}
            <div className="w-full max-w-[200px] h-24 monitor-screen rounded bg-[#0b0018] flex flex-col items-center justify-center relative overflow-hidden p-2">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(0,240,255,0.08)_1px,transparent_1px)] bg-[size:100%_8px] pointer-events-none" />
              
              {selectedNpcId === "blacksmith" && (
                <div className="text-center">
                  <Hammer className="w-8 h-8 text-[#00f0ff] mx-auto mb-1 animate-bounce" />
                  <span className="font-mono text-[10px] text-[#00f0ff] tracking-widest block font-bold">VILLAGE FORGE</span>
                  <span className="text-[8px] text-slate-500 uppercase">Temp: 1200°C • Smoke Detected</span>
                </div>
              )}
              {selectedNpcId === "guard" && (
                <div className="text-center">
                  <Shield className="w-8 h-8 text-[#00f0ff] mx-auto mb-1 animate-pulse" />
                  <span className="font-mono text-[10px] text-[#00f0ff] tracking-widest block font-bold">VILLAGE BARRACKS</span>
                  <span className="text-[8px] text-slate-500 uppercase">Alert: Level 1 • Gates Locked</span>
                </div>
              )}
              {selectedNpcId === "merchant" && (
                <div className="text-center">
                  <Coins className="w-8 h-8 text-[#00f0ff] mx-auto mb-1" />
                  <span className="font-mono text-[10px] text-[#00f0ff] tracking-widest block font-bold">SILAS EXCHANGE</span>
                  <span className="text-[8px] text-slate-500 uppercase">Market: Open • Gold Index +4%</span>
                </div>
              )}
              {selectedNpcId === "mayor" && (
                <div className="text-center">
                  <Crown className="w-8 h-8 text-[#00f0ff] mx-auto mb-1" />
                  <span className="font-mono text-[10px] text-[#00f0ff] tracking-widest block font-bold">MAYOR COUNCIL HALL</span>
                  <span className="text-[8px] text-slate-500 uppercase">Access: Restricted • Evelyn in</span>
                </div>
              )}
            </div>

            <div className="w-full flex justify-center space-x-2 font-mono text-[10px]">
              <span className="text-slate-600">SECTOR:</span>
              <span className="text-[#00f0ff] font-bold uppercase">{selectedNpcId}_SECTOR</span>
            </div>
          </div>

          {/* NPC Monitor */}
          <div className="monitor-bezel rounded p-4 flex flex-col items-center justify-center text-center">
            <div className="absolute top-2 left-2 flex space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff0055]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff]" />
            </div>
            <span className="absolute top-2 right-3 font-mono text-[9px] text-slate-600">NPC_X03</span>

            <span className="font-mono text-[10px] text-[#00f0ff] tracking-widest mb-3 uppercase">ACTIVE NPC INTERFACE</span>

            {/* NPC Portrait Box */}
            <div className="w-28 h-28 monitor-screen rounded overflow-hidden relative border-2 border-[#ff0055]">
              <img src={selectedNpc.portrait} alt={selectedNpc.name} className="w-full h-full object-cover grayscale opacity-90 contrast-125" />
              {/* Scanline overlay specific to portrait */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#00f0ff]/10 to-transparent pointer-events-none animate-pulse" />
            </div>

            <span className="font-mono text-xs text-[#ff0055] mt-3 font-bold tracking-wider uppercase glow-text-magenta">{selectedNpc.name.toUpperCase()}</span>
            <span className="font-mono text-[10px] text-slate-500 mt-1 uppercase">{selectedNpc.role.toUpperCase()}</span>
          </div>

        </div>

        {/* Location selector links */}
        <div className="monitor-bezel rounded p-3 flex flex-wrap justify-around items-center gap-2">
          <span className="font-mono text-[10px] text-slate-600 uppercase mr-2">[TARGET LOG]</span>
          
          {Object.values(state.npcs).map((npc) => {
            const isSelected = selectedNpcId === npc.id;
            return (
              <button
                key={npc.id}
                onClick={() => {
                  setSelectedNpcId(npc.id);
                  showNotification(`INSULATION SET TO ${npc.name.toUpperCase()}`, "info");
                }}
                className={`font-mono text-xs px-4 py-2 border rounded cursor-pointer transition ${
                  isSelected
                    ? "bg-[#ff0055]/15 border-[#ff0055] text-[#ff0055] font-bold glow-text-magenta shadow-[0_0_8px_rgba(255,0,85,0.2)]"
                    : "bg-[#0b0018] border-[#2d2640] text-slate-400 hover:border-[#00f0ff] hover:text-[#00f0ff]"
                }`}
              >
                {`[TALK: ${npc.name.toUpperCase()}]`}
              </button>
            );
          })}
        </div>

        {/* System Warnings / Ending Overlays */}
        {state.gameEnded && (
          <div className="border-2 border-[#ff0055] bg-[#ff0055]/10 rounded p-6 text-center animate-pulse relative">
            <span className="absolute top-2 left-2 text-[9px] text-[#ff0055] font-mono">SYS_ALERT</span>
            <AlertTriangle className="w-12 h-12 text-[#ff0055] mx-auto mb-3" />
            <h3 className="text-xl font-bold font-mono tracking-widest text-[#ff0055] uppercase glow-text-magenta">
              {state.endingType === "arrested" && "TERMINAL FAULT: CAPTURED"}
              {state.endingType === "outcast" && "TERMINAL FAULT: DEPORTED"}
              {state.endingType === "mayor" && "VICTORY: COGNITIVE MASTER"}
              {state.endingType === "merchant" && "VICTORY: LIQUIDITY CONTROLLER"}
              {state.endingType === "friend" && "VICTORY: COGNITIVE HARMONY"}
            </h3>
            <p className="text-sm text-slate-300 mt-2 max-w-2xl mx-auto leading-relaxed font-mono">
              {state.endingType === "arrested" && "Your statements failed Kael's consistency matrix. Declared an unregistered spy and locked in the cell blocks indefinitely."}
              {state.endingType === "outcast" && "Rumors of your multiple identities propagated through all node networks. driven out as an active threat."}
              {state.endingType === "mayor" && "Successful manipulation completed. Evelyn trust matrix reached 100%. Appointed administrative director of Echoes."}
              {state.endingType === "merchant" && "Silas loved your business secrets. You've established trade monopoly and monopolized village liquidity."}
              {state.endingType === "friend" && "Full network consensus achieved. All inhabitants registered 80%+ friendship metrics."}
            </p>
            <button
              onClick={handleResetGame}
              className="mt-4 font-mono text-xs px-6 py-2 border-2 border-[#ff0055] text-[#ff0055] hover:bg-[#ff0055] hover:text-white transition cursor-pointer rounded"
            >
              [REBOOT MATRIX]
            </button>
          </div>
        )}

        {/* Dialogue Box (VA-11 Hall-A dialogue console) */}
        <div className="bg-[#020005] border-3 border-[#2d2640] rounded p-6 min-h-[160px] flex flex-col justify-between relative shadow-[inset_0_0_20px_rgba(0,0,0,0.9)]">
          {/* LED blink accents */}
          <div className="absolute top-2 right-4 flex items-center space-x-2">
            <span className="text-[9px] font-mono text-slate-700">TEXT_BUFF</span>
            <span className={`w-2 h-2 rounded-full ${isTalking ? "bg-emerald-500 animate-ping" : "bg-[#ff0055] animate-pulse"}`} />
          </div>

          <div className="flex-1 flex flex-col font-mono">
            {/* Speaker Name Tag */}
            <span className="text-[#ff0055] font-bold text-sm tracking-widest glow-text-magenta uppercase mb-1">
              {isTalking ? "SYSTEM PROCESSING..." : selectedNpc.name}:
            </span>
            
            {/* Dialogue block */}
            <div className="text-lg leading-relaxed font-mono font-medium text-slate-100 flex-1 whitespace-pre-wrap select-text font-mono" style={{ fontFamily: 'var(--font-vt323)' }}>
              {isTalking ? (
                <span className="opacity-80 text-emerald-400">Loading response text from node database...</span>
              ) : (
                <>
                  {latestNpcMessage}
                  <span className="blink ml-1 text-[#ff0055]">█</span>
                </>
              )}
            </div>
          </div>

          {/* Dialogue box prompt line / blinking next cursor */}
          <div className="flex justify-end pt-3">
            <div className="flex items-center space-x-2 font-mono text-[9px] text-[#ff0055] animate-pulse uppercase">
              <span className="tracking-widest">NEXT CONVERSATION PIECE</span>
              <ChevronRight className="w-3.5 h-3.5 rotate-90" />
            </div>
          </div>
        </div>

        {/* Input Bar Terminal */}
        <form onSubmit={handleSendMessage} className="monitor-bezel rounded p-3">
          <div className="flex gap-3">
            <div className="flex items-center text-xs text-[#00f0ff] font-mono px-2 font-bold select-none shrink-0">
              SYS_INPUT&gt;
            </div>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={`STATE YOUR MESSAGE TO ${selectedNpc.name.toUpperCase()} (e.g. 'I am Sir Galahad')`}
              disabled={isTalking || state.gameEnded}
              className="flex-1 bg-black border border-[#2d2640] hover:border-[#00f0ff] focus:border-[#00f0ff] rounded px-4 py-2.5 text-xs text-emerald-400 placeholder-[#2d2640] focus:outline-none focus:ring-1 focus:ring-[#00f0ff] font-mono tracking-wider transition uppercase"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isTalking || state.gameEnded}
              className="border-2 border-[#00f0ff] hover:bg-[#00f0ff] hover:text-[#05010b] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#00f0ff] text-[#00f0ff] font-mono text-xs font-bold px-6 py-2.5 rounded transition shrink-0 cursor-pointer"
            >
              [TRANSMIT]
            </button>
          </div>
        </form>

        {/* Lower Console: Metrics Grid & Tabular Interactive Panel */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          
          {/* Left Block: Metrics Grid (5 cols) */}
          <div className="md:col-span-5 monitor-bezel rounded p-4 flex flex-col justify-between">
            <span className="font-mono text-[10px] text-[#00f0ff] tracking-widest block uppercase mb-4">REPUTATION MATRIX DUMP</span>
            
            <div className="space-y-4 font-mono text-[11px] flex-1 flex flex-col justify-center">
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>TRUST MATRIX:</span>
                  <span className={selectedNpc.metrics.trust > 70 ? "text-emerald-400" : selectedNpc.metrics.trust < 30 ? "text-[#ff0055]" : "text-[#00f0ff]"}>
                    {renderProgressBar(selectedNpc.metrics.trust)}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>RESPECT MATRIX:</span>
                  <span className="text-[#00f0ff]">{renderProgressBar(selectedNpc.metrics.respect)}</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>FEAR INDEX:</span>
                  <span className="text-orange-500">{renderProgressBar(selectedNpc.metrics.fear)}</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>FRIEND CONSENSUS:</span>
                  <span className="text-pink-500">{renderProgressBar(selectedNpc.metrics.friendship)}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-[#2d2640] pt-3 mt-3 flex justify-between items-center text-[9px] font-mono text-slate-600">
              <span>LED STATUS: GREEN (STABLE)</span>
              <span>INDEX v1.1.2</span>
            </div>
          </div>

          {/* Right Block: Tabular Interactive Panel (7 cols) */}
          <div className="md:col-span-7 monitor-bezel rounded p-4 flex flex-col justify-between">
            
            {/* Console Tab Selector */}
            <div className="flex border-b border-[#2d2640] pb-2 mb-3 justify-between items-center shrink-0">
              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveConsoleTab("mind")}
                  className={`font-mono text-[10px] px-3 py-1 border rounded cursor-pointer transition ${
                    activeConsoleTab === "mind"
                      ? "bg-[#00f0ff]/10 border-[#00f0ff] text-[#00f0ff]"
                      : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}
                >
                  [VILLAGE MIND MAP]
                </button>
                <button
                  onClick={() => setActiveConsoleTab("vault")}
                  className={`font-mono text-[10px] px-3 py-1 border rounded cursor-pointer transition ${
                    activeConsoleTab === "vault"
                      ? "bg-[#00f0ff]/10 border-[#00f0ff] text-[#00f0ff]"
                      : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}
                >
                  [MEMORY DB DUMP]
                </button>
              </div>

              <button 
                onClick={handleAdvanceDay}
                disabled={isGossiping || state.gameEnded}
                className="font-mono text-[10px] px-3 py-1 border border-[#00f0ff] text-[#00f0ff] hover:bg-[#00f0ff] hover:text-[#05010b] disabled:opacity-30 rounded transition cursor-pointer shrink-0"
              >
                {isGossiping ? "[GOSSIPING...]" : "[SLEEP / CYCLE DAY]"}
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 min-h-[220px] flex flex-col justify-center">
              {activeConsoleTab === "mind" ? (
                /* Blueprint SVG Graph */
                <div className="bg-[#030008] border border-[#2d2640] rounded flex-1 relative overflow-hidden flex items-center justify-center p-1">
                  <svg className="w-full h-full max-h-[210px]" viewBox="0 0 350 350">
                    <defs>
                      <marker id="cyan-arrow" viewBox="0 0 10 10" refX="15" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#00f0ff" />
                      </marker>
                    </defs>

                    {/* Background blueprint grid lines */}
                    <path d="M 0 175 L 350 175 M 175 0 L 175 350" stroke="#1c122b" strokeWidth="1" strokeDasharray="3,3" />

                    {/* Nodes Links */}
                    <line x1={nodeCoordinates.blacksmith.x} y1={nodeCoordinates.blacksmith.y} x2={nodeCoordinates.guard.x} y2={nodeCoordinates.guard.y} stroke="#2d2640" strokeWidth="1.5" />
                    <line x1={nodeCoordinates.blacksmith.x} y1={nodeCoordinates.blacksmith.y} x2={nodeCoordinates.merchant.x} y2={nodeCoordinates.merchant.y} stroke="#441a2e" strokeWidth="1.5" />
                    <line x1={nodeCoordinates.guard.x} y1={nodeCoordinates.guard.y} x2={nodeCoordinates.mayor.x} y2={nodeCoordinates.mayor.y} stroke="#2d2640" strokeWidth="1.5" />
                    <line x1={nodeCoordinates.merchant.x} y1={nodeCoordinates.merchant.y} x2={nodeCoordinates.mayor.x} y2={nodeCoordinates.mayor.y} stroke="#2d2640" strokeWidth="1.5" />

                    {/* Player trust vectors */}
                    {Object.entries(state.npcs).map(([id, npc]) => {
                      const coords = nodeCoordinates[id];
                      const playerCoords = nodeCoordinates.player;
                      const isHigh = npc.metrics.trust > 70;
                      const isLow = npc.metrics.trust < 30;
                      const color = isHigh ? "#00f0ff" : isLow ? "#ff0055" : "#7c3aed";
                      
                      return (
                        <g key={id}>
                          <line 
                            x1={playerCoords.x} 
                            y1={playerCoords.y} 
                            x2={coords.x} 
                            y2={coords.y} 
                            stroke={color} 
                            strokeWidth="1.5"
                            strokeDasharray="4,2"
                            markerEnd="url(#cyan-arrow)"
                          />
                          <text 
                            x={(playerCoords.x + coords.x) / 2} 
                            y={(playerCoords.y + coords.y) / 2 - 4} 
                            fill={color} 
                            fontSize="8" 
                            fontFamily="monospace"
                            textAnchor="middle"
                          >
                            {`T:${npc.metrics.trust}`}
                          </text>
                        </g>
                      );
                    })}

                    {/* Node shapes */}
                    {/* Player */}
                    <circle cx={nodeCoordinates.player.x} cy={nodeCoordinates.player.y} r="12" fill="#05010b" stroke="#00f0ff" strokeWidth="2" />
                    <text x={nodeCoordinates.player.x} y={nodeCoordinates.player.y + 4} fill="#00f0ff" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">P</text>

                    {/* NPC nodes */}
                    {Object.entries(state.npcs).map(([id, npc]) => {
                      const coords = nodeCoordinates[id];
                      const isSelected = selectedNpcId === id;
                      return (
                        <g key={id} className="cursor-pointer" onClick={() => setSelectedNpcId(id)}>
                          <circle 
                            cx={coords.x} 
                            cy={coords.y} 
                            r="15" 
                            fill="#05010b" 
                            stroke={isSelected ? "#ff0055" : "#2d2640"} 
                            strokeWidth={isSelected ? "2.5" : "1.5"} 
                          />
                          <text 
                            x={coords.x} 
                            y={coords.y + 3} 
                            fill={isSelected ? "#ff0055" : "#00f0ff"} 
                            fontSize="9" 
                            fontFamily="monospace" 
                            textAnchor="middle"
                          >
                            {npc.name[0]}
                          </text>
                          <text 
                            x={coords.x} 
                            y={coords.y + 24} 
                            fill={isSelected ? "#ff0055" : "slate-500"} 
                            fontSize="7" 
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
              ) : (
                /* Supermemory Dump Logs */
                <div className="bg-[#020005] border border-[#2d2640] rounded flex-1 overflow-y-auto p-3 text-[10px] leading-relaxed text-[#00f0ff] font-mono select-text relative">
                  <div className="absolute top-1 right-2 text-slate-700 select-none text-[8px]">MEM_DUMP_OK</div>
                  
                  <span className="text-slate-500 block border-b border-[#2d2640] pb-1 mb-2">
                    NPC: {selectedNpc.name.toUpperCase()} • MEMORIES RETRIEVED FROM VECTOR STORE:
                  </span>
                  
                  {loadingMemories ? (
                    <div className="flex items-center space-x-2 py-4 justify-center">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>ACCESSING MEMORY CORE CELLS...</span>
                    </div>
                  ) : npcMemories[selectedNpcId] && npcMemories[selectedNpcId].length > 0 ? (
                    <ul className="space-y-1">
                      {npcMemories[selectedNpcId].map((mem, index) => (
                        <li key={index} className="text-emerald-400 font-mono">
                          {`> [REC_${index.toString().padStart(2, '0')}] ${mem}`}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-slate-600 block text-center py-4">NO CONCRETE COGNITIVE PATTERNS INDEXED FOR {selectedNpc.name.toUpperCase()}.</span>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-[#2d2640] pt-2 mt-2 flex justify-between text-[9px] font-mono text-slate-600 shrink-0">
              <span>CORE TAG: {selectedNpcId}_{state.sessionId}</span>
              <button 
                onClick={() => fetchMemories(state.sessionId)} 
                className="hover:text-[#00f0ff] transition"
              >
                [FORCE RE-QUERY]
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Gossip Overlay Console */}
      {currentGossipIndex !== -1 && gossipAnimationLog[currentGossipIndex] && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 select-none scanlines">
          
          <div className="text-center mb-8">
            <Moon className="w-16 h-16 text-[#00f0ff] animate-bounce mx-auto mb-3" />
            <h2 className="text-xl font-bold tracking-widest font-mono text-[#00f0ff] glow-text-cyan uppercase">NIGHT PHASE: THE TAVERN SPEAKS</h2>
            <p className="text-[#ff0055] text-xs font-mono uppercase mt-1">Inter-node data packet sharing active...</p>
          </div>

          <div className="bg-[#0b0018] border-3 border-[#ff0055] rounded-lg p-6 max-w-xl text-center shadow-[0_0_20px_rgba(255,0,85,0.15)] relative">
            <span className="absolute top-2 left-3 font-mono text-[9px] text-slate-600">PKT_TRANS_LOG_#{currentGossipIndex + 1}</span>
            
            <div className="flex items-center justify-center space-x-8 mb-6 mt-2">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded overflow-hidden border border-[#00f0ff] bg-black">
                  <img src={state.npcs[gossipAnimationLog[currentGossipIndex].fromNpc].portrait} alt="Gossip speaker" className="w-full h-full object-cover grayscale" />
                </div>
                <span className="text-[10px] text-[#00f0ff] mt-2 font-mono font-bold uppercase">{state.npcs[gossipAnimationLog[currentGossipIndex].fromNpc].name}</span>
              </div>

              <div className="flex items-center space-x-2 text-[#ff0055] animate-pulse">
                <span className="h-0.5 w-12 bg-slate-900 relative">
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#ff0055] animate-ping" />
                </span>
                <MessageSquare className="w-5 h-5" />
                <span className="h-0.5 w-12 bg-slate-900 relative">
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#ff0055] animate-ping" />
                </span>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded overflow-hidden border border-[#00f0ff] bg-black">
                  <img src={state.npcs[gossipAnimationLog[currentGossipIndex].toNpc].portrait} alt="Gossip target" className="w-full h-full object-cover grayscale" />
                </div>
                <span className="text-[10px] text-[#00f0ff] mt-2 font-mono font-bold uppercase">{state.npcs[gossipAnimationLog[currentGossipIndex].toNpc].name}</span>
              </div>
            </div>

            <p className="text-lg leading-relaxed text-slate-100 px-4 font-mono font-medium" style={{ fontFamily: 'var(--font-vt323)' }}>
              &ldquo;{gossipAnimationLog[currentGossipIndex].rumor}&rdquo;
            </p>
          </div>

          <div className="mt-8 font-mono text-[9px] text-slate-600">
            TRANSMITTING CONVERSATION PACKET {currentGossipIndex + 1} OF {gossipAnimationLog.length} · AUTO-PROGRESSING
          </div>
        </div>
      )}

      {/* Bottom Banner (VA-11 Hall-A Marquee) */}
      <div className="bg-[#00f0ff] text-[#05010b] h-6 flex items-center overflow-hidden border-t border-[#00f0ff] fixed bottom-0 left-0 w-full z-40 select-none">
        <div className="animate-marquee-reverse inline-block font-mono text-[10px] font-bold tracking-widest uppercase">
          ECHOES: THE VILLAGE THAT REMEMBERS • ACTIVE CONTEXT ENRICHED • BUILT WITH STITCH AND DEEPMIND AGENTS • ECHOES: THE VILLAGE THAT REMEMBERS • ACTIVE CONTEXT ENRICHED • BUILT WITH STITCH AND DEEPMIND AGENTS •
        </div>
      </div>

    </div>
  );
}
