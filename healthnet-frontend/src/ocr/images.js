// Draws a photo onto a canvas, scaled down so its longest side is at most maxSide pixels
export const imageCanvas = async (file, maxSide = 2000) => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas;
};

// The same photo as a JPEG blob: smaller to send, and a format every vision API accepts (unlike HEIC)
export const imageAsJpeg = async (file, maxSide = 2000) => {
  const canvas = await imageCanvas(file, maxSide);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not convert the image'))), 'image/jpeg', 0.9);
  });
};
