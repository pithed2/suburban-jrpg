import Phaser from "phaser";

export function isNear(
  a: Phaser.Math.Vector2,
  b: Phaser.Math.Vector2,
  distance = 18,
): boolean {
  return Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) <= distance;
}

