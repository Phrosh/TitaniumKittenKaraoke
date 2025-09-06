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
function removeSongsPrefix() {
  console.log('Removing "songs/" prefix from file song URLs...');
  
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
    
    // Get all file songs with songs/ prefix
    db.all("SELECT id, youtube_url, mode FROM songs WHERE mode = 'file' AND youtube_url LIKE 'songs/%'", (err, rows) => {
      if (err) {
        console.error('Error querying songs:', err.message);
        db.close();
        return;
      }
      
      console.log(`Found ${rows.length} file songs with "songs/" prefix to fix`);
      
      if (rows.length === 0) {
        console.log('No "songs/" prefixes found. Migration complete.');
        db.close();
        return;
      }
      
      let migrated = 0;
      let errors = 0;
      
      // Process each song
      rows.forEach((song, index) => {
        try {
          // Remove 'songs/' prefix
          const filename = song.youtube_url.replace(/^songs\//, '');
          
          if (!filename) {
            console.error(`Could not extract filename from URL: ${song.youtube_url}`);
            errors++;
            return;
          }
          
          // Update the song with cleaned filename
          db.run(
            "UPDATE songs SET youtube_url = ? WHERE id = ?",
            [filename, song.id],
            function(err) {
              if (err) {
                console.error(`Error updating song ${song.id}:`, err.message);
                errors++;
              } else {
                console.log(`✓ Fixed song ${song.id}: ${song.youtube_url} → ${filename}`);
                migrated++;
              }
              
              // Check if this was the last song
              if (index === rows.length - 1) {
                console.log(`\nMigration complete!`);
                console.log(`✓ Successfully fixed: ${migrated} songs`);
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
removeSongsPrefix();
