import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { emitToast } from '../utils/toast.js';
import { isValidEmail } from '../utils/validation';
import '../App.css';

const HERO_FEATURES = [
  {
    title: 'Reset in one tap',
    description: 'Request a secure email link that gets you back in the feed in seconds.',
  },
  {
    title: 'Protect your shoutouts',
    description: 'Re-authenticate quickly so you never lose access to team celebrations.',
  },
  {
    title: 'Keep streaks alive',
    description: 'Restore your login without breaking the recognition streaks you have built.',
  },
];

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [isReady, setIsReady] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

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
    setMessage('');
    setError('');
    const normalizedEmail = email.trim();
    if (!isValidEmail(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await authAPI.forgotPassword({ email: normalizedEmail.toLowerCase() }, { skipErrorToast: true });
      const successMessage = 'If that email exists, a reset link has been sent. Please check your inbox.';
      setMessage(successMessage);
      setMessageType('success');
      emitToast('success', successMessage);
    } catch {
      // Still show generic message to avoid enumeration feedback
      const infoMessage = 'If that email exists, a reset link has been sent. Please check your inbox.';
      setMessage(infoMessage);
      setMessageType('info');
      emitToast('info', infoMessage);
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
          <span className="register-brand-pill">Reset access</span>
        </Link>
        <Link to="/login" className="btn btn-outline register-header-cta">
          Back to login
        </Link>
      </header>

      <main className="register-main">
        <div className="register-grid">
          <section className={`register-hero ${isReady ? 'register-hero-enter' : ''}`}>
            <p className="register-kicker">Need a reset?</p>
            <h1 className="register-title">We&rsquo;ll help you rejoin the celebration feed.</h1>
            <p className="register-subtitle">
              Request a secure link to refresh your password, hop back in, and keep amplifying your teammates&rsquo; victories.
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
                <div className="register-stat-number">2m</div>
                <p className="register-stat-label">Median time to unlock accounts</p>
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
              <p className="register-stat-note">Ops team is on standby to keep every shoutout thread uninterrupted.</p>
            </div>
          </section>

          <section className={`register-card register-card--forgot ${isReady ? 'register-card-enter' : ''}`}>
            <div className="register-card-header">
              <h2>Send a reset link</h2>
              <p>We&rsquo;ll email you instructions to set a new password.</p>
            </div>

            {message && (
              <div
                className={`register-alert ${messageType === 'info' ? 'is-info' : 'is-success'}`}
                role="status"
              >
                {message}
              </div>
            )}
            {error && (
              <div className="register-alert is-error" role="alert">
                {error}
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

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary register-submit"
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>

            <div className="register-divider" aria-hidden="true" />

            <p className="register-footer-link">
              Remembered your password?{' '}
              <Link to="/login" className="register-inline-link">Back to login</Link>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
