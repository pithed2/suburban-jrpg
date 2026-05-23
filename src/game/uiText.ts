import Phaser from "phaser";

export function addPixelText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 8,
): Phaser.GameObjects.Text {
  const readableSize = Math.max(size, 8);

  return scene.add.text(x, y, text, {
    color: "#f8fafc",
    fontFamily: "monospace",
    fontSize: `${readableSize}px`,
  });
}

export function setPixelText(
  textObject: Phaser.GameObjects.Text,
  value: string,
): void {
  textObject.setText(value);
}
