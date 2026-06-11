// Game lives in ./base-command/ — this file just re-exports it so the
// play route's import path ("@/app/games/TankShooter") keeps working.
export { default } from "./base-command";
