export const HIGHLIGHT_COLOR = '#4e91c9'; // Default helles Blau
export const SECONDARY_COLOR = '#c9774e';
export const BLACK_BACKGROUND = 'rgba(0, 0, 0, 0.8)';
export const TIMER_BACKGROUND = 'rgba(0, 0, 0, 0.3)';
export const WHITE = '#ffffff';
export const PRIMARY_COLOR = '#ffd700';
export const GRAY = '#CCC';
export const OVERLAY_BACKGROUND = 'rgba(0, 0, 0, 0.95)';
export const NEXT_SONG_INFO_BACKGROUND = 'rgba(255, 255, 255, 0.1)';

export const UPDATE_THROTTLE_MS = 50; // Throttle updates to max 20fps to prevent race conditions

// Constants for display settings
export const UNSUNG_COLOR = '#ffffff';
export const CURRENT_LINE_OPACITY = 1;
export const NEXT_LINE_OPACITY = 0.7;
export const NEXT_NEXT_LINE_OPACITY = 0.3;
export const LYRICS_FADE_DURATION = '4s';
export const COUNTDOWN_SECONDS = 3;
export const FADE_IN_ATTACK_SECONDS = 10;
export const FADE_IN_DURATION_SECONDS = 4;

// Constants for fade-out/fade-in timing
export const FADE_OUT_THRESHOLD_MS = 5000; // 5 seconds - trigger fade-out if pause > 5s
export const FADE_IN_THRESHOLD_MS = 5000; // 5 seconds - trigger fade-in if next line starts within 5s