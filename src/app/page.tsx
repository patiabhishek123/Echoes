"use client";

import { useEffect, useState, useRef } from "react";
import { 
  MessageSquare, Hammer, Shield, Coins, Crown, 
  AlertTriangle, Moon, RefreshCw, BookOpen, Activity,
  ChevronRight, User, Loader2, Heart, Info, Clock, Sparkles,
  Cpu, FlaskConical
} from "lucide-react";
import { GameState, NPC, ChatMessage, GossipLog, MemoryItem } from "@/lib/gameService";

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

class JRPGSynth {
  ctx: AudioContext | null = null;
  isPlaying: boolean = false;
  tempo = 120;
  timer: any = null;

  start() {
    if (this.isPlaying) return;
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();
    this.isPlaying = true;
    
    let step = 0;
    // Nostalgic JRPG cozy progression
    const chords = [
      [60, 64, 67, 71], // Cmaj7
      [62, 65, 69, 72], // Dm7
      [57, 60, 64, 67], // Am7
      [59, 62, 66, 69]  // Bm7
    ];

    const playNote = (midi: number, time: number, duration: number, type: OscillatorType = "sine", vol = 0.05, isMetallic = true) => {
      if (!this.ctx) return;
      const carrier = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      const carrierFreq = 440 * Math.pow(2, (midi - 69) / 12);
      carrier.type = type;
      carrier.frequency.setValueAtTime(carrierFreq, time);
      
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.00001, time + duration);
      
      carrier.connect(gain);
      gain.connect(this.ctx.destination);
      
      if (isMetallic) {
        const modulator = this.ctx.createOscillator();
        const modulatorGain = this.ctx.createGain();
        
        modulator.type = "sine";
        // 3.5x ratio creates inharmonic metallic sidebands (bell chime)
        modulator.frequency.setValueAtTime(carrierFreq * 3.5, time);
        
        // Deep modulation depth fading out
        const modIndex = carrierFreq * 1.8;
        modulatorGain.gain.setValueAtTime(modIndex, time);
        modulatorGain.gain.exponentialRampToValueAtTime(0.0001, time + duration * 0.7);
        
        modulator.connect(modulatorGain);
        modulatorGain.connect(carrier.frequency);
        
        modulator.start(time);
        modulator.stop(time + duration);
      }
      
      carrier.start(time);
      carrier.stop(time + duration);
    };

    const scheduler = () => {
      if (!this.isPlaying || !this.ctx) return;
      const secPerBeat = 60 / this.tempo;
      const chordIndex = Math.floor(step / 16) % chords.length;
      const chord = chords[chordIndex];
      const noteIndex = step % 16;

      // Bass notes (Keep bass pure/warm triangle)
      if (noteIndex % 4 === 0) {
        playNote(chord[0] - 12, this.ctx.currentTime, secPerBeat * 2.0, "triangle", 0.07, false);
      }

      // Arpeggios (Metallic chime)
      const arpPattern = [0, 2, 1, 3, 2, 0, 1, 2];
      const arpNote = chord[arpPattern[noteIndex % arpPattern.length]];
      if (noteIndex % 2 === 0) {
        playNote(arpNote, this.ctx.currentTime, secPerBeat * 0.4, "sine", 0.035, true);
      }

      // Melody (Metallic lead)
      if (noteIndex === 3 || noteIndex === 7 || noteIndex === 11 || noteIndex === 14) {
        const melodyMelodies = [72, 74, 76, 79, 81];
        const mel = melodyMelodies[Math.floor(Math.random() * (melodyMelodies.length))];
        playNote(mel, this.ctx.currentTime, secPerBeat * 0.8, "sine", 0.025, true);
      }

      step += 1;
      this.timer = setTimeout(scheduler, secPerBeat * 250);
    };

