import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { roleHome } from '../../routes/roleHome.js';
import LoginForm from './components/LoginForm.jsx';
import duroplyLogo from '../../assets/duroply-logo.png';
import growthIllustration from '../../assets/growth-illustration.png';
import teamworkIllustration from '../../assets/teamwork-illustration.png';


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
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#FAF0DC] font-grotesk">

      {/* Header */}
      <header className="flex justify-center pt-5">
        <img
          src={duroplyLogo}
          alt="DUROPLY"
          className="h-9 w-auto"
        />
        <span className="ml-1 text-3xl font-bold text-[#ED1C24]">
          360
        </span>
      </header>

      {/* Main Content */}
      <main className="relative flex flex-1 flex-col items-center justify-center px-5 py-4">

        {/* Heading */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[#C8B99A] sm:text-5xl">
            Our Potential is{' '}
            <span className="text-[#ED1C24]">Limitless.</span>
          </h1>

          <p className="mt-3 text-sm text-gray-700 sm:text-base">
            Together we build better, bigger and brighter.
          </p>
        </div>

        {/* Login Card */}
        <div className="relative z-10 w-full max-w-md rounded-xl bg-white px-7 py-7 shadow-xl shadow-[#b9a989]/20 sm:px-10">

          <div className="mb-5">
            <h2 className="text-xl font-bold text-gray-800">
              Welcome Back
            </h2>

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

          <div className="mt-6 flex items-center justify-center gap-3 text-xs text-[#B5A486]">
            <span className="h-px flex-1 bg-[#E8DDC8]" />
            Grow <span>•</span> Collaborate <span>•</span> Succeed
            <span className="h-px flex-1 bg-[#E8DDC8]" />
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs tracking-widest text-[#A99A7D]">
          DUROPLY INDUSTRIES LIMITED · SINCE 1957
        </p>

      </main>

      {/* Illustrations (large screens only) */}
      <img
        src={growthIllustration}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-16 left-0 hidden w-[32vw] max-w-[640px] select-none lg:block"
      />
      <img
        src={teamworkIllustration}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-16 right-0 hidden w-[30vw] max-w-[600px] select-none lg:block"
      />

      {/* Decorative Background Elements */}
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-[#E9D8B6]/40 blur-3xl" />

      <div className="pointer-events-none absolute -right-20 top-40 h-64 w-64 rounded-full bg-[#F5DDAE]/40 blur-3xl" />

    </div>
  );
}
