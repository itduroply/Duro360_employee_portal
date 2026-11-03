// Captions for the login background video (assets/login-bg.mp4). The video
// is five scenes joined with 1-second fades: two stock clips (forest, logs)
// and three duroply.in photos with a slow zoom (plywood stock, door, living
// room). `start` is the second each scene begins in that file.
// Change these together with the video.
export const STORY_CHAPTERS = [
  { start: 0, text: 'It starts in the forest.' },
  { start: 5.5, text: 'Timber, chosen with care.' },
  { start: 11, text: 'Made into plywood and boards.' },
  { start: 16.5, text: 'Shaped into doors.' },
  { start: 22, text: 'From forest to home.' },
];

/** Index of the chapter playing at `seconds` into the video. */
export function chapterAt(seconds) {
  let index = 0;
  STORY_CHAPTERS.forEach((chapter, i) => {
    if (seconds >= chapter.start) index = i;
  });
  return index;
}

/**
 * Changing caption under the wordmark — a short line for the clip now
 * playing, with one thin bar per clip to show where the story is.
 */
export default function StoryCaption({ chapter }) {
  return (
    <div className="mt-10 animate-fade-in [animation-delay:1000ms]" aria-hidden="true">
      <div className="flex gap-1.5">
        {STORY_CHAPTERS.map((c, i) => (
          <span
            key={c.start}
            className={`h-0.5 w-8 transition-colors duration-700 ${i === chapter ? 'bg-duro-500' : 'bg-white/30'}`}
          />
        ))}
      </div>
      <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.3em] text-white/60">
        {String(chapter + 1).padStart(2, '0')} / {String(STORY_CHAPTERS.length).padStart(2, '0')}
      </p>
      <p key={chapter} className="mt-1 animate-fade-in text-base tracking-[0.05em] text-white md:text-lg">
        {STORY_CHAPTERS[chapter].text}
      </p>
    </div>
  );
}
