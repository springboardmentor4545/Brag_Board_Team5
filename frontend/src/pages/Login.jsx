import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isValidEmail } from '../utils/validation';
import '../App.css';

const HERO_FEATURES = [
  {
    title: 'Pick up where you left off',
    description: 'Jump straight into live shoutouts, queued approvals, and trending reactions without missing a beat.',
  },
  {
    title: 'Stay in sync across teams',
    description: 'Follow recognition streaks, join momentum in real time, and never miss a teammate getting celebrated.',
  },
  {
    title: 'Own your personal highlight reel',
    description: 'Track the praise rolling in, respond fast, and keep your brag book updated effortlessly.',
  },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const { login } = useAuth();
  const navigate = useNavigate();
  const isPendingApproval = error === 'Waiting for company verification';
  // const passwordIsValid = (value) => {
  //   // Enforce minimum length plus at least one letter, number, and special character.
  //   return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(value);
  // };

  useEffect(() => {
    if (typeof requestAnimationFrame === 'function') {
      const frame = requestAnimationFrame(() => setIsReady(true));
      return () => cancelAnimationFrame(frame);
    }
    const timeout = setTimeout(() => setIsReady(true), 16);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % HERO_FEATURES.length);
    }, 4200);
    return () => clearInterval(intervalId);
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const normalizedEmail = email.trim();
    const passwordValue = password.trim();

    if (!isValidEmail(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!passwordValue) {
      setError('Password is required.');
      return;
    }
    setLoading(true);

    try {
      const loggedInUser = await login(normalizedEmail.toLowerCase(), passwordValue);
      if (loggedInUser?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      const detail = err?.response?.data?.detail
        || err?.response?.data?.message
        || err?.originalError?.response?.data?.detail
        || err?.originalError?.response?.data?.message;
      const message = detail || err?.message || 'Invalid credentials';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-gradient" aria-hidden="true" />
      <span className="register-blob register-blob-one" aria-hidden="true" />
      <span className="register-blob register-blob-two" aria-hidden="true" />
      <span className="register-blob register-blob-three" aria-hidden="true" />

      <header className="register-header">
        <Link to="/" className="register-brand" aria-label="Brag Board home">
          <span className="register-brand-mark">Brag Board</span>
          <span className="register-brand-pill">Recognition stream</span>
        </Link>
        <Link to="/register" className="btn btn-outline register-header-cta">
          Create account
        </Link>
      </header>

      <main className="register-main">
        <div className="register-grid">
          <section className={`register-hero ${isReady ? 'register-hero-enter' : ''}`}>
            <p className="register-kicker">Welcome back</p>
            <h1 className="register-title">Keep the recognition flywheel spinning.</h1>
            <p className="register-subtitle">
              Dive back into the curated social feed where teammates hype each other up, request boosts, and keep morale soaring.
            </p>

            <ul className="register-feature-list">
              {HERO_FEATURES.map((feature, index) => {
                const isActive = activeFeature === index;
                return (
                  <li
                    key={feature.title}
                    className={`register-feature ${isActive ? 'is-active' : ''}`}
                    onMouseEnter={() => setActiveFeature(index)}
                    onFocus={() => setActiveFeature(index)}
                    onClick={() => setActiveFeature(index)}
                    role="button"
                    aria-pressed={isActive}
                    tabIndex={0}
                  >
                    <span className="register-feature-index">{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <p className="register-feature-title">{feature.title}</p>
                      <p className="register-feature-description">{feature.description}</p>
                    </div>
                    <span className="register-feature-glow" aria-hidden="true" />
                  </li>
                );
              })}
            </ul>

            <div className="register-hero-footer">
              <div className="register-stat-card">
                <div className="register-stat-number">7m</div>
                <p className="register-stat-label">Average time to reply to a shoutout</p>
              </div>
              <div className="register-avatar-stack" aria-hidden="true">
                <span className="register-avatar">
                  <img src="../av1.png" alt="" loading="lazy" />
                </span>
                <span className="register-avatar">
                  <img src="../av2.png" alt="" loading="lazy" />
                </span>
                <span className="register-avatar">
                  <img src="../av3.png" alt="" loading="lazy" />
                </span>
                <span className="register-avatar">
                  <img src="../av4.png" alt="" loading="lazy" />
                </span>
              </div>
              <p className="register-stat-note">Your peers are tagging teammates right now—jump in and add your boost.</p>
            </div>
          </section>

          <section className={`register-card register-card--login ${isReady ? 'register-card-enter' : ''}`}>
            <div className="register-card-header">
              <h2>Sign in to Brag Board</h2>
              <p>Secure login for teammates keeping the kudos flowing.</p>
            </div>

            {error && (
              <div
                className={`register-alert ${isPendingApproval ? 'is-info' : 'is-error'}`}
                role="alert"
              >
                {isPendingApproval ? 'Waiting for company verification' : error}
              </div>
            )}

            <form className="register-form" onSubmit={handleSubmit}>
              <div className="register-field">
                <label className="register-label" htmlFor="email">Work email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="register-input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div className="register-field">
                <div className="register-label-row">
                  <label className="register-label" htmlFor="password">Password</label>
                  <Link to="/forgot-password" className="register-inline-link register-inline-link--muted">
                    Forgot password?
                  </Link>
                </div>

                <div className="register-password-field">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className="register-input register-password-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="register-password-toggle no-anim"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary register-submit"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <div className="register-divider" aria-hidden="true" />

            <p className="register-footer-link">
              New to Brag Board?{' '}
              <Link to="/register" className="register-inline-link">Create an account</Link>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
