import { cardArt } from "./cardArt";
import type { Game } from "./games";

/**
 * Card image filename for a game, or undefined to fall back to the emoji tile.
 *
 * An explicit `cardImage` on the game wins, so hand-picked art can override a
 * generated file. Otherwise this consults the manifest that
 * scripts/generate-cards.mts writes, so newly generated art is picked up
 * without editing lib/games.ts.
 *
 * This lives apart from lib/games.ts on purpose: games.ts is the hand-written
 * source of truth and stays free of generated imports, which also lets the
 * generator script import it directly under plain Node.
 */
export function getCardImage(game: Game): string | undefined {
  return game.cardImage ?? cardArt[game.slug];
}
