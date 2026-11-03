import duroplyLogo from '../../../assets/duroply-logo.png';
import StoryCaption from './StoryCaption.jsx';

/**
 * Left column of the Login page — the large DUROPLY wordmark over the
 * background video, in the style of a full-screen brand hero. The red logo
 * file is shown in white here (brightness-0 + invert) so it reads on the
 * dark video. Below it, a caption follows the video's story (`chapter`).
 */
export default function BrandPanel({ chapter }) {
  return (
    <div className="flex w-full flex-col justify-center text-white md:w-[55%]">
      <p className="animate-fade-in text-xs font-medium uppercase tracking-[0.3em] text-white/80 [animation-delay:200ms] md:text-sm">
        <span className="font-semibold text-white">DURO360</span>
      </p>

      <img
        src={duroplyLogo}
        alt="DUROPLY"
        className="mt-5 h-12 w-auto self-start brightness-0 invert animate-fade-in [animation-delay:400ms] sm:h-16 md:h-24"
      />

      <div className="mt-8 h-px w-20 bg-duro-500 animate-fade-in [animation-delay:600ms]" aria-hidden="true" />

      <h2 className="mt-6 max-w-md animate-fade-in text-xl font-light leading-snug tracking-[0.05em] [animation-delay:800ms] md:text-[28px] md:leading-[1.3]">
        Strong by nature.
        <br />
        Trusted by professionals.
      </h2>

      <p className="mt-4 max-w-md animate-fade-in text-sm font-light leading-relaxed text-white/80 [animation-delay:1000ms] md:text-base">
        A Complete View of Connected Business Operations
      </p>

      <StoryCaption chapter={chapter} />
    </div>
  );
}
