# Central Video Modes Configuration

This documentation describes the new central configuration for video modes and their priority in the Karaoke system.

## Overview

The central configuration is located in `config/videoModes.js` and allows managing all video modes and their priority in one place.

## Available Video Modes

### 1. **file** (Priority: 1)
- **Description**: Local files from configured folder
- **Configuration required**: Yes (`file_songs_folder`)
- **Usage**: Direct file playback via separate port

### 2. **server_video** (Priority: 2)
- **Description**: Local videos from `songs/videos/` folder
- **Configuration required**: No
- **Usage**: Server-side video serving

### 3. **ultrastar** (Priority: 3)
- **Description**: Ultrastar songs with integrated videos
- **Configuration required**: No
- **Usage**: Videos from `songs/ultrastar/` folder

### 4. **magic-songs** (Priority: 4)
- **Description**: AI-generated songs with audio
- **Configuration required**: No
- **Usage**: Magic Songs from `songs/magic-songs/` folder

### 5. **magic-videos** (Priority: 5)
- **Description**: AI-generated videos
- **Configuration required**: No
- **Usage**: Magic Videos from `songs/magic-videos/` folder

### 6. **magic-youtube** (Priority: 6)
- **Description**: AI-processed YouTube videos
- **Configuration required**: No
- **Usage**: Magic YouTube Videos from `songs/magic-youtube/` folder

### 7. **youtube_cache** (Priority: 7)
- **Description**: Locally stored YouTube videos
- **Configuration required**: No
- **Usage**: Cached YouTube videos from `songs/youtube/` folder

### 8. **youtube** (Priority: 8)
- **Description**: Direct YouTube embedding (Fallback)
- **Configuration required**: No
- **Usage**: Fallback for unavailable local content

## API Endpoints

### Get Video Modes
```
GET /api/admin/video-modes
```

### Get Specific Mode
```
GET /api/admin/video-modes/:modeId
```

### Update Priority
```
PUT /api/admin/video-modes/:modeId/priority
Content-Type: application/json

{
  "priority": 2
}
```

### Enable/Disable Mode
```
PUT /api/admin/video-modes/:modeId/enabled
Content-Type: application/json

{
  "enabled": false
}
```

### Reset Configuration
```
POST /api/admin/video-modes/reset
```

## Usage in Application

### Using Central Function
```javascript
const { findBestVideoMode } = require('./config/videoModes');

// Find the best available video mode
const result = await findBestVideoMode(artist, title, youtubeUrl, req);
console.log(`Found mode: ${result.mode}`);
console.log(`URL: ${result.url}`);
```

### Managing Modes
```javascript
const { 
  getAllModes, 
  getMode, 
  updateModePriority, 
  setModeEnabled 
} = require('./config/videoModes');

// Get all modes
const modes = getAllModes();

// Get specific mode
const fileMode = getMode('file');

// Change priority
updateModePriority('magic-songs', 2);

// Disable mode
setModeEnabled('youtube', false);
```

## Benefits of Central Configuration

1. **Consistency**: All parts of the application use the same priority order
2. **Maintainability**: Changes only need to be made in one place
3. **Flexibility**: Modes can be easily enabled/disabled or reprioritized
4. **Extensibility**: New modes can be easily added
5. **Debugging**: Central logging functionality for better tracking

## Migration from Old Implementation

The old, distributed logic was replaced by the central configuration in:
- `routes/songs.js` - Song request processing
- `routes/admin.js` - Admin functions and song tests
- `utils/websocketService.js` - WebSocket updates
- `routes/show.js` - Show view updates

## Customizing Configuration

To change the priority or availability of modes, you can:

1. **Via API**: Use the provided admin endpoints
2. **Directly in code**: Edit `config/videoModes.js`
3. **At runtime**: Use the export functions

## Example: Adding New Mode

```javascript
// In config/videoModes.js
const VIDEO_MODES = [
  // ... existing modes ...
  {
    id: 'custom-mode',
    name: 'Custom Mode',
    description: 'User-defined mode',
    priority: 9,
    enabled: true,
    requiresConfig: false,
    finder: async (artist, title) => {
      // Your search logic here
      return customFinder(artist, title);
    },
    urlBuilder: (foundItem) => {
      return `/api/custom/${encodeURIComponent(foundItem.id)}`;
    }
  }
];
```

The central configuration makes the system more flexible and maintainable while ensuring consistency of video mode priority throughout the entire system.
