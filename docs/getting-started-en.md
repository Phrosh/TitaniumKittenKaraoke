# Getting Started with Titanium Kitten Karaoke

Welcome to Titanium Kitten Karaoke! This guide will walk you through the complete setup process, from installing dependencies to running your first karaoke session.

The installation is only needed for the server. Once it is up and running, you can access the whole thing via your browser. Because of this, you can access Titanium Kitten even with your wooden legacy laptop from your grandma, as long as it can run a modern internet browser.

## 📋 Prerequisites (Server)

Before you begin, ensure you have the following installed on your system:

### Required Software

#### 1. Node.js (Version 18 or higher)
- **Download**: [Node.js Official Website](https://nodejs.org/)
- **Verification**: Run `node --version` in terminal
- **Note**: npm comes bundled with Node.js

#### 2. Python 3.10 or higher
- **Download**: [Python Official Website](https://www.python.org/downloads/)
- **Verification**: Run `python --version` in terminal
- **Important**: Make sure to check "Add Python to PATH" during installation

#### 3. FFmpeg (Essential for audio/video processing)
- **Windows**: 
  - Download from [FFmpeg Downloads](https://ffmpeg.org/download.html)
  - Extract to a folder (e.g., `C:\ffmpeg`)
  - Add `bin` folder to your PATH environment variable
  - **Step-by-step PATH setup**:
    1. Press `Win + R`, type `sysdm.cpl`, press Enter
    2. Click "Environment Variables..."
    3. Under "System variables", select `Path` and click "Edit"
    4. Click "New" and add your FFmpeg bin path (e.g., `C:\ffmpeg\bin`)
    5. Click "OK" on all dialogs
    6. Restart your terminal/IDE
- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt-get install ffmpeg` (Ubuntu/Debian) or use your distribution's package manager
- **Verification**: Run `ffmpeg -version` in terminal

#### 4. CUDA (Optional but recommended for AI features)
- **Download**: [NVIDIA CUDA Toolkit](https://developer.nvidia.com/cuda-downloads)
- **Note**: Only required if you want hardware acceleration for AI-powered features
- **Alternative**: CPU-only mode works but is slower

### System Requirements

- **Network**: Stable internet connection
- **Ports**: Ensure ports 3000, 5000, 6000, and 4000 are available

## 🚀 Installation

1. **Clone or download** the repository
2. **Run the installation script**:
   ```bash
   # Windows
   install.bat
   
   # Linux/macOS
   chmod +x install.sh
   ./install.sh
   ```

The script will automatically:
- Install Node.js dependencies
- Install Python dependencies
- Set up the virtual environment
- Configure the project

## 🎮 Running the Application (Server)

### Start the Complete System

```bash
# Windows
start.bat

# Linux/macOS
./start.sh
```

## File Management
The biggest strength of Titanium Kitten is the seamless integration of various sources for your karaoke songs. Whether you play karaoke videos from your hard drive or take YouTube songs, it doesn't matter in the end.
For Titanium Kitten to recognize your files, you need to put them in the following folders:

- `songs/videos`: Already finished karaoke videos
- `songs/ultrastar`: Files for the Singstar clone "Ultrastar". These usually include a text file, an audio file and often also a video
- `songs/magic-songs`: Normal audio files. TKK should create a karaoke version from these. Videos or images can optionally be added.
- `songs/magic-videos`: Normal video files. TKK should create a karaoke version from these.

Songs in the `videos` folder must be in the format `Artist - Song Title.mp4`. Songs in other folders must be in a subfolder with the format `Artist - Song Title`.

### Example 1
The karaoke video for "The Quiet Place" by In Flames is then here:
- `songs/videos/In Flames - The Quiet Place.mp4`.

### Example 2
The files for the song "Mirror Mirror" by Blind Guardian would look like this:
- `songs/ultrastar/Blind Guardian - Mirror Mirror/Blind Guardian - Mirror Mirror.txt`
- `songs/ultrastar/Blind Guardian - Mirror Mirror/Blind Guardian - Mirror Mirror.mp4`
- `songs/ultrastar/Blind Guardian - Mirror Mirror/Blind Guardian - Mirror Mirror.mp3`

The naming of individual files in the subfolders doesn't matter.

**Note**: The files are then on the **server**, i.e. you usually don't take them with you to your karaoke session - unless you take the server with you. These files are all loaded over the internet when you organize a karaoke session.

You can also include videos from your laptop (client) in the song list. More on this later.

## What is Ultrastar?
Ultrastar is a well-known Singstar clone for PC with a still active community. Here, clever users can create songs with lyrics timing and sung notes for popular songs and make them available to other users. One of the best-known sites that offers these files is [USDB](https://usdb.animux.de). Titanium Kitten can read these files and interpret them accordingly as karaoke songs.

Ultrastar files usually have the best karaoke quality of all. The text was recognized by humans and Titanium Kitten creates the instrumental version itself.

Titanium Kitten also offers the possibility to search for these Ultrastar files directly and download them as finished karaoke songs. More on this later under the **USDB** section.

## First Use
After you have started the server as described above with `start.bat`, you can go to the **Admin Dashboard**. Visit `localhost:5000/admin` in your browser.

After you have created an admin user, log in with the user data and enter the admin menu. You should familiarize yourself with this, as it will be what you use to operate everything in the background during a karaoke session.

Of course, you should look at all tabs in the admin dashboard once, but let's first go to **Settings**. In addition to various ways to give your karaoke session a personal touch, one section is particularly important: **Cloudflared**.

Cloudflared is a service from Cloudflare that allows you to forward Titanium Kitten over the internet from your PC in front of you (server) to your laptop for the karaoke session on the go.
To set up this service once, press the `Setup Cloudflared` button. You only need to do this once, then the service is set up.

Press the `Start Cloudflared` button every time before you start a karaoke session and want to use Titanium Kitten outside your four walls. Note the internet address that appears under "Own URL". You will enter this later in your browser window on another computer to use Titanium Kitten. Just as you came to the admin dashboard via `localhost:5000/admin`, you can now access it via the internet using `https://[this-own-url]/admin`. From now on you can choose whether you want to continue using this PC (server) or another one (client) for Titanium Kitten. You must perform this step **every time** before you start a karaoke session, because the "Own URL" changes over time.

Do you have karaoke videos that you want to take with you to your karaoke session and that are not on the server? Then scroll down to "Local Song Folder". Here you specify the folder path of these songs.
Then you have to (this time on the PC you take to karaoke) start a local web server for the videos. Don't worry, it's very simple. You just copy the command that is at the bottom, paste it into a console window and press Enter. Then click the `Rescan` button. Then songs that are in this folder will also be included in the karaoke list.

## The First Live Session
So now you have the server running at home, you're on the go and have opened your laptop. Here you ideally have two screens: one for you and your admin dashboard and one for the karaoke participants, on which the current karaoke lyrics are displayed. Usually the admin screen is your laptop and the karaoke screen is a large monitor or directly a projector image.

**Pro tip**: Use both a large monitor **and** a projector as karaoke screen. The output image here should be duplicated. This way you can provide both the current singers and the audience with a karaoke image.

On your admin screen you then open the **Admin Panel**, as in the previous step via `https://[this-own-url]/admin`. On the karaoke screen you open a second browser window with the URL `https://[this-own-url]/show`. Before you can use it, you have to click the big start button once.

**Pro tip**: To get the best out of your screen, it is recommended to run the browser in full screen. Press the small button at the top right for this.

Great! Your karaoke session can begin.

When people scan the QR code, they can submit song requests that appear in the **Playlist** tab in your admin dashboard. You have several buttons above the playlist to control the songs. You can also always select and play a song directly. You can also rearrange songs by simply dragging them with the mouse. If candidates don't want to enter their song request themselves via the QR code, you can also do this manually via the **Add Song** button.

## A Typical Workflow
When candidates add their song requests, this entry appears in the playlist. If it's a song that's not in your song list, you need to act. The song suggestion appears in your playlist with a huge button and you can do one of these things:
1. You give the song a YouTube link to a karaoke video on YouTube. Go to YouTube in another tab and copy the address of the video.
2. Someone has already created an Ultrastar file for this song and uploaded it to USDB. If you have entered your USDB access data under **Settings**, you can also search for it. This also works in the window for YouTube links.
3. There is no karaoke version of the song yet. Then search for the song on YouTube as a non-karaoke version and copy the link. Specify in the window that it is not a karaoke song and Titanium Kitten should make a karaoke song from it.

Everything else happens in the background. As soon as a song is finished downloading and processing, it can be sung like any other song.

**Tip**: Keep your song entries clean. Not every participant sticks to the "Artist - Song Name" rule. Often artists or song names are misspelled. I recommend that you revise every misspelled song entry once. This makes sense especially in combination with caching, which I will briefly explain in the next section.

## Caching
Titanium Kitten Karaoke has so-called caching. This means that YouTube videos are stored on the server instead of being played directly from YouTube. Songs that have been sung once don't have to be searched for again if they are sung again. But for these to be assigned correctly, the artist and song title must match. If you e.g. have the song "Abba - Mama Mia" in the cache (because you previously entered the karaoke video YouTube link for a song suggestion with artist "Abba" and song name "Mama Mia") and later a participant wants to sing the same song, but makes a typo and enters "Aba" instead of "Abba", the song will not be recognized as already sung. You have to change the new song to "Abba", then the recognition works automatically again.
It gets tricky, of course, when the first song was already misspelled, because then it searches for the correct song name, but only the wrong one exists. Therefore: Before entering the YouTube link, check if everything is spelled correctly.

But don't worry. Even if you should forget this once, you can solve it afterwards, as described in the following section.

## Song Management
In the "Song Management" tab you have an overview of all songs in the cache. This includes YouTube videos, but also Ultrastar files, video files on the server and all others.

You can decide for yourself which songs from this appear in the song list for participants, or whether they should only be stored in the cache for faster loading. If a song was saved under the wrong name, you can rename it here. You can also start processing for Magic Songs and Ultrastar Songs that you didn't download via Titanium Kitten.

So if you want to include a YouTube song that has been sung once in the song list for your participants, you can search for it here and activate it with one click. The same applies to automatically downloaded Ultrastar files from USDB.

You can test songs directly. If you test a song, it will be played as a test song on the karaoke screen. For Ultrastar songs you can additionally specify whether participants should have the option to activate backing vocals for individual songs. Not every song works as well with backing vocals as without - therefore it is advisable to test each version once when a song offers this option.

Ultrastar songs, Magic Songs and Magic Videos must be processed beforehand before you can use them. Each song that needs processing has a button for this. Exception are Ultrastar songs that Titanium Kitten downloaded itself via USDB. These are automatically processed after downloading and you only need to activate them so that they appear in the song list.

## USDB
Another big chapter in Titanium Kitten Karaoke is the integration of USDB. As mentioned at the beginning, [USDB](https://usdb.animux.de) is a well-known site for Ultrastar files. You have the possibility to search this Ultrastar database directly via song management and include songs from it in your song list. After you have created a free account on the [USDB website](https://usdb.animux.de), you first enter your access data in **Settings**. Then you can simply search for songs via the button in song management and download them. After downloading, these automatically appear in the song list.

If your USDB access data is entered, Titanium Kitten Karaoke offers another feature that works for you in the background. When a song suggestion is submitted, but the song is not yet in the cache, USDB is searched in the background after submitting the song suggestion. If Titanium Kitten finds the song, it will be downloaded in the background and you can completely save yourself the manual search for the Ultrastar file or a YouTube link. And: because you now work with the Ultrastar file, you automatically have the best quality karaoke material.

## After the Karaoke Session
A lot happened during a karaoke session. Every song that was sung ended up in the cache. Ultrastar songs were downloaded in the background via USDB. All songs that you don't download manually, but are automatically downloaded in the background, end up in the cache, but not automatically in the song list.

Therefore it is recommended to go through the song list in song management once after a karaoke session and check if everything is still correct:
- Are all artists and song names spelled correctly?
- Do you want to include cached songs in the song list for participants for the next karaoke session?
- Do all new Ultrastar songs work both with and without backing vocals?

Since a lot happens automatically in Titanium Kitten, post-processing is recommended for professional karaoke.

## Conclusion
That's it! You now have the most important steps in Titanium Kitten Karaoke and are ready for your first karaoke session.

There is of course still a lot to discover. In the settings you will find further interesting possibilities to customize karaoke sessions with Titanium Kitten. You can ban participants who get on your nerves or add more admin users. Or adjust the background music between songs as you like. Click through Titanium Kitten a bit and explore the settings.

Now there's only one thing left to say: **Have fun with your own karaoke session in Titanium Kitten Karaoke**
