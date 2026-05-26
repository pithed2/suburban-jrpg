import Phaser from "phaser";

export const spriteFrames = {
  dad: { texture: "dad-bob-idle", frame: 0 },
  wife: { texture: "wife-amelia-idle", frame: 0 },
  dustBunny: { texture: "sixteen-pixel", frame: 22 },
  heatingCoil: { texture: "sixteen-pixel", frame: 64 },
  dryer: { texture: "sixteen-pixel", frame: 63 },
  stairs: { texture: "sixteen-pixel", frame: 59 },
} as const;

export function addWorldSprite(
  scene: Phaser.Scene,
  x: number,
  y: number,
  sprite: { texture: string; frame: number },
  scale = 1,
): Phaser.GameObjects.Sprite {
  return scene.add.sprite(x, y, sprite.texture, sprite.frame)
    .setScale(scale)
    .setOrigin(0.5, 0.75);
}
