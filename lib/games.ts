export type GameCategory = "action" | "arcade" | "puzzle" | "reflex" | "classic";

export type Game = {
  slug: string;
  title: string;
  blurb: string;
  description: string;
  category: GameCategory;
  controls: string;
  emoji: string;
  accent: string; // hex color for the tile
  featured?: boolean;
  cardImage?: string; // path under /game-cards/ e.g. "helicopter.jpg"
};

export const games: Game[] = [
  {
    slug: "dam-rush",
    title: "Dam Rush",
    blurb: "The water's rising. Build or drown.",
    description:
      "You're a beaver in a flooding reservoir, and the only way out is up. Each stage shows a glowing GOAL line — race your dam up to it by catching logs, sticks, and rocks that drift down the lanes, while the water relentlessly rises toward your crest. Reach the goal and the flood recedes; clear it and a bigger, faster surge rolls in (morning, midday, sunset, storm). Dodge bombs and snags that wreck your dam, chain catches for combo multipliers, grab power-ups (calm water, speed paddle, reinforcement, mega-log), and brace for FLOOD SURGES. Three lives, endless stages, one very nervous lodge of baby beavers.",
    category: "action",
    controls: "↑ ↓ / W S / mouse / drag to move",
    emoji: "🦫",
    accent: "#5fc8e0",
  },
  {
    slug: "tank-shooter",
    title: "Base Command",
    blurb: "10 buildings · 8 unit classes · boss waves · abilities",
    description:
      "Full tactical command. Build 10 structure types across 10 slots — barracks, sniper nests, tank factories, mech bays, hangars, drone hives, artillery posts, flame bunkers, radar towers, and repair depots. Each spawns smart AI units that auto-target enemies by threat priority. Upgrade buildings to Lv3 for stronger squads. Face 8 enemy types including stealth infiltrators, bombers, healers, and massive bosses every 5 waves. Deploy commander abilities: Airstrike, Reinforce, and Shield. Chain kills for combo multipliers. Day/night cycle shifts the battlefield. Fullscreen and touch-friendly.",
    category: "action",
    controls: "Tap slots to build &middot; Upgrade or sell buildings &middot; Use abilities &middot; START WAVE to begin",
    emoji: "🪖",
    accent: "#7fd650",
  },
  {
    slug: "helicopter",
    title: "Helicopter",
    blurb: "One button. Don't hit the walls.",
    description:
      "The legendary one-button endless flyer. Hold to rise, release to fall. Dodge the scrolling pillars for as long as you can.",
    category: "arcade",
    controls: "Hold SPACE or click",
    emoji: "🚁",
    accent: "#ff6b1a",
    cardImage: "helicopter.jpg",
    featured: true,
  },
  {
    slug: "apple-shooter",
    title: "Apple Shooter",
    blurb: "Aim, charge, fire. Don't miss.",
    description:
      "William Tell with a bow and arrow. Pull back to charge your shot, aim at the apple on your friend's head, and pray.",
    category: "action",
    controls: "Click and drag to aim, release to fire",
    emoji: "🏹",
    accent: "#d63d3d",
  },
  {
    slug: "snake",
    title: "Snake",
    blurb: "Eat. Grow. Don't bite yourself.",
    description:
      "The Nokia classic. Steer your snake to gobble pellets and grow longer. One wrong turn and you're toast.",
    category: "classic",
    controls: "Arrow keys or WASD",
    emoji: "🐍",
    accent: "#7fd650",
  },
  {
    slug: "memory-match",
    title: "Memory Match",
    blurb: "Flip pairs. 100+ levels. Don't blink.",
    description:
      "Start with 4 simple pairs on level 1. Every level adds more tiles. By level 50 you're handling 24 pairs at once — and that's when look-alike symbol families start sneaking in: 8 different moon phases, 7 colored squares, 8 arrows. Suddenly the game stops being about remembering categories and starts being about remembering exact variants. Your progress saves automatically.",
    category: "puzzle",
    controls: "Click cards to flip",
    emoji: "🃏",
    accent: "#e8b84a",
  },
  {
    slug: "whack-a-mole",
    title: "Whack-a-Mole",
    blurb: "60 seconds. As many bonks as possible.",
    description:
      "Moles pop up. You whack them. The clock is ticking. The faster you click, the higher you score.",
    category: "reflex",
    controls: "Click the moles",
    emoji: "🔨",
    accent: "#c45ed6",
  },
  {
    slug: "space-invaders",
    title: "Space Invaders",
    blurb: "Hold the line against the alien descent.",
    description:
      "The arcade legend. Slide your cannon left and right, fire upward, and clear the descending grid of aliens before they reach the bottom. Each wave gets faster. Don't let them land.",
    category: "arcade",
    controls: "← → or A/D to move &middot; SPACE to shoot",
    emoji: "👾",
    accent: "#7fd650",
  },
  {
    slug: "galaga",
    title: "Galaga",
    blurb: "Swooping formations. Dodge the dive bombers.",
    description:
      "Enemies swarm in a swaying formation, then peel off to dive-bomb your ship in looping arcs. Shoot them in formation for points — or risk it and pick them off mid-dive for double. Survive endless waves.",
    category: "arcade",
    controls: "← → or A/D to move &middot; SPACE to shoot",
    emoji: "🛸",
    accent: "#5fc8e0",
  },
  {
    slug: "pacman",
    title: "Pac-Man",
    blurb: "Eat the dots. Outrun the ghosts.",
    description:
      "Navigate the maze and gobble every pellet while four ghosts hunt you down. Grab a power pellet to turn the tables and chase them for big points. Clear the board to win.",
    category: "classic",
    controls: "Arrow keys or WASD",
    emoji: "🟡",
    accent: "#ffd83d",
  },
  {
    slug: "zombie-shooter",
    title: "Zombie Shooter",
    blurb: "Top-down survival against the horde.",
    description:
      "Move with WASD, aim with your mouse, and hold to fire. Zombies pour in from every edge in escalating waves. Keep moving, keep shooting, and survive as long as you can.",
    category: "action",
    controls: "WASD to move &middot; mouse to aim &middot; hold click to fire",
    emoji: "🧟",
    accent: "#5fb030",
  },
  {
    slug: "line-rider",
    title: "Line Rider",
    blurb: "Draw a track. Let gravity ride it.",
    description:
      "A sandbox classic. Draw lines to build ramps, hills, and loops, then release the sled and watch physics take over. Tweak your track, undo mistakes, and chase the perfect run.",
    category: "puzzle",
    controls: "Click and drag to draw &middot; RIDE to play",
    emoji: "✏️",
    accent: "#ff6b1a",
  },
  {
    slug: "tower-defense",
    title: "Tower Defense",
    blurb: "Build towers. Stop the breach.",
    description:
      "Enemies march along a winding path toward your exit. Spend gold to plant auto-firing towers on the grass, earn more from every kill, and call in each wave when you're ready. Hold the line for 20 lives.",
    category: "action",
    controls: "Click grass to build &middot; START WAVE to attack",
    emoji: "🏰",
    accent: "#5a8c5e",
  },
  {
    slug: "pong",
    title: "Pong",
    blurb: "The original. You vs the machine.",
    description:
      "The game that started it all. Slide your paddle to keep the ball in play and slip it past the AI. The ball speeds up with every rally. First to 7 takes it.",
    category: "arcade",
    controls: "Mouse or ↑/↓ (W/S) to move",
    emoji: "🏓",
    accent: "#7fd650",
  },
  {
    slug: "breakout",
    title: "Breakout",
    blurb: "Bounce, smash, clear the wall.",
    description:
      "Angle the ball off your paddle to chip away at a wall of colored bricks. Clear them all to advance to a faster level. Three lives — don't let the ball slip past you.",
    category: "arcade",
    controls: "Mouse or ← → &middot; click/SPACE to launch",
    emoji: "🧱",
    accent: "#ff6b1a",
  },
  {
    slug: "2048",
    title: "2048",
    blurb: "Slide tiles. Merge to 2048.",
    description:
      "Slide the grid in any direction and matching numbers merge into one. Every move spawns a new tile. Plan ahead, keep your big tiles cornered, and chase the elusive 2048 tile — then keep going.",
    category: "puzzle",
    controls: "Arrow keys / WASD or swipe",
    emoji: "🔢",
    accent: "#ffd060",
  },
  {
    slug: "minesweeper",
    title: "Minesweeper",
    blurb: "Read the numbers. Flag the mines.",
    description:
      "A 12×12 field hides 24 mines. Numbers tell you how many mines touch each tile — use them to deduce where it's safe. Flag the bombs, clear everything else, and beat your best time. First click is always safe.",
    category: "puzzle",
    controls: "Left-click reveal &middot; right-click flag",
    emoji: "💣",
    accent: "#5fc8e0",
  },
  {
    slug: "tetris",
    title: "Tetris",
    blurb: "Stack the blocks. Clear the lines.",
    description:
      "The falling-block classic. Rotate and slide the seven tetrominoes to pack complete rows, which clear for points. The drop speed climbs every ten lines. A ghost piece shows where you'll land.",
    category: "classic",
    controls: "← → move &middot; ↑ rotate &middot; SPACE hard drop",
    emoji: "🟦",
    accent: "#c45ed6",
  },
  {
    slug: "asteroids",
    title: "Asteroids",
    blurb: "Drift, rotate, blast the rocks.",
    description:
      "Pilot a wireframe ship through a field of tumbling asteroids. Thrust and rotate with momentum that never quite stops, and shoot rocks into smaller and smaller pieces. The screen wraps around every edge.",
    category: "arcade",
    controls: "← → rotate &middot; ↑ thrust &middot; SPACE shoot",
    emoji: "🪨",
    accent: "#b8a088",
  },
  {
    slug: "dino-runner",
    title: "Dino Run",
    blurb: "Jump the cacti. Duck the birds.",
    description:
      "The offline-browser legend. Sprint through an endless desert, leaping over cacti and ducking under birds as the pace relentlessly quickens. One tap to jump — how far can you get?",
    category: "arcade",
    controls: "SPACE / ↑ / tap to jump &middot; ↓ to duck",
    emoji: "🦖",
    accent: "#ff6b1a",
  },
  {
    slug: "simon",
    title: "Simon",
    blurb: "Watch, remember, repeat.",
    description:
      "The electronic memory game. Watch the pads light up in sequence, then repeat the pattern back. Each round tacks on one more step — and one more chance to forget. Sound on for the full effect.",
    category: "reflex",
    controls: "Click the pads in order",
    emoji: "🎵",
    accent: "#5fc8e0",
  },
  {
    slug: "frogger",
    title: "Frogger",
    blurb: "Dodge traffic. Ride the logs.",
    description:
      "Hop your frog across a busy road and a churning river to reach the safe homes at the top. Time your jumps between cars, ride floating logs without drowning, and fill all three lily pads to advance.",
    category: "classic",
    controls: "Arrow keys / WASD to hop",
    emoji: "🐸",
    accent: "#7fd650",
  },
  {
    slug: "connect-four",
    title: "Connect Four",
    blurb: "Four in a row beats the bot.",
    description:
      "Drop discs into the grid and line up four of your color — across, down, or diagonally — before the AI does. The computer blocks your threats and sets its own traps, so think a move ahead.",
    category: "puzzle",
    controls: "Click a column to drop",
    emoji: "🔴",
    accent: "#d63d3d",
  },
  {
    slug: "lights-out",
    title: "Lights Out",
    blurb: "Click to flip. Solve the dark.",
    description:
      "A classic mathematical puzzle on a 5×5 grid. Click any tile and it toggles itself plus its four orthogonal neighbors. Your goal: turn every single light off. Every board is procedurally generated by walking backward from the solved state, so every puzzle is guaranteed solvable — and every level adds more random presses, making the path harder to retrace. Beat a level and the next one unlocks automatically; your best level persists.",
    category: "puzzle",
    controls: "click tiles",
    emoji: "💡",
    accent: "#ffd060",
  },
  {
    slug: "hangman",
    title: "Hangman",
    blurb: "Guess letters. Save the stick man.",
    description:
      "Pick letters to uncover a hidden word from a list of arcade-flavored vocabulary (BEAVER, JOYSTICK, ASTEROID, DRAGON…). Each wrong guess draws another piece of the gallows — six misses and it's curtains for the stick figure. Build a winning streak across rounds; your best streak persists. Click letters or type them on the keyboard.",
    category: "classic",
    controls: "type or click letters",
    emoji: "🅰️",
    accent: "#b8a088",
  },
  {
    slug: "reversi",
    title: "Reversi",
    blurb: "Flank and flip. Most discs wins.",
    description:
      "The classic Othello strategy game on an 8×8 board. Place a black disc to flank a line of opponent whites between your pieces, and all the flanked discs flip to your color. The AI prioritizes corners (which can't be flipped once taken), avoids the dangerous squares next to empty corners, and otherwise picks moves that maximize flips. Legal moves are shown with dots so you can plan ahead. Whoever holds the most discs at the end wins.",
    category: "classic",
    controls: "click empty squares",
    emoji: "⚫",
    accent: "#f5e8d0",
  },
  {
    slug: "sokoban",
    title: "Sokoban",
    blurb: "Push crates. Never pull. Solve it.",
    description:
      "A beaver in a warehouse. Five hand-designed levels of crate-pushing logic puzzles — slide every crate onto a gold target tile to clear the room. The catch: you can only push, never pull, so a wrong shove can lock a crate against a wall forever. Undo (Z) and restart (R) are your friends. Arrow keys or WASD to move; touch controls on mobile. Your highest cleared level is saved.",
    category: "puzzle",
    controls: "arrows/WASD · Z undo · R restart",
    emoji: "📦",
    accent: "#a06820",
  },
  {
    slug: "lunar-lander",
    title: "Lunar Lander",
    blurb: "Burn fuel. Touch down. Don't die.",
    description:
      "The original physics game: a fragile spacecraft, lunar gravity, and a fuel gauge that doesn't lie. Rotate with left/right and burn the main engine with up or space — but every burn costs fuel, and the moment that tank hits zero you're just a falling rock. Land flat and slow on a green pad to score; bigger multipliers sit on smaller, harder-to-hit pads, with bonus points for the fuel you didn't burn. Crash on rough terrain or land too fast and it's over. Levels get tighter as you go.",
    category: "arcade",
    controls: "← → rotate · ↑/space thrust",
    emoji: "🚀",
    accent: "#c0c8d0",
  },
  {
    slug: "tron",
    title: "Tron",
    blurb: "Light cycles. Don't crash.",
    description:
      "You and the AI ride light cycles that leave permanent walls of light behind them. Crash into any trail — yours, the opponent's, or the arena walls — and you're out. The AI uses bounded flood-fill to estimate maneuvering room and picks the move that leaves it with the most space (with a slight bias toward cutting you off). Match speed ramps up each round. Pause with P. Best of as many rounds as you can survive.",
    category: "action",
    controls: "arrows/WASD · P pause",
    emoji: "🏎️",
    accent: "#5fc8e0",
  },
  {
    slug: "mini-golf",
    title: "Mini Golf",
    blurb: "Drag to aim. Sink in fewest strokes.",
    description:
      "Six top-down mini-golf holes with par ratings and brick walls to bank off. Drag away from the ball to aim — the direction and the length of the drag set the angle and power, with a colored dot warning you when you're winding up for a monster hit. Release to putt. Ball friction, wall bounces, and the rule that the hole only catches slow balls all behave the way you'd expect. Total under-par across the full course is the score that matters; your best round is saved.",
    category: "reflex",
    controls: "drag away from ball to aim",
    emoji: "⛳",
    accent: "#7fd650",
  },
  {
    slug: "sky-hop",
    title: "Sky Hop",
    blurb: "Auto-bounce. Steer. Climb forever.",
    description:
      "A vertical endless platformer. Your hopper auto-jumps the moment it lands; you only steer left and right (and wrap around the screen edges). The camera chases you upward as you climb, and platforms drift past below: yellow springs send you flying twice as high, blue ones slide back and forth, and red ones crumble the instant you touch them. The sky itself shifts from morning blue to deep midnight as you rise, with stars appearing at altitude. Fall off the bottom and it's over; height is your score.",
    category: "arcade",
    controls: "← →",
    emoji: "🐰",
    accent: "#ff8a3d",
  },
  {
    slug: "match-three",
    title: "Match Three",
    blurb: "Swap gems. Match three. Cascade.",
    description:
      "An 8×8 board of six colored gems. Click any two adjacent gems to swap them — if the swap creates a row or column of three or more matching gems, they pop, gems above fall to fill the gap, and brand-new gems drop in from the top. Cascading matches stack a multiplier that grows with each chain reaction in the same move, so setting up big cascades is where the high scores live. You get 25 moves; spend them well.",
    category: "puzzle",
    controls: "click two adjacent gems",
    emoji: "💎",
    accent: "#c45ed6",
  },
  {
    slug: "bubble-shooter",
    title: "Bubble Shooter",
    blurb: "Aim. Pop. Drop the cluster.",
    description:
      "A hex grid of colored bubbles hangs from the ceiling. Aim your cannon, shoot a bubble, and bank it off walls if you need to. When three or more same-color bubbles touch, the whole group pops — and any bubbles that were only held up by that group fall away too, racking up bonus points. The next color in the chamber is always drawn from what's still on the board, so you'll never be stuck firing a color that can't help you. Clear the screen to win; let bubbles cross the red line and it's over.",
    category: "arcade",
    controls: "mouse aim · click to shoot",
    emoji: "🫧",
    accent: "#5fc8e0",
  },
  {
    slug: "slide-puzzle",
    title: "Slide Puzzle",
    blurb: "Slide tiles. Restore the order.",
    description:
      "The classic 15-puzzle — and its 3×3 little sibling, and its 5×5 nightmare big brother. Tiles are shuffled with reverse-walking presses so every board is guaranteed solvable. Click an adjacent tile or use the arrow keys to slide it into the empty space, working toward 1-2-3-…-N in reading order. Your best moves+time for each size persists.",
    category: "puzzle",
    controls: "click adjacent tile · arrows",
    emoji: "🔢",
    accent: "#5fc8e0",
  },
  {
    slug: "mastermind",
    title: "Mastermind",
    blurb: "Crack the secret color code.",
    description:
      "There's a hidden 4-color code drawn from a palette of six. You get ten guesses. After each guess, black pegs mean you got the right color in the right slot; white pegs mean a right color in the wrong slot. Use the feedback to triangulate. Click a slot to clear it, click a color to place it, and lock in your guess when all four slots are filled.",
    category: "puzzle",
    controls: "click colors · click slots",
    emoji: "🎯",
    accent: "#c45ed6",
  },
  {
    slug: "word-search",
    title: "Word Search",
    blurb: "Find every word in the grid.",
    description:
      "A 12×12 grid stuffed with letters and a list of hidden words tied to one of five themes (Arcade, Animals, Space, Ocean, Fantasy). Words can run in any of the eight directions including diagonals and backwards. Click and drag across a straight line of letters to highlight it — if it spells one of the target words, it locks in green. Beat your best time per theme.",
    category: "classic",
    controls: "drag across letters",
    emoji: "🔠",
    accent: "#ffd060",
  },
  {
    slug: "battleship",
    title: "Battleship",
    blurb: "Hunt and sink the hidden fleet.",
    description:
      "Five ships of varying lengths — Carrier, Battleship, Cruiser, Submarine, Destroyer — are randomly hidden on a 10×10 grid. Click any square to fire. A red dot is a hit, an × is a miss. Track the ship list at the bottom to see which classes are sunk. Try to clear the whole fleet in as few shots as possible; your record persists.",
    category: "classic",
    controls: "click any square to fire",
    emoji: "⚓",
    accent: "#3a7ab8",
  },
  {
    slug: "stack-tower",
    title: "Stack Tower",
    blurb: "Time your tap. Stack to the sky.",
    description:
      "Blocks slide back and forth above your tower. Tap to drop one. Anything that doesn't overlap the block below gets trimmed off and falls away, so the tower steadily narrows with each miss — and when you finally miss everything, the whole thing topples. Land a near-perfect drop and you keep the full width and start racking up a perfect-streak bonus. The sky shifts to night as your tower climbs.",
    category: "reflex",
    controls: "click / tap / SPACE",
    emoji: "🗼",
    accent: "#ff8a3d",
  },
  {
    slug: "plinko",
    title: "Plinko",
    blurb: "Drop pucks. Pray for the edges.",
    description:
      "A triangular pegboard. Move the mouse to aim, click to drop a puck. Pegs deflect it on its way down to one of nine prize slots — the outer slots are huge multipliers (×25), the center is a bust. You start with 100 credits and pick a bet (1/5/10/25) per drop. Build your bankroll up; your highest credit count is saved. Go broke and you can reset.",
    category: "arcade",
    controls: "mouse aim · click to drop",
    emoji: "🎰",
    accent: "#c45ed6",
  },
  {
    slug: "air-hockey",
    title: "Air Hockey",
    blurb: "First to seven. No mercy.",
    description:
      "Top-down air hockey table. Move the mouse and your blue paddle tracks it instantly — but only in your own half. The puck has weight, friction, and inherits your paddle's velocity, so the faster you swing into it the harder it goes. The AI tracks the puck when it's in their half and drifts to center otherwise; they get a little smarter as you start winning. First to seven goals takes the match.",
    category: "arcade",
    controls: "mouse to move paddle",
    emoji: "🏒",
    accent: "#d63d3d",
  },
  {
    slug: "missile-command",
    title: "Missile Command",
    blurb: "Defend the cities. Detonate fast.",
    description:
      "Enemy missiles trail down from the sky toward your six cities and three batteries below. Click anywhere in the sky to detonate an interceptor blast — the closest battery with ammo fires, and anything caught in the expanding fireball is destroyed. Each wave throws more missiles, faster. End-of-wave bonuses for surviving cities and unused ammo. Lose all six cities and it's over.",
    category: "action",
    controls: "click sky to intercept",
    emoji: "🚀",
    accent: "#ff5050",
  },
  {
    slug: "centipede",
    title: "Centipede",
    blurb: "Shoot the bug. It splits in two.",
    description:
      "A segmented centipede zig-zags down through a field of mushrooms, descending one row every time it hits a wall or a mushroom. Shoot it — but here's the twist: shooting a middle segment doesn't kill the centipede, it splits it in two and each half grows a new head (worth 100 points). Mushrooms take four hits to destroy and a new one sprouts wherever a segment dies, so the field gets denser as the wave drags on. Three lives.",
    category: "arcade",
    controls: "arrows/WASD · SPACE fire",
    emoji: "🐛",
    accent: "#7fd650",
  },
  {
    slug: "pipes",
    title: "Pipes",
    blurb: "Route the flow before time runs out.",
    description:
      "A grid of randomly-oriented pipe segments and a setup timer. Click any non-fixed pipe to rotate it 90° and try to build a continuous route from the IN port to the OUT port. When the timer expires, water starts flowing from IN at one cell per beat and follows whatever connections you've made. Make it to OUT and you advance; leave a leak somewhere and the flow stops short. Higher levels give you less setup time.",
    category: "puzzle",
    controls: "click pipes to rotate",
    emoji: "🧩",
    accent: "#b8a088",
  },
];

export const categories: { id: GameCategory; label: string }[] = [
  { id: "action", label: "Action" },
  { id: "arcade", label: "Arcade" },
  { id: "puzzle", label: "Puzzle" },
  { id: "reflex", label: "Reflex" },
  { id: "classic", label: "Classic" },
];

export function getGame(slug: string): Game | undefined {
  return games.find((g) => g.slug === slug);
}

export function getFeaturedGame(): Game {
  return games.find((g) => g.featured) ?? games[0];
}

