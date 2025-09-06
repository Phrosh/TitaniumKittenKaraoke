const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, '../karaoke.db');

// Check if database exists
const fs = require('fs');
if (!fs.existsSync(dbPath)) {
  console.log('Database does not exist yet. No migration needed.');
  process.exit(0);
}

// Open database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

// Migration function
function migrateFileSongs() {
  console.log('Starting migration of file:// URLs to filenames...');
  
  // First check if songs table exists
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='songs'", (err, row) => {
    if (err) {
      console.error('Error checking for songs table:', err.message);
      db.close();
      return;
    }
    
    if (!row) {
      console.log('Songs table does not exist yet. No migration needed.');
      db.close();
      return;
    }
    
    // Get all songs with file:// URLs
    db.all("SELECT id, youtube_url, mode FROM songs WHERE youtube_url LIKE 'file://%'", (err, rows) => {
      if (err) {
        console.error('Error querying songs:', err.message);
        db.close();
        return;
      }
    
    console.log(`Found ${rows.length} songs with file:// URLs to migrate`);
    
    if (rows.length === 0) {
      console.log('No file:// URLs found. Migration complete.');
      db.close();
      return;
    }
    
    let migrated = 0;
    let errors = 0;
    
    // Process each song
    rows.forEach((song, index) => {
      try {
        // Extract filename from file:// URL
        const url = song.youtube_url;
        // Handle both Windows (file://c:\path\file.mp4) and Unix (file:///path/file.mp4) formats
        let filename;
        if (url.includes('\\')) {
          // Windows format: file://c:\path\file.mp4
          filename = url.replace(/^file:\/\/[^\\]+\\/, '').replace(/\\/g, '/');
        } else {
          // Unix format: file:///path/file.mp4
          filename = url.replace(/^file:\/\/+/, '').replace(/^\//, '');
        }
        
        // Remove 'songs/' prefix if present
        filename = filename.replace(/^songs\//, '');
        
        if (!filename) {
          console.error(`Could not extract filename from URL: ${url}`);
          errors++;
          return;
        }
        
        // Update the song with just the filename
        db.run(
          "UPDATE songs SET youtube_url = ? WHERE id = ?",
          [filename, song.id],
          function(err) {
            if (err) {
              console.error(`Error updating song ${song.id}:`, err.message);
              errors++;
            } else {
              console.log(`✓ Migrated song ${song.id}: ${url} → ${filename}`);
              migrated++;
            }
            
            // Check if this was the last song
            if (index === rows.length - 1) {
              console.log(`\nMigration complete!`);
              console.log(`✓ Successfully migrated: ${migrated} songs`);
              if (errors > 0) {
                console.log(`✗ Errors: ${errors} songs`);
              }
              db.close();
            }
          }
        );
        
      } catch (error) {
        console.error(`Error processing song ${song.id}:`, error.message);
        errors++;
      }
    });
    });
  });
}

// Run migration
migrateFileSongs();
