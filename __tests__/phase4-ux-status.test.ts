import { describe, expect, it } from "vitest";
import { createGameState } from "../shared/game-engine";
import {
  getGamePriorityPills,
  getPlayableCount,
  getRoomFlowStatus,
  shouldShowSecondaryGameBanner,
  toFriendlyRoomError,
} from "../lib/ux-status";

describe("Phase 4 UX status helpers", () => {
  it("maps technical join errors to actionable room messages", () => {
    expect(toFriendlyRoomError("Room not found")).toContain("nicht gefunden");
    expect(toFriendlyRoomError("Invalid room code")).toContain("Raum-Code");
    expect(toFriendlyRoomError("Session temporarily unavailable. Please retry.")).toContain("kurzzeitig");
    expect(toFriendlyRoomError("Failed to create room")).toContain("nicht erstellt");
  });

  it("reports room flow status for reconnecting and joined states", () => {
    const reconnecting = getRoomFlowStatus({
      isConnected: false,
      isJoining: true,
      hasRoomState: false,
      joinAttempt: 2,
    });
    expect(reconnecting.tone).toBe("warning");
    expect(reconnecting.title).toContain("Verbindung");

    const joined = getRoomFlowStatus({
      isConnected: true,
      isJoining: false,
      hasRoomState: true,
    });
    expect(joined.tone).toBe("success");
    expect(joined.title).toBe("Verbunden");

    const connectedNoRoom = getRoomFlowStatus({
      isConnected: true,
      isJoining: false,
      hasRoomState: false,
    });
    expect(connectedNoRoom.detail).toContain("Noch keinem Raum");
  });

  it("reports reconnect status when socket drops but room state already exists", () => {
    const reconnectingInRoom = getRoomFlowStatus({
      isConnected: false,
      isJoining: false,
      hasRoomState: true,
    });
    expect(reconnectingInRoom.tone).toBe("warning");
    expect(reconnectingInRoom.title).toContain("unterbrochen");
  });

  it("prioritizes draw chain and playable card clarity for active player", () => {
    const state = createGameState(
      1,
      "ABC123",
      [
        { id: 1, userId: 11, username: "Host", hand: [{ id: "rot-7", suit: "rot", rank: "7" }, { id: "gruen-9", suit: "gruen", rank: "9" }], lossPoints: 0, isEliminated: false, isReady: false },
        { id: 2, userId: 22, username: "Guest", hand: [{ id: "eichel-8", suit: "eichel", rank: "8" }], lossPoints: 0, isEliminated: false, isReady: false },
      ],
      11,
      5,
    );
    const currentPlayer = state.players[state.currentPlayerIndex];
    state.phase = "playing";
    state.playableCardIds = [currentPlayer.hand[0].id];
    state.drawChainCount = 3;

    const playableCount = getPlayableCount({
      state,
      currentPlayer,
      isMyTurn: true,
    });
    expect(playableCount).toBe(1);

    const pills = getGamePriorityPills({
      state,
      currentPlayer,
      isMyTurn: true,
      playableCount,
    });
    expect(pills[0]?.label).toContain("Du bist am Zug");
    expect(pills[1]?.label).toContain("Spielbar: 1");
    expect(pills[2]?.label).toContain("Ziehkette +3");
  });

  it("hides secondary banners on compact screens during critical states", () => {
    expect(
      shouldShowSecondaryGameBanner({
        isCompactHeight: true,
        drawChainCount: 4,
        hasWishSuit: false,
        hasNoPlayableCards: false,
      }),
    ).toBe(false);

    expect(
      shouldShowSecondaryGameBanner({
        isCompactHeight: true,
        drawChainCount: 0,
        hasWishSuit: true,
        hasNoPlayableCards: false,
      }),
    ).toBe(false);

    expect(
      shouldShowSecondaryGameBanner({
        isCompactHeight: true,
        drawChainCount: 0,
        hasWishSuit: false,
        hasNoPlayableCards: false,
      }),
    ).toBe(false);

    expect(
      shouldShowSecondaryGameBanner({
        isCompactHeight: false,
        drawChainCount: 2,
        hasWishSuit: false,
        hasNoPlayableCards: false,
      }),
    ).toBe(false);

    expect(
      shouldShowSecondaryGameBanner({
        isCompactHeight: false,
        drawChainCount: 0,
        hasWishSuit: false,
        hasNoPlayableCards: false,
      }),
    ).toBe(true);

    expect(
      shouldShowSecondaryGameBanner({
        isCompactHeight: false,
        drawChainCount: 0,
        hasWishSuit: false,
        hasNoPlayableCards: false,
        hasActiveFx: true,
      }),
    ).toBe(false);
  });
});
