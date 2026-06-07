const sharp = require('sharp');
const { COVER_WEBP, COVER_THUMB_WEBP } = require('./imageFiles');

const FULL_MAX_PX = 1920;
const THUMB_MAX_PX = 256;
const FULL_WEBP_QUALITY = 85;
const THUMB_WEBP_QUALITY = 75;

async function processUploadedImage(buffer) {
  const rotated = sharp(buffer).rotate();

  const full = await rotated
    .clone()
    .resize(FULL_MAX_PX, FULL_MAX_PX, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: FULL_WEBP_QUALITY })
    .toBuffer();

  const thumb = await rotated
    .clone()
    .resize(THUMB_MAX_PX, THUMB_MAX_PX, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: THUMB_WEBP_QUALITY })
    .toBuffer();

  return {
    full,
    thumb,
    fullFilename: COVER_WEBP,
    thumbFilename: COVER_THUMB_WEBP,
  };
}

module.exports = {
  processUploadedImage,
  FULL_MAX_PX,
  THUMB_MAX_PX,
};
