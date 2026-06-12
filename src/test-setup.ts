// jsdom doesn't implement ImageData and Node.js running under Rosetta may not expose it.
// Provide a minimal shim matching the subset the engine code actually uses.
if (typeof globalThis.ImageData === 'undefined') {
  class ImageDataShim {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(data: Uint8ClampedArray, width: number, height?: number) {
      this.data = data;
      this.width = width;
      this.height = height ?? data.byteLength / 4 / width;
    }
  }
  globalThis.ImageData = ImageDataShim as unknown as typeof ImageData;
}
