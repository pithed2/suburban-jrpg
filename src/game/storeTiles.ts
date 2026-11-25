/** Frame numbers in the "store-tiles" sheet (public/assets-active/tilesets/store_16x16.png). */
export const STORE = {
  floor: 0,
  stripeFloor: 1,
  wallFace: 2,
  wallTop: 3,
  glassDoor: 4,
  mat: 5,
  /** Shelf unit per department: [top, bottom]. */
  shelf: {
    lumber: [6, 7],
    pipe: [8, 9],
    hardware: [10, 11],
    paint: [12, 13],
    tools: [14, 15],
    electrical: [16, 17],
  },
  counter: [18, 19, 20, 21, 22, 23],
  register: 24,
  cart: 25,
  pallet: 26,
} as const;
