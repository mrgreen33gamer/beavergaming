/**
 * Shared shed-part bus. Any vehicle (the player car, a smashed junk car) emits
 * detached parts through here; the DebrisManager renders and recycles them.
 * Keeps debris in one place instead of every component owning its own pool.
 */
export interface DebrisSpawn {
  model: string;
  pos: [number, number, number];
  vel: [number, number, number];
}

export interface DebrisBus {
  spawn: ((d: DebrisSpawn) => void) | null;
  emit(model: string, pos: [number, number, number], vel: [number, number, number]): void;
}

export const debrisBus: DebrisBus = {
  spawn: null,
  emit(model, pos, vel) {
    this.spawn?.({ model, pos, vel });
  },
};
