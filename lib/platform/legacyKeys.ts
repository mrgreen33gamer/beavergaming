/**
 * Pre-platform localStorage keys, by game slug.
 *
 * These were written by each game independently and follow no convention
 * (-highscore, -high, -best, -wins). Players have real scores under them, so
 * SaveApi reads these as a fallback and never orphans them.
 *
 * Add an entry here when migrating a game whose legacy key is not listed.
 */
export const LEGACY_HIGH_SCORE_KEYS: Record<string, string> = {
  asteroids: "asteroids-highscore",
  "apple-shooter": "apple-shooter-highscore",
  battleship: "battleship-best",
  breakout: "breakout-highscore",
  "bubble-shooter": "bubble-highscore",
  centipede: "centipede-high",
  "dam-rush": "dam-rush-highscore",
  "dino-runner": "dino-highscore",
  frogger: "frogger-highscore",
  "lights-out": "lightsout-best",
  "tank-shooter": "bc-best",
  "air-hockey": "airhockey-wins",
};
