# AI That Never Forgets -- Hackathon Execution Plan

## Pitch

**What if every NPC had a real memory?** Not scripted dialogue trees,
but persistent memories, gossip, trust, and relationships that evolve
forever.

------------------------------------------------------------------------

## Core Gameplay Loop

``` text
Meet NPC
   ↓
Talk naturally
   ↓
LLM extracts memories
   ↓
Store in Supermemory
   ↓
NPC personality changes
   ↓
NPC shares gossip
   ↓
World changes
```

Keep the MVP intentionally small: - One village - 3--5 NPCs - Natural
language conversations - Persistent consequences

------------------------------------------------------------------------

# Story

The player arrives in a mysterious village where nobody knows them.

Every NPC has: - Personality - Trust score - Memories - Relationships -
Secrets

Example:

-   Blacksmith
    -   Likes honesty
    -   Friends with Guard
-   Merchant
    -   Loves gossip
-   Guard
    -   Values consistency

------------------------------------------------------------------------

# Core Mechanic

The world remembers.

Example:

Merchant: \> "Who are you?"

Player: \> "I'm a knight."

Later...

Guard: \> "Who are you?"

Player: \> "Just a traveler."

Merchant tells Guard.

Guard notices contradiction.

Trust decreases.

------------------------------------------------------------------------

# Supermemory Integration

Each NPC has its own memory namespace.

    npc_blacksmith
    npc_guard
    npc_merchant
    npc_mayor
    player_memory

Store: - Preferences - Lies - Promises - Secrets - Relationships -
Important events - Reputation

Examples:

    Preference
    Fear: Dogs

    Event
    Player confessed stealing bread

    Secret
    Player asked NPC not to tell anyone

After every conversation:

    Conversation
          ↓
    Summarize
          ↓
    Extract structured memories
          ↓
    Merge/update using Supermemory
          ↓
    Retrieve relevant memories next conversation

------------------------------------------------------------------------

# Gossip System

At the end of each day:

    Merchant
       ↓
    Guard
       ↓
    Mayor

Each NPC shares one important memory.

Rumors spread naturally.

------------------------------------------------------------------------

# Reputation System

Every NPC tracks:

-   Trust
-   Respect
-   Fear
-   Friendship

These values are injected into prompts.

Example prompt:

    You are the Blacksmith.

    Personality:
    Gruff but honest.

    Trust:
    62

    Relevant memories:
    - Player likes dogs.
    - Player lied about being a knight.
    - Player repaired my sword.

    Respond naturally.

------------------------------------------------------------------------

# Win Conditions

No combat.

Possible endings:

-   Become mayor
-   Become everyone's friend
-   Become village outcast
-   Get arrested
-   Become wealthy merchant

------------------------------------------------------------------------

# Suggested Tech Stack

Frontend - React - Phaser or PixiJS - Tailwind - Framer Motion - React
Flow (relationship graph)

Backend - Next.js or NestJS - Supermemory - Gemini/OpenAI -
Supabase/Postgres

------------------------------------------------------------------------

# 24-Hour Timeline

## Hours 1--4

-   Village map
-   NPC movement
-   Chat UI

## Hours 5--8

-   LLM integration
-   Supermemory integration

## Hours 9--12

-   Memory extraction
-   Trust system
-   Personality prompts

## Hours 13--16

-   Gossip system
-   Day/night cycle

## Hours 17--20

-   Relationship graph
-   UI polish
-   Animations

## Hours 21--24

-   Sound
-   Demo flow
-   Bug fixes

------------------------------------------------------------------------

# WOW Feature

Village Mind panel.

                Mayor
                   │
            Distrusts
                   │
                Player
             /          \
     Merchant        Blacksmith
          │               │
     Told Secret     Trust +15
          │
        Guard

Animated edges update as rumors spread.

------------------------------------------------------------------------

# UI Inspiration

Visual style: - Cozy pixel-art village - Mystery atmosphere - Character
portraits - Dialogue-focused interface - Animated relationship graph -
Journal sidebar for memories - Trust meter on each NPC

Inspired by: - VA-11 Hall-A - Oxenfree - Citizen Sleeper - Disco Elysium

------------------------------------------------------------------------

# Demo Script (3 Minutes)

1.  Tell Merchant: "I'm the King's messenger."

2.  Supermemory stores it.

3.  Tell Guard: "I'm just a traveler."

4.  Advance one day.

5.  Gossip spreads.

6.  Open Village Mind.

7.  Relationship graph updates live.

8.  Guard confronts player.

9.  Trust visibly drops.

This demonstrates persistent AI memory, evolving relationships, and a
living social simulation powered by Supermemory.
