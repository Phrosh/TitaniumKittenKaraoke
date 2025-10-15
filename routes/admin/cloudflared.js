const express = require('express');
const router = express.Router();
const { spawn, exec } = require('child_process');
const db = require('../../config/database');

// Check if cloudflared is installed
router.get('/cloudflared/status', async (req, res) => {
  try {
    const isInstalled = await new Promise((resolve) => {
      exec('cloudflared --version', (error, stdout, stderr) => {
        if (error) {
          console.log('Cloudflared not installed:', error.message);
          resolve(false);
        } else {
          console.log('Cloudflared is installed:', stdout.trim());
          resolve(true);
        }
      });
    });

    res.json({ 
      installed: isInstalled,
      message: isInstalled ? 'Cloudflared ist installiert' : 'Cloudflared ist nicht installiert'
    });
  } catch (error) {
    console.error('Error checking cloudflared status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Install cloudflared using winget
router.post('/cloudflared/install', async (req, res) => {
  try {
    console.log('Installing cloudflared via winget...');
    
    const installProcess = spawn('winget', ['install', '-e', '--id', 'Cloudflare.cloudflared'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    installProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log('Winget output:', data.toString());
    });

    installProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.log('Winget error:', data.toString());
    });

    installProcess.on('close', (code) => {
      console.log(`Winget install process exited with code ${code}`);
      
      if (code === 0) {
        res.json({ 
          success: true,
          message: 'Cloudflared erfolgreich installiert',
          output: output
        });
      } else {
        res.status(500).json({ 
          success: false,
          message: 'Fehler beim Installieren von Cloudflared',
          error: errorOutput,
          output: output
        });
      }
    });

    installProcess.on('error', (error) => {
      console.error('Error starting winget install:', error);
      res.status(500).json({ 
        success: false,
        message: 'Fehler beim Starten der Installation',
        error: error.message
      });
    });

  } catch (error) {
    console.error('Error installing cloudflared:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Start cloudflared tunnel
router.post('/cloudflared/start', async (req, res) => {
  try {
    console.log('Starting cloudflared tunnel...');
    
    const tunnelProcess = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:5000'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true // Allow process to continue after response
    });

    let tunnelUrl = null;
    let output = '';
    let errorOutput = '';
    let urlFound = false;

    // Set timeout to prevent hanging
    const timeout = setTimeout(() => {
      if (tunnelProcess && !tunnelProcess.killed && !urlFound) {
        tunnelProcess.kill();
        console.log('Cloudflared tunnel process killed due to timeout');
      }
    }, 30000); // 30 seconds timeout

    tunnelProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      output += dataStr;
      console.log('Cloudflared output:', dataStr);
      
      // Parse the tunnel URL from output
      const urlMatch = dataStr.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (urlMatch && !tunnelUrl) {
        tunnelUrl = urlMatch[0];
        urlFound = true;
        console.log('Tunnel URL found:', tunnelUrl);
        
        // Clear timeout since we got the URL
        clearTimeout(timeout);
        
        // Save the tunnel URL to database and respond
        new Promise((resolve, reject) => {
          db.run(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            ['custom_url', tunnelUrl],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        }).then(async () => {
          console.log('Tunnel URL saved to database:', tunnelUrl);
          
          // Generate new QR code with tunnel URL
          const { generateQRCodeDataUrl } = require('../../utils/qrCodeGenerator');
          const qrUrl = tunnelUrl + '/new';
          const qrCodeDataUrl = await generateQRCodeDataUrl(tunnelUrl, tunnelUrl);

          // Broadcast QR code update via WebSocket
          const io = req.app.get('io');
          if (io) {
            io.emit('qr-code-update', {
              qrCodeDataUrl: qrCodeDataUrl,
              qrUrl: qrUrl,
              timestamp: new Date().toISOString()
            });
          }
          
          // Don't kill the process - let it continue running
          // The tunnel needs to stay active to remain accessible
        }).catch((dbError) => {
          console.error('Error saving tunnel URL to database:', dbError);
        });
      }
    });

    tunnelProcess.stderr.on('data', (data) => {
      const dataStr = data.toString();
      errorOutput += dataStr;
      console.log('Cloudflared error:', dataStr);
      
      // Also check stderr for the URL
      const urlMatch = dataStr.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (urlMatch && !tunnelUrl) {
        tunnelUrl = urlMatch[0];
        urlFound = true;
        console.log('Tunnel URL found in stderr:', tunnelUrl);
        
        // Clear timeout since we got the URL
        clearTimeout(timeout);
        
        // Save the tunnel URL to database and respond
        new Promise((resolve, reject) => {
          db.run(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            ['custom_url', tunnelUrl],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        }).then(async () => {
          console.log('Tunnel URL saved to database:', tunnelUrl);
          
          // Generate new QR code with tunnel URL
          const { generateQRCodeDataUrl } = require('../../utils/qrCodeGenerator');
          const qrUrl = tunnelUrl + '/new';
          const qrCodeDataUrl = await generateQRCodeDataUrl(tunnelUrl, tunnelUrl);

          // Broadcast QR code update via WebSocket
          const io = req.app.get('io');
          if (io) {
            io.emit('qr-code-update', {
              qrCodeDataUrl: qrCodeDataUrl,
              qrUrl: qrUrl,
              timestamp: new Date().toISOString()
            });
          }
          
          // Don't kill the process - let it continue running
          // The tunnel needs to stay active to remain accessible
        }).catch((dbError) => {
          console.error('Error saving tunnel URL to database:', dbError);
        });
      }
    });

    // Wait for URL to be found, then respond
    const checkForUrl = setInterval(() => {
      if (urlFound && tunnelUrl) {
        clearInterval(checkForUrl);
        res.json({ 
          success: true,
          message: 'Cloudflared Tunnel erfolgreich gestartet und läuft weiter',
          tunnelUrl: tunnelUrl,
          output: output,
          note: 'Der Tunnel läuft weiter im Hintergrund. Die URL bleibt erreichbar.'
        });
      }
    }, 1000);

    // If no URL found after timeout, respond with error
    setTimeout(() => {
      if (!urlFound) {
        clearInterval(checkForUrl);
        clearTimeout(timeout);
        if (tunnelProcess && !tunnelProcess.killed) {
          tunnelProcess.kill();
        }
        res.status(500).json({ 
          success: false,
          message: 'Cloudflared Tunnel gestartet, aber URL konnte nicht ermittelt werden',
          error: errorOutput,
          output: output
        });
      }
    }, 30000);

    tunnelProcess.on('error', (error) => {
      clearTimeout(timeout);
      clearInterval(checkForUrl);
      console.error('Error starting cloudflared tunnel:', error);
      res.status(500).json({ 
        success: false,
        message: 'Fehler beim Starten des Cloudflared Tunnels',
        error: error.message
      });
    });

  } catch (error) {
    console.error('Error starting cloudflared tunnel:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Stop cloudflared tunnel
router.post('/cloudflared/stop', async (req, res) => {
  try {
    console.log('Stopping cloudflared tunnel...');
    
    // Kill all cloudflared processes
    exec('taskkill /F /IM cloudflared.exe', (error, stdout, stderr) => {
      if (error) {
        console.log('No cloudflared processes found or error killing:', error.message);
        res.json({ 
          success: true,
          message: 'Keine laufenden Cloudflared-Prozesse gefunden oder bereits gestoppt'
        });
      } else {
        console.log('Cloudflared processes killed:', stdout);
        res.json({ 
          success: true,
          message: 'Cloudflared Tunnel erfolgreich gestoppt',
          output: stdout
        });
      }
    });

  } catch (error) {
    console.error('Error stopping cloudflared tunnel:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
