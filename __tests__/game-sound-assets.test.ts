import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

const soundsDir = join(__dirname, "..", "assets", "sounds");

function sha256(path: string): string {
  const data = readFileSync(path);
  return createHash("sha256").update(data).digest("hex");
}

describe("game sound assets", () => {
  it("uses distinct source files for clutch/rivalry callouts", () => {
    const roundEnd = join(soundsDir, "round-end.wav");
    const blackbird = join(soundsDir, "blackbird.mp3");
    const clutch = join(soundsDir, "clutch-callout.wav");
    const rivalry = join(soundsDir, "rivalry-callout.wav");

    const roundEndHash = sha256(roundEnd);
    const blackbirdHash = sha256(blackbird);
    const clutchHash = sha256(clutch);
    const rivalryHash = sha256(rivalry);

    expect(clutchHash).not.toBe(roundEndHash);
    expect(rivalryHash).not.toBe(blackbirdHash);
    expect(clutchHash).not.toBe(rivalryHash);
  });
});

