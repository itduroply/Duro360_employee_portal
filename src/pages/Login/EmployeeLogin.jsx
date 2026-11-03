
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { roleHome } from '../../routes/roleHome.js';
import LoginForm from './components/LoginForm.jsx';
import duroplyLogo from '../../assets/duroply-logo.png';
import heroFlying from '../../assets/login-hero-flying.png';
import globeTeam from '../../assets/login-globe-team.png';
import growthLadder from '../../assets/login-growth-ladder.png';
import plantTimeline from '../../assets/login-plant-timeline.png';
import weAreA from '../../assets/login-we-are-a.png';

export default function EmployeeLogin() {
  const { loginEmployee } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const loggedInUser = await loginEmployee(email, password);
      const redirectTo =
        location.state?.from?.pathname || roleHome(loggedInUser.roles);

      navigate(redirectTo, { replace: true });
    } catch (err) {
      setErrorMessage(
        err.message || 'Something went wrong. Please try again later.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-dvh bg-[#F8EDD6] font-grotesk lg:h-dvh lg:grid-cols-[1.12fr_1fr] lg:overflow-hidden">

      {/* Story panel: the leaflet's "Be Bold" page with the team on the globe */}
      <aside className="relative flex flex-col overflow-hidden px-6 pb-4 pt-6 sm:px-10 lg:px-14 lg:pt-8">
        <img
          src={heroFlying}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-4 hidden w-36 select-none sm:block lg:right-8 lg:top-6 xl:w-52"
        />

        <header className="relative">
          <img src={duroplyLogo} alt="DUROPLY" className="h-9 w-auto" />
        </header>

        <div className="relative mt-8 lg:mt-14">
          <h1 className="font-['Jost'] text-[1.75rem] font-bold leading-[1.08] tracking-tight text-[#C8B99A] sm:text-5xl lg:text-[clamp(2rem,3.6vw,4rem)]">
            Be Bold<span className="text-[#ED1C24]">.</span>
            <br />
            Be Courageous<span className="text-[#ED1C24]">.</span>
            <br />
            Be Transformational<span className="text-[#ED1C24]">.</span>
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#3A3128] lg:mt-5">
            We aim for 10x value creation for our people, customers, and partners.
            <span className="mt-1 block italic">Growth at DUROPLY happens when everyone grows.</span>
          </p>
        </div>

        {/* "We are a GROWTH COMPANY" artwork (large screens only), fading in from the top */}
        <div className="relative hidden min-h-0 flex-1 items-end lg:flex">
          <div
            style={{ '--w': 'min(100%, 50vh)', width: 'var(--w)', paddingBottom: 'calc(var(--w) * 0.11)' }}
            className="relative"
          >
            <img
              src={growthLadder}
              alt=""
              aria-hidden="true"
              className="pointer-events-none block w-full select-none [mask-image:linear-gradient(to_bottom,transparent,black_18%)]"
            />
            {/* "We are a" sits a little lower than in the print artwork and walks in from the left */}
            <img
              src={weAreA}
              alt=""
              aria-hidden="true"
              style={{ left: 0, top: '57%', width: '28.3%' }}
              className="pointer-events-none absolute select-none cc-walk"
            />
            <p
              style={{ fontSize: 'calc(var(--w) * 0.062)' }}
              className="absolute right-0 bottom-0 font-['Jost'] font-bold leading-none tracking-wide text-[#C8B99A]"
            >
              COMPANY
            </p>
          </div>
        </div>
      </aside>

      {/* Sign-in panel */}
      <main className="relative flex flex-col items-center justify-center overflow-hidden bg-[#FAF0DC] px-5 py-10 sm:px-10 lg:border-l lg:border-[#E6D6B3]">
        <div className="relative z-10 w-full max-w-md lg:-translate-y-6">
          <div className="overflow-hidden rounded-2xl bg-white shadow-2xl shadow-[#b9a989]/30 ring-1 ring-[#EBDDBC]">
            <div className="flex h-1.5">
              <span className="flex-1 bg-[#ED1C24]" />
              <span className="flex-1 bg-[#FFCC00]" />
              <span className="flex-1 bg-[#D4E7C8]" />
              <span className="flex-1 bg-[#D0EBFA]" />
            </div>

            <div className="px-7 py-8 sm:px-10">
              <div className="mb-7">
                <p className="font-['Jost'] text-5xl font-extrabold leading-none tracking-tight text-[#ED1C24]">
                  Duro360
                </p>
                <h2 className="mt-4 text-xl font-semibold text-gray-800">Welcome back</h2>
                <p className="mt-1 text-sm text-[#8F7D5A]">
                  Sign in to continue your journey.
                </p>
              </div>

              <LoginForm
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                rememberMe={rememberMe}
                setRememberMe={setRememberMe}
                errorMessage={errorMessage}
                isSubmitting={isSubmitting}
                onSubmit={handleSubmit}
                idLabel="Employee ID or Email"
                idPlaceholder="Enter your Employee ID or email"
              />
            </div>

            <div className="border-t border-[#F0E6D2] bg-[#FDF8EC] px-7 py-3.5 text-center text-xs tracking-widest text-[#A99A7D] sm:px-10">
              DUROPLY INDUSTRIES LIMITED · SINCE 1957
            </div>
          </div>
        </div>

        {/* 1957 to 2026 growth line, top of the panel (large screens only) */}
        <img
          src={plantTimeline}
          alt=""
          aria-hidden="true"
          className="pointer-events-none mt-8 w-56 select-none lg:absolute lg:left-1/2 lg:top-3 lg:mt-0 lg:w-52 lg:-translate-x-1/2 xl:w-60"
        />

        {/* Team on the globe, bleeding off the bottom edge */}
        <img
          src={globeTeam}
          alt=""
          aria-hidden="true"
          className="pointer-events-none mt-8 w-full max-w-lg select-none lg:absolute lg:-bottom-24 lg:left-1/2 lg:mt-0 lg:w-[78%] lg:-translate-x-1/2 xl:-bottom-32"
        />
      </main>
    </div>
  );
}
