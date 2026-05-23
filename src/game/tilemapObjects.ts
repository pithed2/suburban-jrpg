import Phaser from "phaser";

export function getMapObjectCenter(
  map: Phaser.Tilemaps.Tilemap,
  layerName: string,
  objectName: string,
): Phaser.Math.Vector2 {
  const object = map.getObjectLayer(layerName)?.objects.find((candidate) => candidate.name === objectName);

  if (!object) {
    throw new Error(`Missing map object: ${layerName}/${objectName}`);
  }

  return new Phaser.Math.Vector2(
    (object.x ?? 0) + (object.width ?? 0) / 2,
    (object.y ?? 0) + (object.height ?? 0) / 2,
  );
}
