import Phaser from "phaser";

export function loadAudioOnce(scene: Phaser.Scene, key: string, url: string): void {
  if (scene.cache.audio.exists(key)) return;
  scene.load.audio(key, url);
}
