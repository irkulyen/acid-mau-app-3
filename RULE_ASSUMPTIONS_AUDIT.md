# Rule Assumptions Audit (Crazy Amsel)

Date: 2026-03-13  
Goal: track all gameplay assumptions that must be explicitly approved by the developer.

## Scope

- `shared/game-rules.ts`
- `shared/game-engine.ts`
- `server/game-socket.ts`

## Open Assumptions Requiring Explicit Rule Approval

1. Card-play validation priorities and exceptions (`drawChain`, `wishSuit`, `unter`, `schellen-8`)  
   File: `shared/game-rules.ts`

2. Special card effects (`bube`, `ass`, `7`, `schellen-8`) including 2-player edge cases  
   File: `shared/game-rules.ts`

3. Loss/elimination table by player count (2-4 => 7, 5 => 6, 6 => 5)  
   File: `shared/game-rules.ts`

4. Start-of-round special-card behavior when first discard card is a special card  
   File: `shared/game-engine.ts`

5. Wish reset semantics and draw semantics during/after wish situations  
   File: `shared/game-engine.ts`

6. Round/game end criteria and loser/winner resolution details  
   File: `shared/game-rules.ts`, `shared/game-engine.ts`

7. Blackbird trigger derivation from state transitions (winner/loser/chain/round_start/mvp)  
   File: `server/game-socket.ts`  
   Status: runtime-gated by `ENABLE_BLACKBIRD_EVENTS=false` by default.

8. Bot move strategy and suit-choice heuristics  
   File: `server/game-socket.ts`  
   Status: runtime-gated by `ENABLE_BOTS=false` by default.

## Already Applied Guardrails

- Client rule computation removed from game UI.
- Implicit gameplay automations (`auto-draw`, `auto-ready`, `auto-next-round`) are feature-flagged and disabled by default.
- Optional startup guard:
  - `ENFORCE_EXPLICIT_RULESET=true`
  - requires `RULESET_ID` to be set.

## Next Required Inputs From Developer

Provide explicit approval/spec for:

1. Play validation matrix (normal, wish, chain, special cards)
2. Special card effects and precedence
3. Round loss and elimination model
4. End-of-round and end-of-game resolution
5. Blackbird trigger matrix (if enabled)
6. Bot decision policy (if enabled)

Without explicit approval, assumptions must stay gated or be replaced by `RuleNotSpecifiedError` in strict mode.
