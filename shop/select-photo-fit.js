const photoSelector = ".select-square-frame > img[data-square-photo]";
const fillSize = 64;

function updatePhotoFill(image) {
  if (!image.matches?.(photoSelector) || !image.complete) return;

  const frame = image.parentElement;
  const existing = frame.querySelector(":scope > .select-photo-fill");
  const { naturalWidth: width, naturalHeight: height } = image;
  if (!width || !height || width === height) {
    existing?.remove();
    return;
  }

  const fill = existing || document.createElement("canvas");
  if (!existing) {
    fill.className = "select-photo-fill";
    fill.setAttribute("aria-hidden", "true");
    fill.width = fillSize;
    fill.height = fillSize;
  }

  const context = fill.getContext("2d");
  if (!context) return;

  // Use the edges next to the extra space, without enlarging a second copy of the product.
  const strip = Math.max(1, Math.round(Math.min(width, height) * 0.08));
  const half = fillSize / 2;
  context.clearRect(0, 0, fillSize, fillSize);
  try {
    if (width < height) {
      context.drawImage(image, 0, 0, strip, height, 0, 0, half, fillSize);
      context.drawImage(image, width - strip, 0, strip, height, half, 0, half, fillSize);
    } else {
      context.drawImage(image, 0, 0, width, strip, 0, 0, fillSize, half);
      context.drawImage(image, 0, height - strip, width, strip, 0, half, fillSize, half);
    }
  } catch {
    fill.remove();
    return;
  }
  if (!existing) frame.prepend(fill);
}

for (const event of ["load", "error"]) {
  document.addEventListener(event, ({ target }) => updatePhotoFill(target), true);
}
document.querySelectorAll(photoSelector).forEach(updatePhotoFill);
