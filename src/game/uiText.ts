import Phaser from "phaser";

function formatPixelText(value: unknown): string {
  return String(value ?? "").toUpperCase();
}

export function addPixelText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 6,
): Phaser.GameObjects.BitmapText {
  const readableSize = Math.max(Math.round(size / 6) * 6, 6);

  return scene.add
    .bitmapText(x, y, "dialogue-8x8", formatPixelText(text), readableSize)
    .setTint(0xf8fafc);
}

export function setPixelText(
  textObject: Phaser.GameObjects.BitmapText,
  value: string,
): void {
  textObject.setText(formatPixelText(value));
}
