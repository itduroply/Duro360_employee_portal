import { useEffect, useState } from 'react';
import heroFlying from '../../assets/login-hero-flying.png';
import globeTeam from '../../assets/login-globe-team.png';
import growthLadder from '../../assets/login-growth-ladder.png';
import weAreA from '../../assets/login-we-are-a.png';
import plantTimeline from '../../assets/login-plant-timeline.png';
import mdSignature from '../../assets/md-signature.png';
import potentialWire from '../../assets/potential-wire.png';
import teamwork from '../../assets/teamwork-illustration.png';
import growthIllustration from '../../assets/growth-illustration.png';

const SLIDE_MS = 4000;

const RED = '#ED1C24';
const TAN = '#C8B99A';
const INK = '#3A3128';

const Dot = () => <span style={{ color: RED }}>.</span>;

// Text and wording follow the DUROPLY culture leaflet, page by page.
const SLIDES = [
  {
    id: 'duro-way',
    bg: '#F8EDD6',
    body: (
      <>
        <p className="font-['Jost'] text-xl font-extrabold leading-none tracking-[0.3em] sm:text-2xl" style={{ color: TAN }}>THE</p>
        <p className="font-['Jost'] text-7xl font-extrabold leading-[0.95] tracking-tight sm:text-[7rem]" style={{ color: RED }}>DURO</p>
        <p className="font-['Jost'] text-4xl font-extrabold leading-none tracking-[0.25em] sm:text-5xl" style={{ color: TAN }}>WAY</p>
        <span className="mt-4 block h-1 w-16 rounded-full" style={{ background: RED }} />
        <p className="mt-3 max-w-md text-sm sm:text-base" style={{ color: INK }}>
          A Place That Makes You Uncomfortable in the Best Way to Build a Culture of Growth &amp; Excellence.
        </p>
      </>
    ),
    art: (
      <div className="relative h-60 w-72 sm:h-64 sm:w-96">
        {/* Steps rise one after another, in the leaflet colours */}
        {[
          ['#D0EBFA', 28],
          ['#D4E7C8', 44],
          ['#FFCC00', 60],
          [RED, 76],
        ].map(([color, h], i) => (
          <span
            key={color}
            className="cc-rise absolute bottom-0 rounded-t-lg"
            style={{ left: `${i * 25}%`, width: '25%', height: `${h}%`, background: color, animationDelay: `${300 + i * 250}ms` }}
          />
        ))}
        <img
          src={heroFlying}
          alt=""
          aria-hidden="true"
          className="cc-bob absolute -top-2 right-0 w-40 sm:w-52"
        />
        <div
          className="cc-pop absolute bottom-3 right-3 flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white text-center shadow-theme-md sm:h-28 sm:w-28"
          style={{ animationDelay: '1300ms' }}
        >
          <span className="font-['Jost'] text-4xl font-extrabold leading-none sm:text-5xl" style={{ color: RED }}>70</span>
          <span className="font-serif text-xs italic leading-tight text-gray-700">Years of<br />Excellence</span>
        </div>
      </div>
    ),
  },
  {
    id: 'md',
    bg: '#FFFFFF',
    body: (
      <>
        <p className="font-['Jost'] text-xl font-extrabold text-gray-900 sm:text-3xl">MD&rsquo;s Message:</p>
        <p className="font-['Jost'] text-xl font-extrabold sm:text-3xl" style={{ color: RED }}>The Spark Behind Our Journey</p>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-gray-700 sm:text-base">
          Our culture isn&rsquo;t a set of rules or fancy words. It&rsquo;s the way we collaborate, support each other, solve
          problems, and bring our energy to work. You are the culture.
        </p>
        <p className="mt-3 text-sm text-gray-700">
          <span className="font-semibold">Akhilesh Chitlangia,</span> Managing Director &amp; CEO
        </p>
        <img src={mdSignature} alt="" aria-hidden="true" className="mt-1 h-8 w-auto" />
      </>
    ),
    art: <img src={plantTimeline} alt="" aria-hidden="true" className="w-72 sm:w-96" />,
  },
  {
    id: 'promise',
    bg: '#FFFFFF',
    body: (
      <>
        <p className="font-['Jost'] text-xl font-extrabold sm:text-3xl" style={{ color: RED }}>DUROPLY Promise</p>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-gray-700 sm:text-base">
          We provide our customers with a trusted source for high-quality products, timely delivery, and innovative
          solutions.
        </p>
        <p className="mt-4 font-['Jost'] text-lg font-extrabold sm:text-2xl" style={{ color: RED }}>Vision</p>
        <p className="max-w-lg text-sm text-gray-700 sm:text-base">
          To be the most admired wood-based company through innovation and excellence in customer service.
        </p>
      </>
    ),
    art: <img src={teamwork} alt="" aria-hidden="true" className="max-h-60 w-auto sm:max-h-64" />,
  },
  {
    id: 'values',
    bg: '#F8EDD6',
    body: (
      <>
        <p className="font-['Jost'] text-xl font-extrabold sm:text-3xl" style={{ color: RED }}>Our Values</p>
        <ul className="mt-3 space-y-3">
          {[
            ['Passion for Excellence', 'हमेशा सबसे अच्छा करने का जुनून'],
            ['Curious to Learn', 'सीखने की जिज्ञासा'],
            ['Uncompromising on Trust', 'भरोसे पर कभी समझौता नहीं'],
          ].map(([en, hi], i) => (
            <li key={en} className="flex items-baseline gap-3 cc-in-left" style={{ animationDelay: `${200 + i * 250}ms` }}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: RED }} />
              <span>
                <span className="font-['Jost'] text-lg font-bold sm:text-2xl" style={{ color: INK }}>{en}</span>
                <span className="block text-sm" style={{ color: '#8F7D5A' }}>{hi}</span>
              </span>
            </li>
          ))}
        </ul>
      </>
    ),
    art: (
      <p className="max-w-[16rem] text-left font-['Jost'] text-3xl font-extrabold leading-tight sm:text-4xl" style={{ color: TAN }}>
        This is who we are, <span style={{ color: RED }}>together.</span>
      </p>
    ),
  },
  {
    id: 'growth',
    bg: '#F8EDD6',
    body: (
      <>
        <p className="font-['Jost'] text-xl font-extrabold sm:text-3xl" style={{ color: TAN }}>
          We are a <span style={{ color: RED }}>GROWTH</span> COMPANY
        </p>
        <p className="mt-3 max-w-md text-sm sm:text-base" style={{ color: INK }}>
          We aim for 10x value creation for our people, customers, and partners.
        </p>
        <p className="mt-1 max-w-md text-sm italic sm:text-base" style={{ color: INK }}>
          Growth at DUROPLY happens when everyone grows.
        </p>
      </>
    ),
    art: (
      <div className="relative w-64 sm:w-80">
        <img src={growthLadder} alt="" aria-hidden="true" className="block w-full" />
        <img src={weAreA} alt="" aria-hidden="true" className="absolute left-0 w-[28.3%]" style={{ top: '57%' }} />
      </div>
    ),
  },
  {
    id: 'identity',
    bg: '#FFFFFF',
    body: (
      <>
        <p className="font-['Jost'] text-xl font-extrabold sm:text-3xl" style={{ color: RED }}>Our Identity</p>
        <p className="mt-2 font-['Jost'] text-lg font-bold text-gray-900 sm:text-2xl">We build Duro&ndash;ble relationships that last a lifetime.</p>
        <p className="mt-3 max-w-lg text-sm text-gray-700 sm:text-base">
          You may leave DUROPLY&hellip; <span className="font-semibold">but DUROPLY won&rsquo;t leave you.</span>
        </p>
        <p className="mt-2 text-sm text-gray-700 sm:text-base">We grow together. We win together. We stay connected forever.</p>
      </>
    ),
    art: <img src={teamwork} alt="" aria-hidden="true" className="max-h-60 w-auto sm:max-h-64" />,
  },
  {
    id: 'impact',
    bg: '#FFFFFF',
    body: (
      <>
        <p className="font-['Jost'] text-lg font-extrabold leading-tight sm:text-2xl" style={{ color: RED }}>
          The DUROPLY Way of Creating Impact
        </p>
        <span className="mt-2 block h-1 w-12 rounded-full" style={{ background: '#FFCC00' }} />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            ['How we serve the world', RED, ['Uncompromising Quality', 'Delivering Value is Our Dharma', 'Exceptional Service']],
            ['How we work with each other', '#2E9E5B', ['We find joy in delivering excellence', 'We make our work engaging and meaningful', 'We improve continuously']],
          ].map(([head, color, items]) => (
            <div key={head}>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color }}>{head}</p>
              <ul className="space-y-1.5">
                {items.map((t) => (
                  <li key={t} className="flex items-start gap-2 rounded-lg bg-[#F8EDD6]/70 px-3 py-1.5 text-[13px] font-medium leading-snug" style={{ color: INK }}>
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs italic" style={{ color: '#8F7D5A' }}>
          Uncompromising Quality &ndash; only the best leaves our hands. Exceptional Service &ndash; every interaction must feel memorable.
        </p>
      </>
    ),
    art: <img src={globeTeam} alt="" aria-hidden="true" className="w-64 sm:w-80" />,
  },
  {
    id: 'one-percent',
    bg: '#F8EDD6',
    body: (
      <>
        <p className="font-['Jost'] text-xl font-extrabold sm:text-3xl" style={{ color: RED }}>Why stay the same if you can be 1% Better Every Day?</p>
        <p className="mt-2 max-w-lg text-sm sm:text-base" style={{ color: INK }}>
          Success grows from 1% progress, repeated every day for 365 days.
        </p>
        <p className="mt-3 text-sm text-gray-500">Progress &gt; perfection. Daily small steps = big results.</p>
      </>
    ),
    art: (
      <div className="flex items-end gap-8 text-center">
        <div>
          <p className="font-['Jost'] text-5xl font-extrabold text-green-600 sm:text-6xl">37.78</p>
          <p className="mt-1 text-xs text-gray-600">1% better every day<br />1.01<sup>365</sup></p>
        </div>
        <div>
          <p className="font-['Jost'] text-3xl font-extrabold sm:text-4xl" style={{ color: RED }}>00.03</p>
          <p className="mt-1 text-xs text-gray-600">1% worse every day<br />0.99<sup>365</sup></p>
        </div>
      </div>
    ),
  },
  {
    id: 'process',
    bg: '#FFFFFF',
    body: (
      <>
        <p className="font-['Jost'] text-xl font-extrabold sm:text-3xl" style={{ color: RED }}>Process Over Outcome</p>
        <p className="mt-1 text-sm text-gray-700 sm:text-base">How we work matters as much as the result.</p>
        <p className="mt-3 text-sm font-semibold text-gray-900 sm:text-base">If you follow our process with passion:</p>
        <p className="font-['Jost'] text-lg font-bold sm:text-2xl" style={{ color: TAN }}>Success = Your Success</p>
        <p className="font-['Jost'] text-lg font-bold sm:text-2xl" style={{ color: TAN }}>Failure = Leadership Responsibility</p>
      </>
    ),
    art: (
      <div className="rounded-2xl border px-6 py-5 text-center" style={{ borderColor: RED }}>
        <p className="text-sm font-semibold" style={{ color: RED }}>Our Mantra is to</p>
        <p className="font-['Jost'] text-3xl font-extrabold sm:text-4xl" style={{ color: TAN }}>Follow the Process.</p>
      </div>
    ),
  },
  {
    id: 'bold',
    bg: '#F8EDD6',
    body: (
      <p className="font-['Jost'] text-3xl font-extrabold leading-[1.08] sm:text-5xl" style={{ color: TAN }}>
        Be Bold<Dot />
        <br />
        Be Courageous<Dot />
        <br />
        Be Transformational<Dot />
        <span className="mt-3 block font-sans text-sm font-normal sm:text-base" style={{ color: INK }}>
          We grow by thinking big and acting boldly &ndash; not by playing it safe.
        </span>
      </p>
    ),
    art: <img src={heroFlying} alt="" aria-hidden="true" className="w-56 sm:w-72" />,
  },
  {
    id: 'standards',
    bg: '#FFFFFF',
    body: (
      <>
        <p className="font-['Jost'] text-xl font-extrabold sm:text-3xl" style={{ color: RED }}>The 10x Mindset</p>
        <p className="mt-2 max-w-lg text-sm text-gray-700 sm:text-base">
          We ask not &ldquo;How do we improve?&rdquo; but &ldquo;How do we transform?&rdquo; We aim for 10x impact, not 5% improvements.
        </p>
        <p className="mt-3 text-sm font-semibold text-gray-900 sm:text-base">Challenge old ways &middot; Propose new ideas &middot; Own big problems &middot; Lead without waiting</p>
        <p className="mt-3 inline-block rounded-lg border px-3 py-1 text-sm font-semibold" style={{ borderColor: RED, color: INK }}>
          Transformation is a mindset.
        </p>
      </>
    ),
    art: <img src={growthIllustration} alt="" aria-hidden="true" className="max-h-56 w-auto sm:max-h-64" />,
  },
  {
    id: 'potential',
    bg: '#FFFFFF',
    body: (
      <p className="font-['Jost'] text-3xl font-extrabold leading-tight sm:text-5xl" style={{ color: '#BDBDBD' }}>
        We have a lot of <span style={{ color: RED }}>Potential.</span>
        <br />
        Our Potential is <span style={{ color: RED }}>Limitless.</span>
      </p>
    ),
    art: <img src={potentialWire} alt="" aria-hidden="true" className="w-72 sm:w-[26rem]" />,
  },
  {
    id: 'integrity',
    bg: '#F8EDD6',
    body: (
      <>
        <p className="font-['Jost'] text-3xl font-extrabold leading-tight sm:text-5xl">
          <span style={{ color: RED }}>Integrity</span> <span style={{ color: TAN }}>First &amp;</span>
          <br />
          <span style={{ color: RED }}>Principles</span> <span style={{ color: TAN }}>Always</span>
        </p>
        <ul className="mt-3 space-y-1 text-sm sm:text-base" style={{ color: INK }}>
          <li>Every action must come from the right intent.</li>
          <li>No gossip. No politics. No manipulation.</li>
          <li>Have the courage to say NO when something feels wrong.</li>
        </ul>
      </>
    ),
    art: (
      <p className="max-w-[17rem] text-left font-['Jost'] text-2xl font-extrabold leading-snug sm:text-3xl" style={{ color: TAN }}>
        Transparent inside, <span style={{ color: RED }}>responsible outside.</span>
      </p>
    ),
  },
  {
    id: 'philosophy',
    bg: 'linear-gradient(120deg, #FFFBEA 0%, #FFF1BD 60%, #FFE58A 100%)',
    body: (
      <>
        <p className="font-['Jost'] text-xl font-extrabold sm:text-3xl" style={{ color: RED }}>The DUROPLY Philosophy</p>
        <p className="mt-2 max-w-lg text-sm font-semibold sm:text-base" style={{ color: INK }}>
          This place is designed to make you uncomfortable in the best way.
        </p>
        <p className="mt-4 font-['Jost'] text-2xl font-bold leading-tight sm:text-3xl" style={{ color: TAN }}>DUROPLY makes you</p>
        <p className="font-['Jost'] text-5xl font-extrabold leading-none sm:text-7xl" style={{ color: RED }}>Unstoppable</p>
        <span className="mt-3 block h-1 w-16 rounded-full" style={{ background: '#FFCC00' }} />
      </>
    ),
    art: (
      <div className="relative flex w-72 flex-col gap-4 sm:w-80">
        <span className="cc-bob absolute -right-6 -top-8 h-28 w-28 rounded-full bg-[#FFCC00]/50" aria-hidden="true" />
        <div className="cc-rise relative rounded-2xl bg-white/80 px-6 py-4 shadow-theme-sm" style={{ animationDelay: '300ms' }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Comfort</p>
          <p className="font-['Jost'] text-xl font-bold sm:text-2xl" style={{ color: INK }}>makes you good.</p>
        </div>
        <div className="cc-rise relative rounded-2xl px-6 py-4 text-white shadow-theme-md" style={{ background: 'linear-gradient(135deg, #ED1C24, #C8161D)', animationDelay: '700ms' }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/80">Discomfort</p>
          <p className="font-['Jost'] text-xl font-bold sm:text-2xl">makes you great.</p>
        </div>
      </div>
    ),
  },
];

/**
 * Super Admin dashboard hero: the culture leaflet as a banner carousel.
 * Each slide stays 4 seconds, then the next one slides in. Hovering pauses it.
 */
export default function CultureCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [index, paused]);

  const slide = SLIDES[index];
  const go = (n) => setIndex((n + SLIDES.length) % SLIDES.length);

  return (
    <section
      className="relative overflow-hidden rounded-3xl shadow-theme-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="DUROPLY culture"
    >
      <div
        key={slide.id}
        className="grid min-h-[340px] grid-cols-1 items-center gap-6 px-6 pb-14 pt-8 text-left transition-colors sm:px-10 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-10"
        style={{ background: slide.bg }}
      >
        <div className="min-w-0 cc-in-left text-left">{slide.body}</div>
        <div className="cc-in-right flex min-w-0 items-center justify-center md:justify-end">{slide.art}</div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-6 pb-3 sm:px-10">
        <div className="flex items-center gap-1.5">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6' : 'w-1.5 opacity-50'}`}
              style={{ background: slide.dark ? '#fff' : RED }}
            />
          ))}
        </div>
        <div className="flex gap-1.5">
          {[['Previous slide', -1, '‹'], ['Next slide', 1, '›']].map(([label, step, glyph]) => (
            <button
              key={label}
              type="button"
              onClick={() => go(index + step)}
              aria-label={label}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/10 text-lg leading-none hover:bg-black/20"
              style={{ color: slide.dark ? '#fff' : INK }}
            >
              {glyph}
            </button>
          ))}
        </div>
      </div>

      {/* 4 second timer for the current slide */}
      {!paused && (
        <span
          key={`bar-${index}`}
          className="absolute bottom-0 left-0 h-1 w-full origin-left cc-bar"
          style={{ background: slide.dark ? '#fff' : RED, opacity: 0.7 }}
          aria-hidden="true"
        />
      )}
    </section>
  );
}
