const path = require('path');

const IMAGE_EXTENSIONS = ['.webp', '.jpg', '.jpeg', '.png', '.gif', '.bmp'];
const COVER_WEBP = 'cover.webp';
const COVER_THUMB_WEBP = 'cover.thumb.webp';

function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

function isThumbnailFile(filename) {
  return filename.toLowerCase().includes('.thumb.');
}

function findBackgroundImageFile(files) {
  const images = files.filter((file) => isImageFile(file) && !isThumbnailFile(file));
  if (images.includes(COVER_WEBP)) {
    return COVER_WEBP;
  }

  const coverFile = images.find((file) => {
    const base = path.basename(file, path.extname(file)).toLowerCase();
    return base === 'cover';
  });
  if (coverFile) {
    return coverFile;
  }

  return images[0] || null;
}

function getThumbnailFilename(fullFilename) {
  if (fullFilename === COVER_WEBP) {
    return COVER_THUMB_WEBP;
  }

  const ext = path.extname(fullFilename);
  const base = path.basename(fullFilename, ext);
  return `${base}.thumb.webp`;
}

function buildImageApiUrl(apiSongType, folderName, filename) {
  return `/api/video/${apiSongType}/${encodeURIComponent(folderName)}/${encodeURIComponent(filename)}`;
}

function getSongImageInfo(files, apiSongType, folderName) {
  const imageFile = findBackgroundImageFile(files);
  if (!imageFile) {
    return {
      hasCover: false,
      coverUrl: null,
      coverThumbUrl: null,
    };
  }

  const coverUrl = buildImageApiUrl(apiSongType, folderName, imageFile);
  const thumbFile = getThumbnailFilename(imageFile);
  const coverThumbUrl = files.includes(thumbFile)
    ? buildImageApiUrl(apiSongType, folderName, thumbFile)
    : coverUrl;

  return {
    hasCover: true,
    coverUrl,
    coverThumbUrl,
    coverFile: imageFile,
    coverThumbFile: files.includes(thumbFile) ? thumbFile : null,
  };
}

function listImageFiles(files) {
  return files.filter((file) => isImageFile(file));
}

module.exports = {
  IMAGE_EXTENSIONS,
  COVER_WEBP,
  COVER_THUMB_WEBP,
  isImageFile,
  isThumbnailFile,
  findBackgroundImageFile,
  getThumbnailFilename,
  buildImageApiUrl,
  getSongImageInfo,
  listImageFiles,
};
