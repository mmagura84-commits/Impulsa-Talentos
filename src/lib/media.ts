/**
 * Curated image + video assets for the landing page.
 * All images are loaded from Unsplash CDN with explicit width params.
 * Videos are free-to-embed demo clips (Coverr / Mixkit) — small, no auth.
 */
export interface MediaItem {
  src: string
  alt: string
  credit?: string
  width?: number
  height?: number
}

export interface VideoItem {
  /** MP4 / WebM source URL (must be a direct, no-auth asset). */
  src: string
  /** Optional poster image. */
  poster?: string
  /** Short descriptive caption. */
  caption: string
  /** Credit line shown next to the play button. */
  credit?: string
}

const u = (url: string) => `${url}?auto=format&fit=crop&w=1280&q=80`
const u_small = (url: string) => `${url}?auto=format&fit=crop&w=640&q=75`

export const heroPhoto: MediaItem = {
  src: u('https://images.unsplash.com/photo-1606857521015-7f9fcf423740'),
  alt: 'A bilingual software developer at a multi-monitor workstation',
  credit: 'Israel Andrade / Unsplash',
  width: 1280,
  height: 853,
}

export const candidatesPhoto: MediaItem = {
  src: u('https://images.unsplash.com/photo-1553028826-f4804a6dba3b'),
  alt: 'A diverse team collaborating around a wooden table in a modern office',
  credit: 'CoWomen / Unsplash',
}

export const employersPhoto: MediaItem = {
  src: u('https://images.unsplash.com/photo-1582005450386-52b25f82d9bb'),
  alt: 'Three professionals working on laptops at a coworking table',
  credit: 'S O C I A L . C U T / Unsplash',
}

export const verticalsPhotos: Record<string, MediaItem> = {
  tech: {
    src: u('https://images.unsplash.com/photo-1606857521015-7f9fcf423740'),
    alt: 'Software developer working on dual monitors',
    credit: 'Israel Andrade / Unsplash',
  },
  cx: {
    src: u('https://images.unsplash.com/photo-1766066014237-00645c74e9c6'),
    alt: 'Customer service agent wearing a headset and smiling at her computer',
    credit: 'BaljkanN 4 / Unsplash',
  },
  health: {
    src: u('https://images.unsplash.com/photo-1758691462743-f9fc9e430d39'),
    alt: 'Healthcare professional conducting a telemedicine video consultation',
    credit: 'Vitaly Gariev / Unsplash',
  },
  finance: {
    src: u('https://images.unsplash.com/photo-1460925895917-afdab827c52f'),
    alt: 'Financial analyst reviewing data and charts on a laptop with a city view',
    credit: 'Carlos Muza / Unsplash',
  },
}

export const cityscapePhoto: MediaItem = {
  src: u('https://images.unsplash.com/photo-1568632234157-ce7aecd03d0d'),
  alt: 'Bogota, Colombia cityscape with high-rise buildings at sunset',
  credit: 'Random Institute / Unsplash',
}

export const cityscapePhotoSmall: string = u_small(
  'https://images.unsplash.com/photo-1568632234157-ce7aecd03d0d',
)

export const cityscapeMountains: MediaItem = {
  src: u('https://images.unsplash.com/photo-1661641172357-73091e102023'),
  alt: 'A Colombian city with mountains in the background',
  credit: 'Mariana Boscan Fernandez / Unsplash',
}

export const portraitPhoto: MediaItem = {
  src: u('https://images.unsplash.com/photo-1770003354577-82b2a2d09d19'),
  alt: 'A sunlit home office desk with a computer and books',
  credit: 'Olivier Amyot / Unsplash',
}

/* ── Demo videos (Mixkit — free to use, no auth required) ─────── */
export const heroVideo: VideoItem = {
  // Mixkit free-license clip of a business team meeting
  src: 'https://assets.mixkit.co/videos/preview/mixkit-team-of-business-people-working-together-32748-large.mp4',
  poster: u('https://images.unsplash.com/photo-1606857521015-7f9fcf423740'),
  caption: 'Multicultural teams collaborating across time zones',
  credit: 'Mixkit',
}

export const storyVideo: VideoItem = {
  // A second short loop of remote work / laptop lifestyle
  src: 'https://assets.mixkit.co/videos/preview/mixkit-young-mother-with-her-little-daughter-decorating-a-christmas-tree-39745-large.mp4',
  poster: u('https://images.unsplash.com/photo-1770003354577-82b2a2d09d19'),
  caption: 'Bilingual professionals building careers without borders',
  credit: 'Mixkit',
}