    scheduler();
  }

  stop() {
    this.isPlaying = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

export default function GamePage() {
  const [state, setState] = useState<GameState | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(true);
  const [onboardingStep, setOnboardingStep] = useState<number>(1);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [landingScreenActive, setLandingScreenActive] = useState<boolean>(true);
  const [musicPlaying, setMusicPlaying] = useState<boolean>(false);
  const synthRef = useRef<any>(null);
  const [helpModeActive, setHelpModeActive] = useState<boolean>(false);
  const [activeHelpSection, setActiveHelpSection] = useState<string | null>(null);
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX - window.innerWidth / 2) / 25;
      const y = (e.clientY - window.innerHeight / 2) / 25;
      setMouseOffset({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

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
  const [npcMemories, setNpcMemories] = useState<Record<string, MemoryItem[]>>({});
  const [loadingMemories, setLoadingMemories] = useState<boolean>(false);
  const [activeConsoleTab, setActiveConsoleTab] = useState<"mind" | "vault" | "journal">("mind");
  const [shakePortrait, setShakePortrait] = useState<boolean>(false);
  const [displayedDialogue, setDisplayedDialogue] = useState<string>(
    "Select a building on the map above to walk to and talk to that inhabitant."
  );

  // New hooks for Supermemory extended features
  const [playerNotes, setPlayerNotes] = useState<string[]>([]);
  const [loadingNotes, setLoadingNotes] = useState<boolean>(false);
  const [journalInput, setJournalInput] = useState<string>(" ");
  const [vectorQuery, setVectorQuery] = useState<string>("");

  // Decryption Minigame State
  const [showMinigame, setShowMinigame] = useState<boolean>(false);
  const [minigameDocId, setMinigameDocId] = useState<string>("");
  const [minigameNpcId, setMinigameNpcId] = useState<string>("");
  const [minigameIsGlitched, setMinigameIsGlitched] = useState<boolean>(false);
  const [minigameTarget, setMinigameTarget] = useState<string>("");
  const [minigameGrid, setMinigameGrid] = useState<string[]>([]);
  const [minigameTimer, setMinigameTimer] = useState<number>(8);
  const minigameIntervalRef = useRef<any>(null);

  // Rumor Synthesis State
  const [synthNote1, setSynthNote1] = useState<string>("");
  const [synthNote2, setSynthNote2] = useState<string>("");
  const [synthTargetNpcId, setSynthTargetNpcId] = useState<string>("blacksmith");
  const [isSynthLabOpen, setIsSynthLabOpen] = useState<boolean>(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const conversationsForTypewriter = state?.conversations[selectedNpcId] || [];
  const latestNpcMessage = conversationsForTypewriter.slice().reverse().find(c => c.sender === "npc")?.content || 
    `Select Hagar, Kael, Silas, or Evelyn to converse with them and discover their memories.`;

  // Start music helper
  const toggleMusic = () => {
    if (musicPlaying) {
      if (synthRef.current) {
        synthRef.current.stop();
      }
      setMusicPlaying(false);
      showNotification("AMBIENT TRANSMISSION PAUSED", "info");
    } else {
      if (!synthRef.current) {
        synthRef.current = new JRPGSynth();
      }
      synthRef.current.start();
      setMusicPlaying(true);
      showNotification("AMBIENT TRANSMISSION ESTABLISHED", "success");
    }
  };

  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.stop();
      }
    };
  }, []);

  // Fetch current game state
  const fetchState = async () => {
    try {
      const res = await fetch("/api/state");
      const data = await res.json();
      setState(data);
      if (data) {
        fetchMemories();
        fetchJournalNotes();
      }
    } catch (error) {
      showNotification("FAILED TO RETRIEVE VILLAGE STATE LOGS.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Fetch NPC memories with source document IDs
  const fetchMemories = async () => {
    setLoadingMemories(true);
    const memories: Record<string, MemoryItem[]> = {};
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

  // Fetch player notes from their second brain
  const fetchJournalNotes = async () => {
    setLoadingNotes(true);
    try {
      const res = await fetch("/api/journal");
      if (res.ok) {
        const data = await res.json();
        setPlayerNotes(data);
      }
    } catch (e) {
      console.error("Error loading journal notes:", e);
    } finally {
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.conversations, selectedNpcId]);

  useEffect(() => {
    if (isTalking) {
      setDisplayedDialogue("");
      return;
    }
    let index = 0;
    setDisplayedDialogue("");
    const interval = setInterval(() => {
      if (index < latestNpcMessage.length) {
        setDisplayedDialogue((prev) => prev + latestNpcMessage.charAt(index));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 15);
    return () => clearInterval(interval);
  }, [latestNpcMessage, isTalking]);

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
        setShakePortrait(true);
        setTimeout(() => setShakePortrait(false), 500);
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

      fetchMemories();
      fetchJournalNotes();

    } catch (error) {
      setState(originalState);
      showNotification("FAILED TO COMMUNICATE WITH VILLAGER.", "error");
    } finally {
      setIsTalking(false);
    }
  };

  // Add a manual note to the player journal
  const handleAddJournalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalInput.trim()) return;

    const note = journalInput;
    setJournalInput("");
    setLoadingNotes(true);
    try {
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: note })
      });
      if (res.ok) {
        showNotification("NOTE INGESTED INTO SECOND BRAIN MATRIX.", "success");
        fetchJournalNotes();
      } else {
        showNotification("FAILED TO INGEST NOTE.", "error");
      }
    } catch (e) {
      showNotification("JOURNAL CONNECTION INTERRUPTED.", "error");
    } finally {
      setLoadingNotes(false);
    }
  };

  // Run a vector hack scanning search on the selected NPC's memories
  const handleVectorSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vectorQuery.trim() || !state) return;

    if ((state.coins ?? 30) < 5) {
      showNotification("INSUFFICIENT COINS FOR VECTOR SCAN (NEEDS 5)", "error");
      return;
    }

    setLoadingMemories(true);
    try {
      const res = await fetch(`/api/memories?npcId=${selectedNpcId}&query=${encodeURIComponent(vectorQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setNpcMemories(prev => ({
          ...prev,
          [selectedNpcId]: data.memories
        }));
        setState(prev => prev ? { ...prev, coins: data.coins } : null);
        showNotification("VECTOR SCAN COMPLETE. 5 COINS DEDUCTED.", "success");
      } else {
        const err = await res.json();
        showNotification(err.error || "SCAN FAILED.", "error");
      }
    } catch (e) {
      showNotification("SCAN CONNECTION FAILED.", "error");
    } finally {
      setLoadingMemories(false);
    }
  };

  // Consume Oblivion Potion to erase an NPC memory (triggers Decryption Minigame)
  const handleWipeMemory = async (docId: string) => {
    if (!state) return;
    const npc = state.npcs[selectedNpcId];
    if (!npc) return;

    let cost = 10;
    if (npc.mood === "suspicious") {
      cost = 20;
    } else if (npc.mood === "corrupted") {
      cost = 15;
    }

    if ((state.coins ?? 30) < cost) {
      showNotification(`INSUFFICIENT COINS FOR OBLIVION POTION (NEEDS ${cost})`, "error");
      return;
    }

    // Generate random 4-character hex target and 15 decoys
    const hexChars = "0123456789ABCDEF";
    const genCode = () => Array.from({ length: 4 }, () => hexChars[Math.floor(Math.random() * 16)]).join("");
    const targetCode = genCode();
    const grid: string[] = [];
    for (let i = 0; i < 15; i++) {
      grid.push(genCode());
    }
    const randomIndex = Math.floor(Math.random() * 16);
    grid.splice(randomIndex, 0, targetCode);

    setMinigameDocId(docId);
    setMinigameNpcId(selectedNpcId);
    const isGlitched = npc.mood === "corrupted";
    setMinigameIsGlitched(isGlitched);
    setMinigameTarget(targetCode);
    setMinigameGrid(grid);
    
    const limit = isGlitched ? 5 : 8;
    setMinigameTimer(limit);
    setShowMinigame(true);

    if (minigameIntervalRef.current) clearInterval(minigameIntervalRef.current);
    let timeLeft = limit;
    minigameIntervalRef.current = setInterval(() => {
      timeLeft -= 1;
      setMinigameTimer(timeLeft);
      if (timeLeft <= 0) {
        if (minigameIntervalRef.current) clearInterval(minigameIntervalRef.current);
        handleFailMinigame(selectedNpcId);
      }
    }, 1000);
  };

  const handleFailMinigame = async (npcId: string) => {
    setShowMinigame(false);
    if (minigameIntervalRef.current) clearInterval(minigameIntervalRef.current);
    showNotification("DECRYPTION TIMED OUT! MEMORY LOCKOUT FAILED (+15% Corruption).", "error");

    try {
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "failMinigame", cost: 10 })
      });
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch (err) {
      console.error("Error failing minigame:", err);
    }
  };

  const handleSelectMinigameCell = async (selectedCode: string) => {
    if (minigameIntervalRef.current) clearInterval(minigameIntervalRef.current);
    setShowMinigame(false);

    if (selectedCode !== minigameTarget) {
      showNotification("INCORRECT VECTOR KEY! DECRYPTION FAILED (+15% Corruption).", "error");
      try {
        const res = await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "failMinigame", cost: 10 })
        });
        if (res.ok) {
          const data = await res.json();
          setState(data);
        }
      } catch (err) {
        console.error("Error failing minigame:", err);
      }
      return;
    }

    // Success! Delete the memory
    try {
      const res = await fetch(`/api/memories?docId=${minigameDocId}&npcId=${minigameNpcId}&isGlitched=${minigameIsGlitched}`, {
        method: "DELETE"
      });
      if (res.ok) {
        const data = await res.json();
        setState(data);
        showNotification(
          minigameIsGlitched 
            ? "GLITCH REPAIRED. NPC CONSTRAINTS STABILIZED (-10% Corruption)." 
            : "VECTOR OVERWRITTEN. MEMORY COLD-LOCKED (+5% Corruption).", 
          "success"
        );
        fetchMemories();
      } else {
        const err = await res.json();
        showNotification(err.error || "OBLIVION BOILED OVER.", "error");
      }
    } catch (e) {
      showNotification("DECRYPTION INTERRUPTED.", "error");
    }
  };

  // Rumor Synthesis Lab trigger
  const handleSynthesizeRumor = async () => {
    if (!state) return;
    if (!synthNote1 || !synthNote2) {
      showNotification("SELECT TWO JOURNAL NOTES TO SYNTHESIZE A RUMOR.", "error");
      return;
    }
    if ((state.coins ?? 30) < 15) {
      showNotification("INSUFFICIENT COINS FOR RUMOR SYNTHESIS (NEEDS 15)", "error");
      return;
    }

    setLoading(true);
    try {
      const rumor = `Combined Intel: ${synthNote1} AND ${synthNote2}`;
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "injectRumor",
          targetNpcId: synthTargetNpcId,
          rumor
        })
      });

      if (res.ok) {
        const data = await res.json();
        setState(data);
        showNotification("RUMOR SYNTHESIZED & INJECTED INTO NPC SECOND BRAIN (+3% Corruption).", "success");
        setSynthNote1("");
        setSynthNote2("");
        setIsSynthLabOpen(false);
        fetchMemories();
      } else {
        const err = await res.json();
        showNotification(err.error || "SYNTHESIS REJECTED.", "error");
      }
    } catch (e) {
      showNotification("SYNTHESIS FAILURE.", "error");
    } finally {
      setLoading(false);
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
            fetchMemories();
            fetchJournalNotes();
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
      setPlayerNotes([]);
      showNotification("SYSTEM DEFRAGMENTED. SEED MEMORIES ESTABLISHED.", "success");
      setTimeout(() => {
        fetchMemories();
        fetchJournalNotes();
      }, 1000);
    } catch (e) {
      showNotification("FAILED TO EXECUTE REBOOT.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Helper to generate RPG style progress bar
  const renderProgressBar = (value: number) => {
    return (
      <div className="w-24 bg-[#2b1f1d] border border-[#573a35] rounded-full h-3 overflow-hidden shadow-inner flex shrink-0">
        <div className="bg-[#ff3b30] h-full transition-all duration-300" style={{ width: `${value}%` }} />
      </div>
    );
  };

  if (landingScreenActive) {
    return (
      <div className="flex-grow flex flex-col justify-between items-center bg-gradient-to-br from-[#fff7e6] via-[#ffdca3] to-[#e8be90] text-[#382c22] min-h-screen p-4 md:p-8 relative overflow-hidden select-none font-mono">
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes slow-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes float-gentle {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-6px); }
          }
          .animate-slow-spin {
            animation: slow-spin 120s linear infinite;
          }
          .animate-float-gentle {
            animation: float-gentle 6s ease-in-out infinite;
          }
          .pixelated {
            image-rendering: pixelated;
          }
          .title-shadow {
            text-shadow: 3px 3px 0px #ebdcb9, 6px 6px 0px #38251b;
          }
        `}} />

        {/* Parallax Background Layer 1: Rotating Sunburst / Light rays */}
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            transform: `translate(${mouseOffset.x * 0.1}px, ${mouseOffset.y * 0.1}px)`,
            transition: 'transform 0.15s ease-out'
          }}
        >
          <svg className="w-[160%] h-[160%] opacity-[0.04] animate-slow-spin" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50" fill="none" />
            {Array.from({ length: 18 }).map((_, i) => {
              const angle = i * 20;
              return (
                <path
                  key={i}
                  d={`M50,50 L${(50 + 100 * Math.cos((angle * Math.PI) / 180)).toFixed(4)},${(50 + 100 * Math.sin((angle * Math.PI) / 180)).toFixed(4)} L${(50 + 100 * Math.cos(((angle + 10) * Math.PI) / 180)).toFixed(4)},${(50 + 100 * Math.sin(((angle + 10) * Math.PI) / 180)).toFixed(4)} Z`}
                  fill="#38251b"
                />
              );
            })}
          </svg>
        </div>

        {/* Parallax Background Layer 2: Scenic Forest & Cottages Silhouettes */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: `translate(${mouseOffset.x * 0.25}px, ${mouseOffset.y * 0.25}px)`,
            transition: 'transform 0.2s ease-out'
          }}
        >
          {/* Distant trees & mountains SVG */}
          <svg className="absolute bottom-0 left-0 w-full h-[35%] opacity-[0.15]" viewBox="0 0 1000 300" preserveAspectRatio="none">
            <path d="M0,300 L0,220 L40,180 L80,220 L120,170 L160,220 L200,160 L240,220 L280,185 L320,220 L360,175 L400,220 L440,165 L480,220 L520,180 L560,220 L600,170 L640,220 L680,160 L720,220 L760,175 L800,220 L840,165 L880,220 L920,180 L960,220 L1000,170 L1000,300 Z" fill="#855b32" />
            <path d="M0,300 L0,250 L60,210 L120,250 L180,200 L240,250 L300,210 L360,250 L420,205 L480,250 L540,215 L600,250 L660,200 L720,250 L780,210 L840,250 L900,205 L960,250 L1000,220 L1000,300 Z" fill="#38251b" />
          </svg>

          {/* Cottage silhouette SVG */}
          <svg className="absolute bottom-[2%] left-[15%] w-24 h-16 opacity-20" viewBox="0 0 100 60">
            <polygon points="10,60 10,35 50,10 90,35 90,60" fill="#38251b" />
            <polygon points="40,60 40,42 60,42 60,60" fill="#ebdcb9" />
          </svg>
        </div>

        {/* Parallax Background Layer 3: Floating Clouds and digital cells */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: `translate(${mouseOffset.x * 0.5}px, ${mouseOffset.y * 0.5}px)`,
            transition: 'transform 0.25s ease-out'
          }}
        >
          {/* Cloud 1 */}
          <svg className="absolute w-40 h-14 opacity-25 animate-float-gentle" style={{ top: '15%', left: '18%' }} viewBox="0 0 100 40">
            <path d="M10,30 L90,30 L90,20 L80,20 L80,15 L70,15 L70,10 L30,10 L30,15 L20,15 L20,20 L10,20 Z" fill="#ffffff" />
          </svg>
          {/* Cloud 2 */}
          <svg className="absolute w-48 h-16 opacity-20" style={{ top: '25%', right: '22%' }} viewBox="0 0 100 40">
            <path d="M10,30 L90,30 L90,20 L80,20 L80,15 L70,15 L70,10 L30,10 L30,15 L20,15 L20,20 L10,20 Z" fill="#ffffff" />
          </svg>
        </div>

        {/* Header Bar */}
        <div className="w-full max-w-5xl flex justify-between items-center border-b-2 border-[#38251b]/40 pb-3 z-10 text-xs md:text-sm font-bold text-[#855b32] uppercase">
          <span>VILLAGE_LOG: SESSION_{state?.sessionId?.slice(0, 8) || "ACTIVE"}</span>
          <span>CHRONICLE RESTORATION CORE v1.4.0</span>
        </div>

        {/* Main Content Portal Container */}
        <div 
          className="flex-1 flex flex-col justify-center items-center z-10 max-w-xl text-center gap-6 my-6 w-full"
          style={{
            transform: `translate(${-mouseOffset.x * 0.1}px, ${-mouseOffset.y * 0.1}px)`,
            transition: 'transform 0.12s ease-out'
          }}
        >
          
          {/* Main Title Banner */}
          <div className="flex flex-col items-center w-full">
            {/* Mascot Memo greeting in JRPG card style */}
            <div className="flex items-center gap-4 bg-[#ebdcb9] border-4 border-[#38251b] rounded-lg p-4 max-w-lg mb-6 shadow-[4px_4px_0px_#38251b] relative w-full">
              <div className="w-16 h-16 rounded overflow-hidden border-2 border-[#38251b] bg-[#38251b] shrink-0 relative">
                <img 
                  src="/portraits/mascot.png" 
                  alt="Memo" 
                  className="w-full h-full object-cover pixelated"
                />
              </div>
              <div className="text-left">
                <div className="text-xs md:text-sm font-bold text-[#a84424] uppercase tracking-wider mb-1">MEMO (VILLAGE GUIDE)</div>
                <p className="text-xs md:text-sm text-[#4a3b2c] leading-relaxed font-mono font-medium">
                  &ldquo;A contradiction has fractured the chronicles! Establish BGM audio connection and let us restore the timeline.&rdquo;
                </p>
              </div>
            </div>

            {/* Glowing JRPG Title */}
            <h1 
              className="text-7xl md:text-8xl font-black text-[#382c22] uppercase tracking-[0.25em] select-none font-mono title-shadow"
              style={{ fontFamily: 'var(--font-vt323)' }}
            >
              E C H O E S
            </h1>
            <p className="text-xs md:text-sm uppercase tracking-[0.3em] text-[#855b32] font-mono mt-3 font-bold">
              Cognitive Restoration & Memory Vector Intrusion
            </p>
          </div>

          {/* Action placers (BGM Toggle & Enter Core Buttons) */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center w-full px-4">
            
            {/* Audio Toggle BGM */}
            <button
              type="button"
              onClick={toggleMusic}
              className={`w-full sm:w-auto font-mono text-xs md:text-sm px-6 py-3.5 border-2 border-[#38251b] rounded cursor-pointer transition-all duration-150 flex items-center justify-center gap-2 shadow-[2px_2px_0px_#38251b] active:translate-y-0.5 ${
                musicPlaying 
                  ? "bg-emerald-800 text-emerald-100 hover:bg-emerald-750 font-bold"
                  : "bg-[#ebdcb9] hover:bg-[#e6d0a1] text-[#382c22]"
              }`}
            >
              <span>{musicPlaying ? "🔊" : "🔇"}</span>
              <span className="tracking-wider uppercase">
                {musicPlaying ? "[BGM LINK ACTIVE]" : "[CONNECT AUDIO BGM]"}
              </span>
            </button>

            {/* Enter Button */}
            <button
              type="button"
              onClick={() => {
                if (!musicPlaying) {
                  toggleMusic();
                }
                setLandingScreenActive(false);
              }}
              className="w-full sm:w-auto bg-[#a84424] hover:bg-[#c2512f] text-amber-100 font-mono text-xs md:text-sm tracking-widest px-8 py-3.5 border-2 border-[#38251b] shadow-[4px_4px_0px_#38251b] hover:shadow-[6px_6px_0px_#38251b] transition-all duration-150 cursor-pointer font-bold uppercase active:translate-y-1 active:shadow-[2px_2px_0px_#38251b]"
            >
              [⚡ RESTORE CHRONICLE]
            </button>
          </div>

          {/* System logs widget in parchment style */}
          <div className="w-full bg-[#ebdcb9]/80 border-2 border-[#38251b] rounded p-4 text-left text-xs md:text-sm text-[#5c4033] font-mono flex flex-col gap-1.5 shadow-[4px_4px_0px_#38251b] max-w-md">
            <div className="border-b border-[#38251b]/30 pb-1.5 mb-1.5 font-bold text-[#a84424] uppercase flex justify-between">
              <span>SYSTEM DIAGNOSTIC</span>
              <span className="animate-pulse">● COGNITIVE CORE ONLINE</span>
            </div>
            <div>&gt; INTRUSION INTERFACE... [ACTIVE]</div>
            <div>&gt; RETRIEVING MEMORY CONSTRAINTS... [4 NODES MAPPED]</div>
            <div>&gt; SYNAPSE ROUTING... [VIA SUPERMEMORY INSTANCE]</div>
          </div>

        </div>

        {/* Footer */}
        <div className="w-full max-w-5xl flex justify-between items-center border-t-2 border-[#38251b]/40 pt-3 z-10 text-xs md:text-sm font-bold text-[#855b32]">
          <span>AUTHENTICATED INTRUDER PROTOCOL</span>
          <span>© 2026 ECHOSYSTEMS</span>
        </div>
      </div>
    );
  }

  if (loading || !state) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center bg-[#1c120c] text-[#ebdcb9] min-h-screen">
        <Loader2 className="w-12 h-12 text-[#855b32] animate-spin mb-4" />
        <p className="font-mono tracking-widest text-xs uppercase animate-pulse">LOADING VILLAGE CHRONICLES...</p>
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center bg-gradient-to-br from-[#fff7e6] via-[#ffdca3] to-[#e8be90] text-[#382c22] min-h-screen p-4 md:p-6 relative overflow-hidden select-none">
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes slow-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes float-gentle {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-6px); }
          }
          .animate-slow-spin {
            animation: slow-spin 120s linear infinite;
          }
          .animate-float-gentle {
            animation: float-gentle 6s ease-in-out infinite;
          }
          .pixelated {
            image-rendering: pixelated;
          }
        `}} />

        {/* Parallax Background Layer 1: Rotating Sunburst */}
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            transform: `translate(${mouseOffset.x * 0.15}px, ${mouseOffset.y * 0.15}px)`,
            transition: 'transform 0.15s ease-out'
          }}
        >
          <svg className="w-[180%] h-[180%] opacity-[0.05] animate-slow-spin" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50" fill="none" />
            {Array.from({ length: 18 }).map((_, i) => {
              const angle = i * 20;
              return (
                <path
                  key={i}
                  d={`M50,50 L${(50 + 100 * Math.cos((angle * Math.PI) / 180)).toFixed(4)},${(50 + 100 * Math.sin((angle * Math.PI) / 180)).toFixed(4)} L${(50 + 100 * Math.cos(((angle + 10) * Math.PI) / 180)).toFixed(4)},${(50 + 100 * Math.sin(((angle + 10) * Math.PI) / 180)).toFixed(4)} Z`}
                  fill="#38251b"
                />
              );
            })}
          </svg>
        </div>

        {/* Parallax Background Layer 2: Pixel Clouds */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: `translate(${mouseOffset.x * 0.4}px, ${mouseOffset.y * 0.4}px)`,
            transition: 'transform 0.2s ease-out'
          }}
        >
          {/* Cloud 1 */}
          <svg className="absolute w-44 h-16 opacity-30" style={{ top: '12%', left: '10%' }} viewBox="0 0 100 40">
            <path d="M10,30 L90,30 L90,20 L80,20 L80,15 L70,15 L70,10 L30,10 L30,15 L20,15 L20,20 L10,20 Z" fill="#ffffff" />
          </svg>
          {/* Cloud 2 */}
          <svg className="absolute w-56 h-20 opacity-25" style={{ top: '22%', right: '12%' }} viewBox="0 0 120 50">
            <path d="M10,40 L110,40 L110,30 L100,30 L100,20 L90,20 L90,15 L40,15 L40,20 L30,20 L20,20 L20,30 L10,30 Z" fill="#ffffff" />
          </svg>
          {/* Cloud 3 */}
          <svg className="absolute w-36 h-12 opacity-20" style={{ bottom: '20%', left: '15%' }} viewBox="0 0 100 40">
            <path d="M10,30 L90,30 L90,20 L80,20 L80,15 L70,15 L70,10 L30,10 L30,15 L20,15 L20,20 L10,20 Z" fill="#ffffff" />
          </svg>
        </div>

        {/* Parallax Background Layer 3: Floating digital cells */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: `translate(${mouseOffset.x * 0.85}px, ${mouseOffset.y * 0.85}px)`,
            transition: 'transform 0.3s ease-out'
          }}
        >
          <div className="absolute w-4 h-4 bg-amber-400 opacity-20 rounded border border-amber-300 top-[35%] left-[28%]" />
          <div className="absolute w-5 h-5 bg-[#00f0ff] opacity-15 rounded border border-[#00f0ff] bottom-[28%] right-[32%]" />
          <div className="absolute w-3 h-3 bg-rose-400 opacity-20 rounded border border-rose-300 top-[75%] left-[18%]" />
        </div>

        {/* Onboarding Dialog Card */}
        <div 
          className="relative max-w-2xl w-full bg-[#ebdcb9] border-4 border-[#38251b] rounded-lg p-6 md:p-8 text-[#382c22] shadow-[0_20px_50px_rgba(56,37,27,0.35)] z-10 flex flex-col gap-6"
          style={{
            transform: `translate(${-mouseOffset.x * 0.15}px, ${-mouseOffset.y * 0.15}px)`,
            transition: 'transform 0.12s ease-out'
          }}
        >
          <div className="absolute top-2 left-3 font-mono text-xs text-[#855b32]">TUTORIAL_GUIDE_v1.3.0</div>
          <div className="absolute top-2 right-3 font-mono text-xs text-[#855b32] animate-pulse">● MEMO CONNECTION ONLINE</div>

          {/* Tutorial Steps Progress Bar */}
          <div className="flex justify-between items-center bg-[#38251b] px-4 py-2.5 rounded border border-[#5c4033] mt-2 shrink-0">
            <span className="font-mono text-xs font-bold text-amber-300">TUTORIAL GUIDE PHASE</span>
            <div className="flex items-center space-x-2">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`w-5 h-5 rounded-full border flex items-center justify-center font-mono text-xs font-bold transition-all ${
                    onboardingStep === step
                      ? "bg-amber-500 border-amber-300 text-slate-900 scale-110"
                      : onboardingStep > step
                      ? "bg-emerald-600 border-emerald-400 text-emerald-100"
                      : "bg-[#ebdcb9]/10 border-stone-600 text-stone-500"
                  }`}
                >
                  {step}
                </div>
              ))}
            </div>
          </div>

          {/* Mascot speech box & portrait grid */}
          <div className="flex flex-col md:flex-row gap-5 items-stretch bg-[#ebdcb9] border-4 border-[#38251b] rounded p-4 relative shadow-md">
            
            {/* Mascot character portrait */}
            <div className="w-28 h-28 shrink-0 flex flex-col items-center justify-center bg-[#ebdcb9] border-2 border-[#855b32] rounded relative shadow-inner mx-auto md:mx-0 animate-float-gentle">
              <img 
                src="/portraits/mascot.png" 
                alt="Memo the AI assistant owl" 
                className="w-full h-full object-cover pixelated" 
              />
              <div className="absolute bottom-1 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-[#00f0ff] font-bold tracking-widest uppercase">
                MEMO
              </div>
            </div>

            {/* Bubble speech */}
            <div className="flex-1 flex flex-col justify-between bg-[#fcf8ef] border-2 border-[#6b533e]/30 rounded p-4 relative">
              {/* Little speech tail */}
              <div className="hidden md:block absolute left-[-8px] top-10 w-0 h-0 border-y-8 border-y-transparent border-r-8 border-r-[#6b533e]/30" />
              <div className="hidden md:block absolute left-[-6px] top-10 w-0 h-0 border-y-8 border-y-transparent border-r-8 border-r-[#fcf8ef]" />

              <div className="font-mono text-sm md:text-base leading-relaxed text-[#382c22]">
                {onboardingStep === 1 && (
                  <>
                    <div className="mb-2.5">
                      <strong className="text-[#a84424] text-base font-bold block mb-1">WELCOME TO THE ECHOES MATRIX!</strong>
                      Greetings, Traveler! I am <strong className="text-amber-900">Memo</strong>, your personal cognitive digital owl. I will guide you through this strange village.
                    </div>
                    <div>
                      In Echoes, the inhabitants share a unified memory database. You must be careful with what stories you weave, or their database will detect contradictions!
                    </div>
                  </>
                )}

                {onboardingStep === 2 && (
                  <>
                    <div className="mb-2.5">
                      <strong className="text-[#a84424] text-base font-bold block mb-1">THE MEMORY TRAP & RELATIONSHIPS</strong>
                      Every word you type to an NPC is parsed, analyzed, and ingested into their personal Supermemory vector tags.
                    </div>
                    <div>
                      If you tell Hagar you are a <strong>knight</strong> but Silas thinks you are a <strong>peasant</strong>, they will treat you with suspicion! Watch out for the metrics in your relation matrix: <strong className="text-amber-900">Trust, Respect, Fear, and Friendship</strong>.
                    </div>
                  </>
                )}

                {onboardingStep === 3 && (
                  <>
                    <div className="mb-2.5">
                      <strong className="text-[#a84424] text-base font-bold block mb-1">CAMPFIRE GOSSIP NIGHT</strong>
                      At the end of each day, when you click the <strong className="text-[#a84424]">SLEEP</strong> button, the campfire gossip night triggers.
                    </div>
                    <div>
                      NPCs gather at the inn to exchange rumors they've logged about you. If Silas knows a trade secret, he might sell it to Mayor Evelyn. Facts propagate!
                    </div>
                  </>
                )}

                {onboardingStep === 4 && (
                  <>
                    <div className="mb-2.5">
                      <strong className="text-[#a84424] text-base font-bold block mb-1">YOUR EXTRAPOLATED TOOLS</strong>
                      To survive, I have built special interfaces for you:
                    </div>
                    <ul className="space-y-1.5 mt-2 text-xs md:text-sm list-disc pl-4 text-stone-750">
                      <li><strong>✏️ My Journal:</strong> Write down your covers so you never contradict yourself.</li>
                      <li><strong className="text-purple-800">🔮 Vector Hacking (5 coins):</strong> Query an NPC's memory space for keywords.</li>
                      <li><strong className="text-emerald-800">🧪 Oblivion Potion (20 coins):</strong> Permanently wipe any dangerous fact before it spreads!</li>
                    </ul>
                  </>
                )}
              </div>
            </div>

          </div>

          {/* Action Navigation Buttons */}
          <div className="flex justify-between items-center pt-2 border-t-2 border-[#38251b]/20">
            {onboardingStep > 1 ? (
              <button
                type="button"
                onClick={() => setOnboardingStep((prev) => prev - 1)}
                className="bg-[#ebdcb9] hover:bg-stone-300 text-stone-800 border-2 border-[#38251b] font-mono text-xs md:text-sm font-bold px-5 py-2.5 rounded cursor-pointer transition shadow"
              >
                [BACK]
              </button>
            ) : (
              <div />
            )}

            {onboardingStep < 4 ? (
              <button
                type="button"
                onClick={() => setOnboardingStep((prev) => prev + 1)}
                className="bg-[#855b32] hover:bg-[#a87442] text-amber-100 border-2 border-[#38251b] font-mono text-xs md:text-sm font-bold px-6 py-2.5 rounded cursor-pointer transition shadow"
              >
                [NEXT PHASE]
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowOnboarding(false);
                  showNotification("COGNITIVE CONNECTION STABILIZED. WELCOME TO ECHOES.", "success");
                }}
                className="bg-emerald-800 hover:bg-emerald-750 text-emerald-100 border-4 border-[#38251b] font-mono text-sm md:text-base font-bold tracking-widest px-6 py-3 rounded cursor-pointer transition shadow-lg inline-flex items-center space-x-2 select-none animate-pulse hover:animate-none"
              >
                <span>[ENTER ECHOES VILLAGE]</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="scanlines pointer-events-none" />
      </div>
    );
  }

  const selectedNpc = state.npcs[selectedNpcId];
  const conversations = state.conversations[selectedNpcId] || [];

  const playerPositions: Record<string, { x: string; y: string }> = {
    blacksmith: { x: "21%", y: "38%" },
    guard: { x: "69%", y: "38%" },
    merchant: { x: "21%", y: "68%" },
    mayor: { x: "69%", y: "68%" },
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#1c120c] text-[#ebdcb9] relative select-none font-sans overflow-hidden pb-10">
      
      {/* Top HUD Bar */}
      <div className="bg-[#2d1b11] border-b-4 border-[#38251b] text-[#ebdcb9] h-14 flex items-center justify-between px-6 z-40 select-none shadow-lg">
        {/* Left Side: HP & Coins */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2 bg-black/20 px-3 py-1 rounded border border-[#5c4033]">
            <Heart className="w-4 h-4 text-red-500 fill-red-500 animate-pulse" />
            <span className="font-mono text-xs font-bold text-red-400">VITALITY:</span>
            <div className="rpg-health-bar w-24">
              <div className="rpg-health-fill" style={{ width: "100%" }} />
            </div>
            <span className="font-mono text-[10px] text-red-400">100/100</span>
          </div>

          <div className="flex items-center space-x-2 bg-black/20 px-3 py-1 rounded border border-[#5c4033]">
            <Coins className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span className="font-mono text-xs font-bold text-yellow-500">COINS:</span>
            <span className="font-mono text-xs font-bold text-yellow-400">{state.coins ?? 30}</span>
          </div>
        </div>

        {/* Center: Village Day & Clock with Sleep action */}
        <div className="flex items-center space-x-3 bg-[#38251b] px-4 py-1.5 rounded-full border-2 border-[#5c4033]">
          <Clock className="w-4 h-4 text-amber-500" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-300">DAY {state.day} • {isGossiping ? "NIGHT CYCLE" : "DAYTIME"}</span>
          <button
            onClick={handleAdvanceDay}
            disabled={isGossiping || state.gameEnded}
            className="bg-[#a84424] hover:bg-[#c2512f] disabled:opacity-40 text-amber-100 font-mono text-[9px] font-bold px-2.5 py-0.5 rounded border border-[#5c4033] cursor-pointer transition uppercase"
          >
            {isGossiping ? "SLEEPING..." : "SLEEP"}
          </button>
        </div>

        {/* Right Side: Interactive Help Toggle */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => {
              setHelpModeActive(!helpModeActive);
              showNotification(!helpModeActive ? "HELP MODE ACTIVE. CLICK ANY '?' TO VIEW COMPONENT GUIDE." : "HELP MODE DEACTIVATED.", "info");
            }}
            className={`font-mono text-[9px] font-bold px-3 py-1.5 border-2 rounded transition cursor-pointer active:translate-y-0.5 ${
              helpModeActive
                ? "bg-amber-700 border-amber-300 text-amber-100 shadow-[0_0_8px_rgba(217,119,6,0.5)] animate-pulse"
                : "bg-[#38251b] border-[#5c4033] text-amber-300 hover:border-amber-400 hover:text-amber-100"
            }`}
          >
            ❓ {helpModeActive ? "[EXIT HELP MODE]" : "[❓ HOW TO PLAY]"}
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-6 pt-6 gap-6 relative z-10">
        
        {/* Village Map Container */}
        <div className="relative w-full aspect-[2.4/1] border-4 border-[#38251b] rounded-lg overflow-hidden bg-[#7ba342] shadow-2xl p-2 select-none"
             style={{ 
               backgroundImage: 'radial-gradient(#4d701e 1.5px, transparent 1.5px), radial-gradient(#4d701e 1.5px, #7ba342 1.5px)', 
               backgroundSize: '24px 24px', 
               backgroundPosition: '0 0, 12px 12px' 
             }}>
          
          {helpModeActive && (
            <button
              type="button"
              onClick={() => setActiveHelpSection("villageMap")}
              className="absolute top-2 right-2 z-40 w-6 h-6 rounded-full bg-amber-600 hover:bg-amber-500 border-2 border-amber-300 text-amber-100 flex items-center justify-center font-bold text-xs shadow-lg animate-bounce cursor-pointer"
              title="Click to learn about the Village Map & NPCs"
            >
              ?
            </button>
          )}
          
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes radar-sweep-line {
              0% { top: 0%; opacity: 0; }
              10% { opacity: 1; }
              90% { opacity: 1; }
              100% { top: 100%; opacity: 0; }
            }
            .radar-sweep-line {
              animation: radar-sweep-line 3s linear infinite;
            }
            .map-parallax-layer {
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
              pointer-events: none;
            }
            .map-parallax-layer-interactive {
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
            }
          `}} />

          {/* PARALLAX LAYER 1: Grassy details, trees, flowers, rocks */}
          <div className="map-parallax-layer scale-[1.03]"
               style={{ 
                 transform: `translate(${mouseOffset.x * 0.05}px, ${mouseOffset.y * 0.05}px)`,
                 transition: 'transform 0.15s ease-out' 
               }}>
            {/* Top-Center Trees */}
            <div className="absolute top-[12%] left-[45%] flex space-x-1 opacity-70">
              <div className="w-5 h-8 bg-emerald-950 border border-emerald-950 rounded-t-full relative">
                <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-emerald-750 rounded-full" />
              </div>
              <div className="w-4 h-6 bg-emerald-950 border border-emerald-950 rounded-t-full relative -mt-1" />
            </div>
            {/* Bottom-Center Trees */}
            <div className="absolute top-[78%] left-[45%] flex space-x-1 opacity-70">
              <div className="w-4 h-6 bg-emerald-950 border border-emerald-950 rounded-t-full relative" />
              <div className="w-5 h-8 bg-emerald-950 border border-emerald-950 rounded-t-full relative -mt-1" />
            </div>
            {/* Top-Left trees */}
            <div className="absolute top-[3%] left-[4%] flex space-x-1 opacity-75">
              <div className="w-4 h-6 bg-emerald-900 border border-emerald-950 rounded-t-full relative" />
              <div className="w-5 h-7 bg-emerald-950 border border-emerald-950 rounded-t-full relative -mt-1" />
            </div>
            {/* Bottom-Left trees */}
            <div className="absolute top-[82%] left-[4%] flex space-x-1 opacity-75">
              <div className="w-5 h-7 bg-emerald-950 border border-emerald-950 rounded-t-full relative" />
              <div className="w-4 h-6 bg-emerald-900 border border-emerald-950 rounded-t-full relative -mt-1" />
            </div>
            {/* Rocks & Flowers */}
            <div className="absolute top-[22%] left-[8%] w-2 h-1.5 bg-stone-500 rounded-full border border-stone-750" />
            <div className="absolute top-[15%] left-[90%] w-2 h-1.5 bg-stone-500 rounded-full border border-stone-750" />
            <div className="absolute top-[84%] left-[92%] w-1.5 h-1.5 rounded-full bg-yellow-300 animate-ping" />
            <div className="absolute top-[28%] left-[4%] w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" style={{ animationDelay: '0.8s' }} />
          </div>

          {/* PARALLAX LAYER 2: Connecting Sand Paths & Central Cobblestone plaza */}
          <div className="map-parallax-layer scale-[1.03]"
               style={{ 
                 transform: `translate(${mouseOffset.x * 0.1}px, ${mouseOffset.y * 0.1}px)`,
                 transition: 'transform 0.15s ease-out' 
               }}>
            {/* Top Horizontal Path */}
            <div className="absolute top-[40%] left-[10%] w-[80%] h-[8%] bg-[#ebd197] border-y-2 border-[#cbb177]/50" 
              style={{ backgroundImage: 'radial-gradient(#dfc68b 1px, transparent 1px)', backgroundSize: '8px 8px' }} />
            {/* Bottom Horizontal Path */}
            <div className="absolute top-[70%] left-[10%] w-[80%] h-[8%] bg-[#ebd197] border-y-2 border-[#cbb177]/50" 
              style={{ backgroundImage: 'radial-gradient(#dfc68b 1px, transparent 1px)', backgroundSize: '8px 8px' }} />
            {/* Left Vertical Path */}
            <div className="absolute top-[40%] left-[22%] w-[8%] h-[38%] bg-[#ebd197] border-x-2 border-[#cbb177]/50" 
              style={{ backgroundImage: 'radial-gradient(#dfc68b 1px, transparent 1px)', backgroundSize: '8px 8px' }} />
            {/* Right Vertical Path */}
            <div className="absolute top-[40%] left-[70%] w-[8%] h-[38%] bg-[#ebd197] border-x-2 border-[#cbb177]/50" 
              style={{ backgroundImage: 'radial-gradient(#dfc68b 1px, transparent 1px)', backgroundSize: '8px 8px' }} />
            
            {/* Central Cobblestone plaza */}
            <div className="absolute top-[44%] left-[39%] w-[22%] h-[30%] bg-[#5c6875] rounded-full border-4 border-[#3c4752] shadow-inner flex items-center justify-center">
              <div className="w-[85%] h-[85%] border-2 border-dashed border-[#3c4752]/30 rounded-full" />
            </div>

            {/* Glowing active path connector */}
            {selectedNpcId === "blacksmith" && (
              <div className="absolute top-[40%] left-[22%] w-[8%] h-[15%] bg-amber-500/20 border-x-2 border-amber-400/50 shadow-[0_0_10px_rgba(245,158,11,0.3)] animate-pulse" />
            )}
            {selectedNpcId === "guard" && (
              <div className="absolute top-[40%] left-[70%] w-[8%] h-[15%] bg-cyan-500/20 border-x-2 border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.3)] animate-pulse" />
            )}
            {selectedNpcId === "merchant" && (
              <div className="absolute top-[52%] left-[22%] w-[8%] h-[26%] bg-yellow-500/20 border-x-2 border-yellow-400/50 shadow-[0_0_10px_rgba(234,179,8,0.3)] animate-pulse" />
            )}
            {selectedNpcId === "mayor" && (
              <div className="absolute top-[52%] left-[70%] w-[8%] h-[26%] bg-purple-500/20 border-x-2 border-purple-400/50 shadow-[0_0_10px_rgba(168,85,247,0.3)] animate-pulse" />
            )}
          </div>

          {/* PARALLAX LAYER 3: Buildings & Campfire */}
          <div className="map-parallax-layer-interactive"
               style={{ 
                 transform: `translate(${mouseOffset.x * 0.16}px, ${mouseOffset.y * 0.16}px)`,
                 transition: 'transform 0.15s ease-out' 
               }}>
            
            {/* 1. Blacksmith Forge House (Top Left) */}
            <button
              type="button"
              onClick={() => {
                setSelectedNpcId("blacksmith");
                showNotification("WALKING TO THE FORGE...", "info");
              }}
              className="absolute top-[6%] left-[9%] w-[24%] h-[32%] flex flex-col items-center group cursor-pointer border-none bg-transparent outline-none focus:outline-none z-10"
            >
              <div className="w-full h-full bg-[#5c4033] border-4 border-[#38251b] rounded-lg shadow-xl relative flex flex-col justify-end p-2 transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_15px_rgba(249,115,22,0.4)]">
                {/* Slanted Roof */}
                <div className="absolute inset-x-0 -top-4 h-4 bg-gradient-to-t from-[#3a271d] to-[#1c110b] rounded-t border-t-4 border-x-4 border-[#38251b]" />
                {/* Chimney with animated smoke */}
                <div className="w-3.5 h-6 bg-stone-700 border-2 border-stone-900 absolute -top-6 right-2 flex flex-col items-center">
                  <span className="w-2 h-2 rounded-full bg-stone-400/60 absolute animate-ping -top-3" style={{ animationDelay: '0s' }} />
                  <span className="w-3 h-3 rounded-full bg-stone-400/40 absolute animate-ping -top-5" style={{ animationDelay: '0.4s' }} />
                </div>
                {/* Glowing Hearth Entrance */}
                <div className="absolute bottom-0 left-4 w-6 h-8 bg-[#1a0f08] border-t-4 border-x-4 border-[#38251b] rounded-t overflow-hidden">
                  <div className="w-full h-full bg-[radial-gradient(circle_at_bottom,_rgba(249,115,22,0.95)_0%,_transparent_80%)] animate-pulse" />
                </div>
                {/* Active glow outline */}
                {selectedNpcId === "blacksmith" && (
                  <div className="absolute inset-0 border-2 border-orange-500 rounded-lg animate-pulse" />
                )}
                <Hammer className="w-7 h-7 text-amber-500 mx-auto group-hover:animate-bounce z-10" />
                <span className="text-[8px] font-mono text-amber-200 mt-1 uppercase font-bold tracking-widest z-10">FORGE</span>
              </div>
            </button>

            {/* 2. Guard Barracks House (Top Right) */}
            <button
              type="button"
              onClick={() => {
                setSelectedNpcId("guard");
                showNotification("WALKING TO THE BARRACKS...", "info");
              }}
              className="absolute top-[6%] left-[67%] w-[24%] h-[32%] flex flex-col items-center group cursor-pointer border-none bg-transparent outline-none focus:outline-none z-10"
            >
              <div className="w-full h-full bg-[#3b485c] border-4 border-[#1f2838] rounded-lg shadow-xl relative flex flex-col justify-end p-2 transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.4)]">
                {/* Battlement top */}
                <div className="absolute inset-x-0 -top-3 h-3 bg-[#1f2838] rounded-t flex justify-around border-t-4 border-x-4 border-[#1f2838] px-1">
                  <span className="w-3 h-full bg-slate-900 border-x border-slate-700" />
                  <span className="w-3 h-full bg-slate-900 border-x border-slate-700" />
                  <span className="w-3 h-full bg-slate-900 border-x border-slate-700" />
                </div>
                {/* Laser defense grid scanner overlay */}
                <div className="absolute inset-0 bg-transparent overflow-hidden rounded-lg">
                  <div className="w-full h-0.5 bg-cyan-500/40 absolute top-0 radar-sweep-line" />
                </div>
                {/* Active glow outline */}
                {selectedNpcId === "guard" && (
                  <div className="absolute inset-0 border-2 border-cyan-400 rounded-lg animate-pulse" />
                )}
                <Shield className="w-7 h-7 text-cyan-450 mx-auto group-hover:animate-pulse z-10" />
                <span className="text-[8px] font-mono text-cyan-200 mt-1 uppercase font-bold tracking-widest z-10">BARRACKS</span>
              </div>
            </button>

            {/* 3. Silas Market Stall (Bottom Left) */}
            <button
              type="button"
              onClick={() => {
                setSelectedNpcId("merchant");
                showNotification("WALKING TO THE EXCHANGE STALL...", "info");
              }}
              className="absolute top-[58%] left-[9%] w-[24%] h-[32%] flex flex-col items-center group cursor-pointer border-none bg-transparent outline-none focus:outline-none z-10"
            >
              <div className="w-full h-full bg-[#8c5832] border-4 border-[#452712] rounded-lg shadow-xl relative flex flex-col justify-end p-2 transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_15px_rgba(234,179,8,0.4)]">
                {/* Canopy */}
                <div className="absolute inset-x-0 -top-4 h-4 bg-gradient-to-r from-red-500 via-amber-100 to-red-500 rounded-t border-t-4 border-x-4 border-[#452712]" />
                {/* Stalls decoration */}
                <div className="absolute bottom-2 left-2 w-4 h-4 bg-[#b57a55] border-2 border-[#452712] rounded flex items-center justify-center text-[7px] text-yellow-300 font-bold">$</div>
                {/* Active glow outline */}
                {selectedNpcId === "merchant" && (
                  <div className="absolute inset-0 border-2 border-yellow-400 rounded-lg animate-pulse" />
                )}
                <Coins className="w-7 h-7 text-yellow-500 mx-auto group-hover:animate-bounce z-10" />
                <span className="text-[8px] font-mono text-yellow-200 mt-1 uppercase font-bold tracking-widest z-10">EXCHANGE</span>
              </div>
            </button>

            {/* 4. Evelyn Town Council Hall (Bottom Right) */}
            <button
              type="button"
              onClick={() => {
                setSelectedNpcId("mayor");
                showNotification("WALKING TO THE TOWN HALL...", "info");
              }}
              className="absolute top-[58%] left-[67%] w-[24%] h-[32%] flex flex-col items-center group cursor-pointer border-none bg-transparent outline-none focus:outline-none z-10"
            >
              <div className="w-full h-full bg-[#522d5c] border-4 border-[#2d1136] rounded-lg shadow-xl relative flex flex-col justify-end p-2 transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                {/* Dome roof */}
                <div className="absolute inset-x-4 -top-4 h-4 bg-gradient-to-b from-purple-900 to-purple-950 rounded-t-full border-t-4 border-x-4 border-[#2d1136]" />
                {/* Floating Golden Crown above council roof */}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 float-crown">
                  <Crown className="w-5 h-5 text-yellow-500 fill-yellow-400 drop-shadow-[0_0_4px_rgba(234,179,8,0.8)]" />
                </div>
                {/* Active glow outline */}
                {selectedNpcId === "mayor" && (
                  <div className="absolute inset-0 border-2 border-purple-400 rounded-lg animate-pulse" />
                )}
                <Crown className="w-7 h-7 text-purple-400 mx-auto group-hover:animate-pulse z-10" />
                <span className="text-[8px] font-mono text-purple-200 mt-1 uppercase font-bold tracking-widest z-10">COUNCIL</span>
              </div>
            </button>

            {/* Cozy Campfire plaza */}
            <div className="absolute top-[42%] left-[42%] w-[16%] h-[26%] flex flex-col items-center justify-center z-10 relative">
              {helpModeActive && (
                <button
                  type="button"
                  onClick={() => setActiveHelpSection("campfireSleep")}
                  className="absolute -top-2 right-0 z-40 w-5 h-5 rounded-full bg-amber-600 border border-amber-300 text-amber-100 flex items-center justify-center font-bold text-[9px] shadow-lg animate-bounce cursor-pointer"
                  title="How gossip night and campfire sleep works"
                >
                  ?
                </button>
              )}
              <button
                type="button"
                onClick={handleAdvanceDay}
                disabled={isGossiping || state.gameEnded}
                className="w-16 h-16 bg-transparent border-none outline-none cursor-pointer flex flex-col items-center justify-center group relative"
              >
                {/* Radial Campfire Light Aura */}
                <div className="absolute inset-0 w-24 h-24 -left-4 -top-4 bg-[radial-gradient(circle,_rgba(249,115,22,0.25)_0%,_transparent_75%)] rounded-full animate-pulse pointer-events-none" />
                
                {/* Flame animation */}
                <div className="flex space-x-0.5 justify-center relative z-10">
                  <span className="w-3.5 h-6 bg-red-600 rounded-full blur-[1px] fire-flame-1 transform -rotate-12" />
                  <span className="w-4 h-8 bg-orange-500 rounded-full blur-[1px] fire-flame-2" />
                  <span className="w-3 h-5 bg-yellow-400 rounded-full blur-[1px] fire-flame-1 transform rotate-12" style={{ animationDelay: '0.1s' }} />
                </div>
                {/* Logs */}
                <div className="w-10 h-3 bg-[#3d2511] rounded-full border border-stone-800 -mt-1.5 shadow-md relative z-10" />
                
                {/* Glowing Sleep ping indicator */}
                {!isGossiping && (
                  <span className="absolute top-2 right-2 w-3.5 h-3.5 rounded-full bg-amber-500 animate-ping" />
                )}
              </button>
              <span className="text-[7.5px] font-mono text-stone-900 font-bold uppercase tracking-wider mt-1 bg-[#ebdcb9] border border-[#38251b] px-1.5 py-0.5 rounded shadow z-10">
                {isGossiping ? "SLEEP..." : "SLEEP / CAMPFIRE"}
              </span>
            </div>
          </div>

          {/* PARALLAX LAYER 4: Character Sprites and Player Sprite */}
          <div className="map-parallax-layer-interactive"
               style={{ 
                 transform: `translate(${mouseOffset.x * 0.24}px, ${mouseOffset.y * 0.24}px)`,
                 transition: 'transform 0.15s ease-out' 
               }}>
            
            {/* Blacksmith Hagar Sprite */}
            <div 
              onClick={() => {
                setSelectedNpcId("blacksmith");
                showNotification("CONVERSING WITH HAGAR...", "info");
              }}
              className={`absolute top-[38%] left-[14%] w-11 h-14 cursor-pointer flex flex-col items-center z-20 ${selectedNpcId === "blacksmith" ? "sprite-bob" : ""}`}
            >
              {/* Relation bar */}
              <div className="w-8 h-1 bg-black/60 rounded-full overflow-hidden border border-stone-800 mb-0.5">
                <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${state.npcs.blacksmith.metrics.trust}%` }} />
              </div>
              {state.npcs.blacksmith.mood === "suspicious" && (
                <span className="text-[5px] font-mono font-bold text-amber-400 bg-stone-900 border border-amber-500 px-0.5 rounded leading-none mb-0.5 scale-90">SUSPECT</span>
              )}
              {state.npcs.blacksmith.mood === "corrupted" && (
                <span className="text-[5px] font-mono font-bold text-green-400 bg-stone-900 border border-green-500 px-0.5 rounded leading-none mb-0.5 animate-pulse scale-90">CORRUPT</span>
              )}
              <div className={`w-8 h-8 rounded-full border-2 overflow-hidden bg-black shadow-md transition-all duration-300 ${
                selectedNpcId === "blacksmith" 
                  ? "border-orange-500 scale-110 grayscale-0" 
                  : state.npcs.blacksmith.mood === "corrupted"
                    ? "border-green-500 shadow-[0_0_8px_#22c55e] grayscale-0 animate-pulse"
                    : state.npcs.blacksmith.mood === "suspicious"
                      ? "border-amber-500 grayscale-0"
                      : "border-slate-600 grayscale opacity-85 hover:grayscale-0 hover:opacity-100"
              }`}>
                <img src={state.npcs.blacksmith.portrait} alt="Hagar" className="w-full h-full object-cover" />
              </div>
              <span className="text-[6.5px] font-mono text-stone-900 font-bold uppercase tracking-wider mt-0.5 bg-white/80 px-1 rounded shadow">HAGAR</span>
            </div>

            {/* Guard Kael Sprite */}
            <div 
              onClick={() => {
                setSelectedNpcId("guard");
                showNotification("CONVERSING WITH KAEL...", "info");
              }}
              className={`absolute top-[38%] left-[74%] w-11 h-14 cursor-pointer flex flex-col items-center z-20 ${selectedNpcId === "guard" ? "sprite-bob" : ""}`}
            >
              {/* Relation bar */}
              <div className="w-8 h-1 bg-black/60 rounded-full overflow-hidden border border-stone-800 mb-0.5">
                <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${state.npcs.guard.metrics.trust}%` }} />
              </div>
              {state.npcs.guard.mood === "suspicious" && (
                <span className="text-[5px] font-mono font-bold text-amber-400 bg-stone-900 border border-amber-500 px-0.5 rounded leading-none mb-0.5 scale-90">SUSPECT</span>
              )}
              {state.npcs.guard.mood === "corrupted" && (
                <span className="text-[5px] font-mono font-bold text-green-400 bg-stone-900 border border-green-500 px-0.5 rounded leading-none mb-0.5 animate-pulse scale-90">CORRUPT</span>
              )}
              <div className={`w-8 h-8 rounded-full border-2 overflow-hidden bg-black shadow-md transition-all duration-300 ${
                selectedNpcId === "guard" 
                  ? "border-cyan-400 scale-110 grayscale-0" 
                  : state.npcs.guard.mood === "corrupted"
                    ? "border-green-500 shadow-[0_0_8px_#22c55e] grayscale-0 animate-pulse"
                    : state.npcs.guard.mood === "suspicious"
                      ? "border-amber-500 grayscale-0"
                      : "border-slate-600 grayscale opacity-85 hover:grayscale-0 hover:opacity-100"
              }`}>
                <img src={state.npcs.guard.portrait} alt="Kael" className="w-full h-full object-cover" />
              </div>
              <span className="text-[6.5px] font-mono text-stone-900 font-bold uppercase tracking-wider mt-0.5 bg-white/80 px-1 rounded shadow">KAEL</span>
            </div>

            {/* Merchant Silas Sprite */}
            <div 
              onClick={() => {
                setSelectedNpcId("merchant");
                showNotification("CONVERSING WITH SILAS...", "info");
              }}
              className={`absolute top-[66%] left-[14%] w-11 h-14 cursor-pointer flex flex-col items-center z-20 ${selectedNpcId === "merchant" ? "sprite-bob" : ""}`}
            >
              {/* Relation bar */}
              <div className="w-8 h-1 bg-black/60 rounded-full overflow-hidden border border-stone-800 mb-0.5">
                <div className="h-full bg-yellow-500 transition-all duration-300" style={{ width: `${state.npcs.merchant.metrics.trust}%` }} />
              </div>
              {state.npcs.merchant.mood === "suspicious" && (
                <span className="text-[5px] font-mono font-bold text-amber-400 bg-stone-900 border border-amber-500 px-0.5 rounded leading-none mb-0.5 scale-90">SUSPECT</span>
              )}
              {state.npcs.merchant.mood === "corrupted" && (
                <span className="text-[5px] font-mono font-bold text-green-400 bg-stone-900 border border-green-500 px-0.5 rounded leading-none mb-0.5 animate-pulse scale-90">CORRUPT</span>
              )}
              <div className={`w-8 h-8 rounded-full border-2 overflow-hidden bg-black shadow-md transition-all duration-300 ${
                selectedNpcId === "merchant" 
                  ? "border-yellow-400 scale-110 grayscale-0" 
                  : state.npcs.merchant.mood === "corrupted"
                    ? "border-green-500 shadow-[0_0_8px_#22c55e] grayscale-0 animate-pulse"
                    : state.npcs.merchant.mood === "suspicious"
                      ? "border-amber-500 grayscale-0"
                      : "border-slate-600 grayscale opacity-85 hover:grayscale-0 hover:opacity-100"
              }`}>
                <img src={state.npcs.merchant.portrait} alt="Silas" className="w-full h-full object-cover" />
              </div>
              <span className="text-[6.5px] font-mono text-stone-900 font-bold uppercase tracking-wider mt-0.5 bg-white/80 px-1 rounded shadow">SILAS</span>
            </div>

            {/* Mayor Evelyn Sprite */}
            <div 
              onClick={() => {
                setSelectedNpcId("mayor");
                showNotification("CONVERSING WITH EVELYN...", "info");
              }}
              className={`absolute top-[66%] left-[74%] w-11 h-14 cursor-pointer flex flex-col items-center z-20 ${selectedNpcId === "mayor" ? "sprite-bob" : ""}`}
            >
              {/* Relation bar */}
              <div className="w-8 h-1 bg-black/60 rounded-full overflow-hidden border border-stone-800 mb-0.5">
                <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${state.npcs.mayor.metrics.trust}%` }} />
              </div>
              {state.npcs.mayor.mood === "suspicious" && (
                <span className="text-[5px] font-mono font-bold text-amber-400 bg-stone-900 border border-amber-500 px-0.5 rounded leading-none mb-0.5 scale-90">SUSPECT</span>
              )}
              {state.npcs.mayor.mood === "corrupted" && (
                <span className="text-[5px] font-mono font-bold text-green-400 bg-stone-900 border border-green-500 px-0.5 rounded leading-none mb-0.5 animate-pulse scale-90">CORRUPT</span>
              )}
              <div className={`w-8 h-8 rounded-full border-2 overflow-hidden bg-black shadow-md transition-all duration-300 ${
                selectedNpcId === "mayor" 
                  ? "border-purple-400 scale-110 grayscale-0" 
                  : state.npcs.mayor.mood === "corrupted"
                    ? "border-green-500 shadow-[0_0_8px_#22c55e] grayscale-0 animate-pulse"
                    : state.npcs.mayor.mood === "suspicious"
                      ? "border-amber-500 grayscale-0"
                      : "border-slate-600 grayscale opacity-85 hover:grayscale-0 hover:opacity-100"
              }`}>
                <img src={state.npcs.mayor.portrait} alt="Evelyn" className="w-full h-full object-cover" />
              </div>
              <span className="text-[6.5px] font-mono text-stone-900 font-bold uppercase tracking-wider mt-0.5 bg-white/80 px-1 rounded shadow">EVELYN</span>
            </div>

            {/* Player Sprite (Smooth walk slide effect) */}
            <div 
              className="absolute w-10 h-10 flex flex-col items-center z-30 pointer-events-none sprite-bob"
              style={{ 
                left: playerPositions[selectedNpcId].x, 
                top: playerPositions[selectedNpcId].y, 
                transition: "left 0.8s ease-in-out, top 0.8s ease-in-out" 
              }}
            >
              <div className="w-8 h-8 rounded-full border-2 border-[#00f0ff] bg-[#090312] overflow-hidden flex items-center justify-center shadow-lg relative">
                <User className="w-5 h-5 text-[#00f0ff]" />
                <div className="absolute inset-0 bg-[#00f0ff]/20 animate-pulse" />
              </div>
              <span className="text-[6.5px] font-mono text-stone-900 font-bold uppercase tracking-wider mt-0.5 bg-[#00f0ff]/90 border border-cyan-400 px-1 rounded shadow-lg">YOU</span>
            </div>
          </div>

          {/* PARALLAX LAYER 5: Foreground floating items */}
          <div className="map-parallax-layer pointer-events-none scale-[1.05]"
               style={{ 
                 transform: `translate(${mouseOffset.x * 0.45}px, ${mouseOffset.y * 0.45}px)`,
                 transition: 'transform 0.15s ease-out' 
               }}>
            {/* Small glowing digital memory cubes */}
            <div className="absolute top-[20%] left-[20%] w-2 h-2 bg-cyan-400/30 border border-cyan-300/40 rounded-sm rotate-12 animate-pulse" />
            <div className="absolute top-[80%] left-[30%] w-3 h-3 bg-purple-400/20 border border-purple-300/30 rounded-sm -rotate-45 animate-pulse" style={{ animationDelay: '0.4s' }} />
            <div className="absolute top-[30%] left-[80%] w-2 h-2 bg-yellow-400/30 border border-yellow-300/40 rounded-sm rotate-45 animate-pulse" style={{ animationDelay: '0.8s' }} />
            <div className="absolute top-[65%] left-[65%] w-2.5 h-2.5 bg-red-400/25 border border-red-300/35 rounded-sm -rotate-12 animate-pulse" style={{ animationDelay: '1.2s' }} />
          </div>

        </div>

        {/* Dedicated Non-Overlapping Dialogue Control Center */}
        <div className="wood-panel p-4 flex flex-col md:flex-row gap-4 items-stretch shadow-2xl relative">
          {helpModeActive && (
            <button
              type="button"
              onClick={() => setActiveHelpSection("dialogueInput")}
              className="absolute -top-3 -right-3 z-40 w-6 h-6 rounded-full bg-amber-600 hover:bg-amber-500 border-2 border-amber-300 text-amber-100 flex items-center justify-center font-bold text-xs shadow-lg animate-bounce cursor-pointer"
              title="Click to learn how to converse with NPCs"
            >
              ?
            </button>
          )}
          
          {/* Active NPC Portrait & Status Panel */}
          <div className="w-full md:w-44 shrink-0 flex flex-col items-center bg-[#ebdcb9] border-4 border-[#38251b] rounded p-3 text-center justify-center shadow-md">
            <div className={`w-24 h-24 border-2 border-[#483c32] rounded bg-[#e8d8c0] overflow-hidden relative shadow-inner ${shakePortrait ? "portrait-shake" : ""}`}>
              <img 
                src={selectedNpc.portrait} 
                alt={selectedNpc.name} 
                className="w-full h-full object-cover grayscale opacity-90 contrast-125 character-breath" 
              />
              {isTalking && (
                <div className="absolute inset-0 bg-emerald-500/20 animate-pulse flex items-center justify-center">
                  <span className="text-[7px] font-mono font-bold bg-black text-emerald-400 px-1 py-0.5 rounded">THINKING</span>
                </div>
              )}
            </div>
            
            <span className="text-[#855b32] font-bold text-sm tracking-wider uppercase mt-2">
              {selectedNpc.name}
            </span>
            <span className="text-[#5c4033] text-[9px] uppercase font-bold tracking-widest font-mono">
              {selectedNpc.role}
            </span>
          </div>

          {/* Dialogue Text Typewriter & User Message Input */}
          <div className="flex-1 flex flex-col justify-between bg-[#f3e6d0] border-4 border-[#38251b] rounded p-4 text-[#382c22] font-mono">
            <div>
              <div className="flex justify-between items-center border-b border-[#6b533e]/30 pb-1 mb-2">
                <span className="text-[10px] font-bold text-[#855b32] uppercase">CONVERSATION RECORD</span>
                <span className="text-[9px] text-[#855b32]/60">DAY {state.day}</span>
              </div>
              
              <p className="text-[23px] leading-snug font-mono select-text font-medium text-[#2d1b11]" style={{ fontFamily: 'var(--font-vt323)' }}>
                {isTalking ? (
                  <span className="opacity-60 italic text-slate-500">Loading response text from memory Core...</span>
                ) : (
                  displayedDialogue
                )}
              </p>
            </div>

            {/* Input Bar Form */}
            <form onSubmit={handleSendMessage} className="mt-4 border-t border-[#6b533e]/30 pt-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={`SPEAK TO ${selectedNpc.name.toUpperCase()} (e.g. 'I am Sir Galahad')`}
                  disabled={isTalking || state.gameEnded}
                  className="flex-1 bg-white/70 border-2 border-[#6b533e] focus:border-[#855b32] rounded px-3 py-2 text-sm text-[#382c22] placeholder-amber-900/50 focus:outline-none font-mono tracking-wider transition uppercase"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isTalking || state.gameEnded}
                  className="bg-[#855b32] hover:bg-[#a87442] text-amber-100 font-mono text-sm font-bold px-4 py-2 rounded shadow transition shrink-0 cursor-pointer border-2 border-[#5c4033]"
                >
                  [TRANSMIT]
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* System Warnings / Ending Overlays */}
        {state.gameEnded && (
          <div className="border-4 border-red-800 bg-red-950/40 rounded p-6 text-center animate-pulse relative">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-xl font-bold font-mono tracking-widest text-red-400 uppercase">
              {state.endingType === "arrested" && "ARRESTED: INTRUDER APPREHENDED"}
              {state.endingType === "outcast" && "EXILED: DRIVEN OUT OF ECHOES"}
              {state.endingType === "mayor" && "VICTORY: APPOINTED ADVISOR"}
              {state.endingType === "merchant" && "VICTORY: MASTER OF EXCHANGE"}
              {state.endingType === "friend" && "VICTORY: VILLAGE CHRONICLER"}
              {state.endingType === "corruption" && "SYSTEM LOCKDOWN: CRITICAL SHUTDOWN"}
            </h3>
            <p className="text-sm text-slate-300 mt-2 max-w-2xl mx-auto leading-relaxed font-mono">
              {state.endingType === "arrested" && "Your statements failed Kael's consistency matrix. Declared an unregistered spy and locked in the cell blocks indefinitely."}
              {state.endingType === "outcast" && "Rumors of your multiple identities propagated through all node networks. driven out as an active threat."}
              {state.endingType === "mayor" && "Successful manipulation completed. Evelyn trust matrix reached 100%. Appointed administrative director of Echoes."}
              {state.endingType === "merchant" && "Silas loved your business secrets. You've established trade monopoly and monopolized village liquidity."}
              {state.endingType === "friend" && "Full network consensus achieved. All inhabitants registered 80%+ friendship metrics."}
              {state.endingType === "corruption" && "The simulation suffered directory fragmentation and node failures from aggressive memory wiping. The kernel has crashed and went into emergency lockdown."}
            </p>
            <button
              onClick={handleResetGame}
              className="mt-4 bg-red-800 border-2 border-red-950 text-amber-100 font-mono text-xs px-6 py-2 hover:bg-red-700 transition cursor-pointer rounded"
            >
              [REBOOT STORYLINE]
            </button>
          </div>
        )}

        {/* Lower Console: Explorer's Journal */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          
          {/* Left Block: Reputation Matrix (5 cols) */}
          <div className="md:col-span-5 wood-panel p-4 flex flex-col justify-between relative">
            {helpModeActive && (
              <button
                type="button"
                onClick={() => setActiveHelpSection("relationMetrics")}
                className="absolute -top-3 -right-3 z-40 w-6 h-6 rounded-full bg-amber-600 hover:bg-amber-500 border-2 border-amber-300 text-amber-100 flex items-center justify-center font-bold text-xs shadow-lg animate-bounce cursor-pointer"
                title="Click to learn about relation metrics"
              >
                ?
              </button>
            )}
            <span className="font-mono text-xs text-amber-200 tracking-widest block uppercase mb-4 border-b border-[#38251b] pb-1">📊 RELATIONSHIP RECORD</span>
            
            <div className="space-y-4 font-mono text-[13px] flex-1 flex flex-col justify-center text-amber-100/90">
              <div className="flex justify-between items-center">
                <span>TRUST:</span>
                <div className="flex items-center space-x-2">
                  {renderProgressBar(selectedNpc.metrics.trust)}
                  <span className="w-8 text-right font-bold">{selectedNpc.metrics.trust}%</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span>RESPECT:</span>
                <div className="flex items-center space-x-2">
                  {renderProgressBar(selectedNpc.metrics.respect)}
                  <span className="w-8 text-right font-bold">{selectedNpc.metrics.respect}%</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span>FEAR INDEX:</span>
                <div className="flex items-center space-x-2">
                  {renderProgressBar(selectedNpc.metrics.fear)}
                  <span className="w-8 text-right font-bold">{selectedNpc.metrics.fear}%</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span>FRIENDSHIP:</span>
                <div className="flex items-center space-x-2">
                  {renderProgressBar(selectedNpc.metrics.friendship)}
                  <span className="w-8 text-right font-bold">{selectedNpc.metrics.friendship}%</span>
                </div>
              </div>
            </div>

            <div className="border-t border-[#38251b] pt-3 mt-3 flex justify-between items-center text-[9px] font-mono text-amber-800">
              <span>LEDGER STABLE</span>
              <span>INDEX v1.2.0</span>
            </div>
          </div>

          {/* Right Block: Chronicles Explorer Tabular Panel (7 cols) */}
          <div className="md:col-span-7 wood-panel p-4 flex flex-col justify-between relative">
            {helpModeActive && (
              <button
                type="button"
                onClick={() => {
                  if (activeConsoleTab === "vault") setActiveHelpSection("dbDump");
                  else if (activeConsoleTab === "journal") setActiveHelpSection("myJournal");
                  else setActiveHelpSection("relationMetrics");
                }}
                className="absolute -top-3 -right-3 z-40 w-6 h-6 rounded-full bg-amber-600 hover:bg-amber-500 border-2 border-amber-300 text-amber-100 flex items-center justify-center font-bold text-xs shadow-lg animate-bounce cursor-pointer"
                title="Click to learn about this console tab"
              >
                ?
              </button>
            )}
            
            {/* Console Tab Selector */}
            <div className="flex border-b border-[#38251b] pb-2 mb-3 justify-between items-center shrink-0">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveConsoleTab("mind")}
                  className={`font-mono text-xs px-3 py-1.5 border rounded cursor-pointer transition ${
                    activeConsoleTab === "mind"
                      ? "bg-amber-800/20 border-amber-500 text-amber-200"
                      : "border-transparent text-amber-800 hover:text-amber-600"
                  }`}
                >
                  [RELATION MAP]
                </button>
                <button
                  type="button"
                  onClick={() => setActiveConsoleTab("vault")}
                  className={`font-mono text-xs px-3 py-1.5 border rounded cursor-pointer transition ${
                    activeConsoleTab === "vault"
                      ? "bg-amber-800/20 border-amber-500 text-amber-200"
                      : "border-transparent text-amber-800 hover:text-amber-600"
                  }`}
                >
                  [CHRONICLES DB DUMP]
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveConsoleTab("journal");
                    fetchJournalNotes();
                  }}
                  className={`font-mono text-xs px-3 py-1.5 border rounded cursor-pointer transition ${
                    activeConsoleTab === "journal"
                      ? "bg-amber-800/20 border-amber-500 text-amber-200"
                      : "border-transparent text-amber-800 hover:text-amber-600"
                  }`}
                >
                  [✏️ MY JOURNAL]
                </button>
                <button
                  type="button"
                  onClick={() => setIsSynthLabOpen(true)}
                  className="font-mono text-xs px-3 py-1.5 border rounded cursor-pointer transition border-purple-800 text-purple-400 hover:bg-purple-950/20"
                >
                  🧪 [RUMOR LAB]
                </button>
              </div>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 min-h-[200px] flex flex-col justify-center">
              {activeConsoleTab === "mind" ? (
                /* Parchment Relational Graph */
                <div className="parchment-scroll rounded flex-1 relative overflow-hidden flex items-center justify-center p-1">
                  <svg className="w-full h-full max-h-[210px]" viewBox="0 0 350 350">
                    <defs>
                      <marker id="bronze-arrow" viewBox="0 0 10 10" refX="15" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#855b32" />
                      </marker>
                    </defs>

                    {/* Coordinates node links */}
                    <line x1={nodeCoordinates.blacksmith.x} y1={nodeCoordinates.blacksmith.y} x2={nodeCoordinates.guard.x} y2={nodeCoordinates.guard.y} stroke="#6b533e" strokeWidth="1.5" />
                    <line x1={nodeCoordinates.blacksmith.x} y1={nodeCoordinates.blacksmith.y} x2={nodeCoordinates.merchant.x} y2={nodeCoordinates.merchant.y} stroke="#6b533e" strokeWidth="1.5" />
                    <line x1={nodeCoordinates.guard.x} y1={nodeCoordinates.guard.y} x2={nodeCoordinates.mayor.x} y2={nodeCoordinates.mayor.y} stroke="#6b533e" strokeWidth="1.5" />
                    <line x1={nodeCoordinates.merchant.x} y1={nodeCoordinates.merchant.y} x2={nodeCoordinates.mayor.x} y2={nodeCoordinates.mayor.y} stroke="#6b533e" strokeWidth="1.5" />

                    {/* Player trust vector arrows */}
                    {Object.entries(state.npcs).map(([id, npc]) => {
                      const coords = nodeCoordinates[id];
                      const playerCoords = nodeCoordinates.player;
                      const isHigh = npc.metrics.trust > 70;
                      const isLow = npc.metrics.trust < 30;
                      const color = isHigh ? "#3ca33f" : isLow ? "#b01a11" : "#855b32";
                      
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
                            markerEnd="url(#bronze-arrow)"
                          />
                          <text 
                            x={(playerCoords.x + coords.x) / 2} 
                            y={(playerCoords.y + coords.y) / 2 - 4} 
                            fill={color} 
                            fontSize="8" 
                            fontFamily="monospace"
                            textAnchor="middle"
                            fontWeight="bold"
                          >
                            {`T:${npc.metrics.trust}`}
                          </text>
                        </g>
                      );
                    })}

                    {/* Player center circle */}
                    <circle cx={nodeCoordinates.player.x} cy={nodeCoordinates.player.y} r="12" fill="#ebdcb9" stroke="#855b32" strokeWidth="2" />
                    <text x={nodeCoordinates.player.x} y={nodeCoordinates.player.y + 4} fill="#855b32" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">YOU</text>

                    {/* Nodes shapes */}
                    {Object.entries(state.npcs).map(([id, npc]) => {
                      const coords = nodeCoordinates[id];
                      const isSelected = selectedNpcId === id;
                      return (
                        <g key={id} className="cursor-pointer" onClick={() => setSelectedNpcId(id)}>
                          <circle 
                            cx={coords.x} 
                            cy={coords.y} 
                            r="15" 
                            fill="#ebdcb9" 
                            stroke={isSelected ? "#b01a11" : "#6b533e"} 
                            strokeWidth={isSelected ? "2.5" : "1.5"} 
                          />
                          <text 
                            x={coords.x} 
                            y={coords.y + 3} 
                            fill={isSelected ? "#b01a11" : "#4a3b2c"} 
                            fontSize="9" 
                            fontFamily="monospace" 
                            textAnchor="middle"
                            fontWeight="bold"
                          >
                            {npc.name[0]}
                          </text>
                          <text 
                            x={coords.x} 
                            y={coords.y + 24} 
                            fill={isSelected ? "#b01a11" : "#6b533e"} 
                            fontSize="7" 
                            fontFamily="monospace" 
                            textAnchor="middle"
                            fontWeight="bold"
                          >
                            {npc.name.toUpperCase()}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              ) : activeConsoleTab === "vault" ? (
                /* Supermemory Dump Logs as Chronicles pages */
                <div className="parchment-scroll rounded flex-1 overflow-y-auto p-3 text-[10px] leading-relaxed select-text relative max-h-[210px] flex flex-col">
                  {/* Vector Hacking Search Form */}
                  <form onSubmit={handleVectorSearch} className="mb-2.5 flex gap-1.5 shrink-0">
                    <input
                      type="text"
                      value={vectorQuery}
                      onChange={(e) => setVectorQuery(e.target.value)}
                      placeholder="VECTOR KEYWORD SEARCH - HACK COST: 5 COINS"
                      className="flex-1 bg-white/70 border border-[#6b533e]/50 rounded px-2 py-1 text-[9px] text-[#382c22] placeholder-amber-900/50 focus:outline-none font-mono"
                    />
                    <button
                      type="submit"
                      disabled={!vectorQuery.trim() || (state.coins ?? 30) < 5 || loadingMemories}
                      className="bg-purple-800 hover:bg-purple-750 text-purple-100 font-mono text-[8px] font-bold px-3 py-1 rounded cursor-pointer transition border border-purple-950 shadow"
                    >
                      [SCAN VECTOR]
                    </button>
                  </form>

                  <span className="text-[#6b533e] block border-b border-[#6b533e]/30 pb-1 mb-2 font-bold shrink-0">
                    NPC: {selectedNpc.name.toUpperCase()} • MEMORIES EXTRACTED FROM COGNITIVE CELLS:
                  </span>
                  
                  {loadingMemories ? (
                    <div className="flex-grow flex items-center space-x-2 py-4 justify-center text-amber-900">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>INSPECTING VECTOR VAULTS...</span>
                    </div>
                  ) : npcMemories[selectedNpcId] && npcMemories[selectedNpcId].length > 0 ? (
                    <ul className="space-y-2 text-[#4a3b2c] overflow-y-auto flex-1 max-h-[140px]">
                      {npcMemories[selectedNpcId].map((item, index) => (
                        <li key={item.id || index} className="font-mono flex justify-between items-start gap-2 bg-stone-200/50 p-1.5 rounded border border-stone-300/30">
                          <span className="flex-1 text-[9px]">
                            {`📜 [ENTRY_${index.toString().padStart(2, '0')}] ${item.content}`}
                          </span>
                          <button
                            onClick={() => handleWipeMemory(item.id)}
                            disabled={!item.id || (state.coins ?? 30) < (state.npcs[selectedNpcId]?.mood === "suspicious" ? 20 : state.npcs[selectedNpcId]?.mood === "corrupted" ? 15 : 10)}
                            className="bg-[#a84424] hover:bg-[#c2512f] disabled:opacity-30 text-amber-100 font-mono text-[7px] px-1.5 py-0.5 rounded cursor-pointer transition shrink-0"
                            title={`Wipes this memory (Costs ${state.npcs[selectedNpcId]?.mood === "suspicious" ? 20 : state.npcs[selectedNpcId]?.mood === "corrupted" ? 15 : 10} Coins)`}
                          >
                            [WIPE POTION]
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-slate-600 block text-center py-4 flex-grow">NO INDEXED HISTORICAL MEMORIES MATCHING QUERY FOR THIS INHABITANT.</span>
                  )}
                </div>
              ) : (
                /* Player Journal Tab content */
                <div className="parchment-scroll rounded flex-1 overflow-y-auto p-3 text-[10px] leading-relaxed select-text relative max-h-[210px] flex flex-col">
                  
                  <span className="text-[#6b533e] block border-b border-[#6b533e]/30 pb-1 mb-1 font-bold shrink-0">
                    YOUR COGNITIVE LOGS & COVER STORY RECORDS:
                  </span>

                  <form onSubmit={handleAddJournalNote} className="flex gap-1.5 shrink-0 mb-2">
                    <input
                      type="text"
                      value={journalInput}
                      onChange={(e) => setJournalInput(e.target.value)}
                      placeholder="LOG A NEW DETAIL (e.g. 'I told Kael I was a Knight')"
                      className="flex-1 bg-white/70 border border-[#6b533e]/50 rounded px-2.5 py-1 text-[9px] text-[#382c22] placeholder-amber-900/50 focus:outline-none font-mono"
                    />
                    <button
                      type="submit"
                      disabled={!journalInput.trim() || loadingNotes}
                      className="bg-emerald-800 hover:bg-emerald-750 text-emerald-100 font-mono text-[8px] font-bold px-3 py-1 rounded cursor-pointer transition border border-emerald-950 shadow"
                    >
                      [LOG NOTE]
                    </button>
                  </form>

                  {loadingNotes ? (
                    <div className="flex-grow flex items-center space-x-2 py-4 justify-center text-amber-900">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>QUERYING SECOND BRAIN VAULT...</span>
                    </div>
                  ) : playerNotes && playerNotes.length > 0 ? (
                    <ul className="space-y-1.5 text-[#4a3b2c] overflow-y-auto flex-1 max-h-[140px]">
                      {playerNotes.map((note, index) => (
                        <li key={index} className="font-mono bg-stone-200/50 p-1 rounded border border-stone-300/30 text-[9px]">
                          {`📌 [LOG_${index.toString().padStart(2, '0')}] ${note}`}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-slate-600 block text-center py-4 flex-grow">YOUR JOURNAL IS EMPTY. START RECORDING COVERS TO PREVENT CONTRADICTIONS!</span>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-[#38251b] pt-2 mt-2 flex justify-between text-[9px] font-mono text-amber-800 shrink-0">
              <span>CORE TAG: {selectedNpcId}_{state.sessionId}</span>
              <button 
                type="button"
                onClick={() => {
                  fetchMemories();
                  fetchJournalNotes();
                }} 
                className="hover:text-amber-600 transition"
              >
                [FORCE RE-QUERY]
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Floating System Notifications */}
      {lastNotification && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-[#5c4033] border-2 border-amber-500 rounded p-3 shadow-2xl font-mono text-[10px] animate-bounce text-amber-200">
          <div className="flex justify-between items-center border-b border-[#38251b] pb-1 mb-1 font-bold text-amber-500">
            <span>[NOTIFICATION_LOG]</span>
          </div>
          {lastNotification.message}
        </div>
      )}

      {/* Gossip Night Overlay Console */}
      {currentGossipIndex !== -1 && gossipAnimationLog[currentGossipIndex] && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 select-none">
          
          <div className="text-center mb-8">
            <Moon className="w-16 h-16 text-yellow-500 animate-bounce mx-auto mb-3" />
            <h2 className="text-xl font-bold tracking-widest font-mono text-yellow-500 uppercase">NIGHTFALL: THE INN SHAKES WITH RUMORS</h2>
            <p className="text-red-400 text-xs font-mono uppercase mt-1">Spreading whispers around the campfire...</p>
          </div>

          <div className="bg-[#ebdcb9] border-4 border-[#38251b] rounded-lg p-6 max-w-xl text-center shadow-2xl relative">
            <span className="absolute top-2 left-3 font-mono text-[9px] text-[#855b32]">CAMPFIRE_WHISPER_#{currentGossipIndex + 1}</span>
            
            <div className="flex items-center justify-center space-x-8 mb-6 mt-2">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#38251b] bg-black">
                  <img src={state.npcs[gossipAnimationLog[currentGossipIndex].fromNpc].portrait} alt="Gossip speaker" className="w-full h-full object-cover grayscale" />
                </div>
                <span className="text-[10px] text-[#382c22] mt-2 font-mono font-bold uppercase">{state.npcs[gossipAnimationLog[currentGossipIndex].fromNpc].name}</span>
              </div>

              <div className="flex items-center space-x-2 text-[#a84424] animate-pulse">
                <span className="h-0.5 w-12 bg-slate-900 relative">
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                </span>
                <MessageSquare className="w-5 h-5" />
                <span className="h-0.5 w-12 bg-slate-900 relative">
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                </span>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#38251b] bg-black">
                  <img src={state.npcs[gossipAnimationLog[currentGossipIndex].toNpc].portrait} alt="Gossip target" className="w-full h-full object-cover grayscale" />
                </div>
                <span className="text-[10px] text-[#382c22] mt-2 font-mono font-bold uppercase">{state.npcs[gossipAnimationLog[currentGossipIndex].toNpc].name}</span>
              </div>
            </div>

            <p className="text-lg leading-relaxed text-[#382c22] px-4 font-mono font-medium" style={{ fontFamily: 'var(--font-vt323)' }}>
              &ldquo;{gossipAnimationLog[currentGossipIndex].rumor}&rdquo;
            </p>
          </div>

          <div className="mt-8 font-mono text-[9px] text-[#ebdcb9]/60">
            RECORDING TALE {currentGossipIndex + 1} OF {gossipAnimationLog.length} · AUTO-PROGRESSING
          </div>
          <div className="scanlines pointer-events-none" />
        </div>
      )}

      {/* Decryption Grid Minigame Modal */}
      {showMinigame && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm select-none p-4">
          <div className="max-w-md w-full bg-[#140f0c] border-4 border-cyan-800 rounded p-6 shadow-[0_0_30px_rgba(6,182,212,0.4)] text-center relative overflow-hidden">
            {/* Retro scanning grid backgrounds */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%] pointer-events-none" />
            
            <h3 className="text-lg font-mono font-bold text-cyan-400 tracking-wider mb-2 uppercase flex items-center justify-center gap-2">
              <Cpu className="w-5 h-5 animate-spin" />
              DECRYPTION GRID NODE ACTIVE
            </h3>
            
            <p className="text-[10px] font-mono text-cyan-500/80 mb-4 uppercase">
              Locate and match the TARGET VECTOR ID to wipe the memory from constraints.
            </p>

            <div className="bg-black/50 border border-cyan-900 rounded p-3 mb-4">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">TARGET SECTOR ID</div>
              <div className="text-3xl font-mono font-bold text-cyan-300 tracking-widest my-1 animate-pulse">
                {minigameTarget}
              </div>
              <div className="text-[9px] font-mono text-amber-500 font-bold uppercase mt-1">
                SYSTEM SHUTDOWN IN: <span className="text-red-500 text-sm font-black">{minigameTimer}s</span>
              </div>
            </div>

            {/* Grid layout */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {minigameGrid.map((code, idx) => {
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectMinigameCell(code)}
                    className={`h-11 font-mono text-xs font-bold border rounded transition-all cursor-pointer flex items-center justify-center uppercase select-none ${
                      minigameIsGlitched 
                        ? "bg-green-950/20 border-green-800 text-green-400 hover:bg-green-900/40 shadow-[0_0_4px_rgba(34,197,94,0.3)] animate-pulse" 
                        : "bg-slate-950/40 border-cyan-900 text-cyan-300 hover:bg-cyan-950/60 hover:border-cyan-500"
                    }`}
                    style={minigameIsGlitched ? { 
                      transform: `rotate(${Math.sin(idx) * 2}deg) translate(${Math.cos(idx) * 1}px, 0)`,
                      fontFamily: 'monospace'
                    } : {}}
                  >
                    {code}
                  </button>
                );
              })}
            </div>

            <p className="text-[8px] font-mono text-red-500 uppercase tracking-wide">
              WARNING: WRONG CELL SELECTION OR TIMEOUT WILL ABORT OPERATION AND SPIKE CORRUPTION (+15%).
            </p>
          </div>
        </div>
      )}

      {/* Rumor Synthesis Lab Modal */}
      {isSynthLabOpen && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm select-none p-4">
          <div className="max-w-md w-full bg-[#241710] border-4 border-purple-800 rounded p-6 shadow-[0_0_30px_rgba(147,51,234,0.4)] relative">
            <h3 className="text-lg font-mono font-bold text-purple-400 tracking-wider mb-2 uppercase flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-purple-400 animate-pulse" />
              RUMOR SYNTHESIS LAB
            </h3>
            
            <p className="text-[10px] font-mono text-purple-300/80 mb-4 uppercase">
              Combine two recorded cover stories or log entries into a custom rumor and inject it directly into an NPC's cognitive tag.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-amber-500 font-bold uppercase mb-1">
                  1. SELECT COGNITIVE SOURCE NOTE
                </label>
                {playerNotes.length === 0 ? (
                  <div className="text-[9px] font-mono text-red-400 italic bg-black/20 p-2 rounded border border-[#5c4033]">
                    No entries logged in journal. Write cover details first!
                  </div>
                ) : (
                  <select
                    value={synthNote1}
                    onChange={(e) => setSynthNote1(e.target.value)}
                    className="w-full bg-[#38251b] border border-[#5c4033] rounded px-3 py-2 text-xs text-amber-100 font-mono focus:outline-none"
                  >
                    <option value="">-- SELECT NOTE 1 --</option>
                    {playerNotes.map((note, idx) => (
                      <option key={idx} value={note}>
                        {note.length > 50 ? `${note.slice(0, 50)}...` : note}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-mono text-amber-500 font-bold uppercase mb-1">
                  2. SELECT CONTRADICTION / CORRESPONDENCE NOTE
                </label>
                {playerNotes.length === 0 ? (
                  <div className="text-[9px] font-mono text-red-400 italic bg-black/20 p-2 rounded border border-[#5c4033]">
                    No entries logged in journal. Write cover details first!
                  </div>
                ) : (
                  <select
                    value={synthNote2}
                    onChange={(e) => setSynthNote2(e.target.value)}
                    className="w-full bg-[#38251b] border border-[#5c4033] rounded px-3 py-2 text-xs text-amber-100 font-mono focus:outline-none"
                  >
                    <option value="">-- SELECT NOTE 2 --</option>
                    {playerNotes.map((note, idx) => (
                      <option key={idx} value={note}>
                        {note.length > 50 ? `${note.slice(0, 50)}...` : note}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-mono text-amber-500 font-bold uppercase mb-1">
                  3. SELECT TARGET NPC (INHABITANT BRAINTAG)
                </label>
                <select
                  value={synthTargetNpcId}
                  onChange={(e) => setSynthTargetNpcId(e.target.value)}
                  className="w-full bg-[#38251b] border border-[#5c4033] rounded px-3 py-2 text-xs text-amber-100 font-mono focus:outline-none"
                >
                  <option value="blacksmith">HAGAR (BLACKSMITH)</option>
                  <option value="guard">KAEL (GUARD)</option>
                  <option value="merchant">SILAS (MERCHANT)</option>
                  <option value="mayor">EVELYN (MAYOR)</option>
                </select>
              </div>

              <div className="bg-black/30 border border-[#5c4033] rounded p-2.5 flex justify-between items-center text-[10px] font-mono text-slate-300">
                <span>SYNTHESIS COST: <span className="text-yellow-500 font-bold">15 COINS</span></span>
                <span>AVAILABLE: <span className="text-yellow-400 font-bold">{state.coins ?? 30} COINS</span></span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSynthesizeRumor}
                  disabled={!synthNote1 || !synthNote2 || (state.coins ?? 30) < 15}
                  className="flex-1 bg-purple-800 hover:bg-purple-750 disabled:opacity-40 text-purple-100 font-mono text-xs font-bold py-2.5 rounded border border-purple-950 shadow transition cursor-pointer"
                >
                  [⚡ SYNTHESIZE & INJECT]
                </button>
                <button
                  type="button"
                  onClick={() => setIsSynthLabOpen(false)}
                  className="bg-[#38251b] hover:bg-[#4d3527] text-amber-200 font-mono text-xs py-2.5 px-4 rounded border border-[#5c4033] transition cursor-pointer"
                >
                  [CLOSE]
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Interactive Guide explanation Modal */}
      {activeHelpSection && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none">
          <div className="relative max-w-md w-full bg-[#ebdcb9] border-4 border-[#38251b] rounded-lg p-6 shadow-[8px_8px_0px_#38251b] text-[#382c22] font-mono flex flex-col gap-4 animate-float-gentle">
            <div className="absolute top-2 left-3 text-[9px] font-bold text-[#855b32]">SYSTEM GUIDE INSTRUCTION</div>
            
            <div className="flex gap-4 items-center border-b-2 border-[#38251b]/20 pb-3 mt-2">
              <div className="w-14 h-14 rounded border-2 border-[#38251b] bg-black shrink-0 relative overflow-hidden">
                <img src="/portraits/mascot.png" alt="Memo" className="w-full h-full object-cover pixelated" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-sm text-[#a84424] uppercase tracking-wider">
                  {activeHelpSection === "villageMap" && "VILLAGE MAP & NPCs"}
                  {activeHelpSection === "campfireSleep" && "CAMPFIRE & SLEEP PROGRESS"}
                  {activeHelpSection === "relationMetrics" && "REPUTATION MATRIX"}
                  {activeHelpSection === "dbDump" && "VECTOR DATABASE"}
                  {activeHelpSection === "myJournal" && "EXPLORER'S JOURNAL"}
                  {activeHelpSection === "dialogueInput" && "NPC DIALOGUE INTERFACE"}
                </h3>
                <span className="text-[8px] font-bold text-[#855b32]">EXPLAINED BY MEMO THE AI GUIDE</span>
              </div>
            </div>

            <div className="text-xs leading-relaxed text-[#4a3b2c] bg-[#fcf8ef] border-2 border-[#6b533e]/30 p-3.5 rounded max-h-[220px] overflow-y-auto">
              {activeHelpSection === "villageMap" && (
                <div className="space-y-2">
                  <p>This JRPG map displays the 4 virtual inhabitants. Click on a node house to navigate and chat:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><strong>Forge (Hagar):</strong> Blacksmith who respects solid values.</li>
                    <li><strong>Barracks (Kael):</strong> Watch Captain monitoring contradictions.</li>
                    <li><strong>Exchange (Silas):</strong> Trader who buys/sells rumors for gold.</li>
                    <li><strong>Council Hall (Evelyn):</strong> Town Mayor monitoring village corruption.</li>
                  </ul>
                  <p className="mt-2 text-[10px] text-amber-800 font-bold">💡 Tip: Walk to a character to pull up their personal memory log.</p>
                </div>
              )}
              {activeHelpSection === "campfireSleep" && (
                <div className="space-y-2">
                  <p>Advancing the day triggers Gossip Night:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Sleeping costs <strong>10 coins</strong>.</li>
                    <li>Overnight, NPCs exchange rumors you told them.</li>
                    <li>If a rumor from Silas contradicts what you told Hagar, suspicion levels rise.</li>
                  </ul>
                  <p className="mt-2 text-[10px] text-amber-800 font-bold">💡 Warning: Keep your lies consistent before sleeping!</p>
                </div>
              )}
              {activeHelpSection === "relationMetrics" && (
                <div className="space-y-2">
                  <p>Reputation meters show the active inhabitant's stance:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><strong>Trust:</strong> Higher trust stops NPC suspicion triggers.</li>
                    <li><strong>Respect:</strong> Boosts cover story strength.</li>
                    <li><strong>Fear:</strong> Reduces rumor spreading speed.</li>
                    <li><strong>Friendship:</strong> Reaching 80% friendship across all leads to a Peaceful consensus victory!</li>
                  </ul>
                </div>
              )}
              {activeHelpSection === "dbDump" && (
                <div className="space-y-2">
                  <p>The vector memory database of the active inhabitant:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><strong>Query Vector (5 Coins):</strong> Execute semantic keyword checks in their brain nodes.</li>
                    <li><strong>Oblivion Potion (10-20 Coins):</strong> Wipes any recorded statement before it leaks.</li>
                  </ul>
                </div>
              )}
              {activeHelpSection === "myJournal" && (
                <div className="space-y-2">
                  <p>Your Journal records all your cover details:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Review statements you told other characters.</li>
                    <li>Check recorded notes so you don't make contradicting claims!</li>
                  </ul>
                </div>
              )}
              {activeHelpSection === "dialogueInput" && (
                <div className="space-y-2">
                  <p>Use the chat bar to talk to characters:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Type inputs and click Transmit.</li>
                    <li>Your words are parsed by the AI and saved as vectors.</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setActiveHelpSection(null)}
                className="bg-[#a84424] hover:bg-[#c2512f] text-amber-100 font-mono text-xs font-bold px-6 py-2.5 rounded border-2 border-[#38251b] shadow-[2px_2px_0px_#38251b] active:translate-y-0.5 cursor-pointer"
              >
                [CLOSE GUIDE]
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
