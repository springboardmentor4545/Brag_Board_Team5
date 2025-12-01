import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import { emitToast } from '../utils/toast.js';
import { isStrongPassword, PASSWORD_REQUIREMENTS } from '../utils/validation';
import '../App.css';

const PASSWORD_RULES = [
  { key: 'length', label: 'Includes at least 8 characters' },
  { key: 'upper', label: 'Contains an uppercase letter' },
  { key: 'lower', label: 'Contains a lowercase letter' },
  { key: 'number', label: 'Contains a number' },
  { key: 'special', label: 'Contains a special character (!@#$ etc.)' },
];

const HERO_FEATURES = [
  {
    title: 'Recover access instantly',
    description: 'Drop in a new password and hop back into the recognition feed without losing momentum.',
  },
  {
    title: 'Keep your highlights secure',
    description: 'Harden your account with a stronger password so shoutouts stay tied to you.',
  },
  {
    title: 'Stay in the team loop',
    description: 'Rejoin tagged shoutouts, queue approvals, and analytics dashboards within minutes.',
  },
];

const evaluatePassword = (value = '') => ({
  length: value.length >= 8,
  upper: /[A-Z]/.test(value),
  lower: /[a-z]/.test(value),
  number: /\d/.test(value),
  special: /[^A-Za-z0-9]/.test(value),
});

const determineStrength = (checks) => {
  const total = Object.values(checks || {}).filter(Boolean).length;
  if (total === 0) {
    return {
      label: 'Start typing a password',
      percentage: 0,
      state: 'is-empty',
    };
  }
  const percentage = Math.min(total, 5) * 20;
  if (total <= 2) {
    return {
      label: 'Password strength: Weak',
      percentage,
      state: 'is-weak',
    };
  }
  if (total <= 4) {
    return {
      label: 'Password strength: Moderate',
      percentage,
      state: 'is-medium',
    };
  }
  return {
    label: 'Password strength: Strong',
    percentage,
    state: 'is-strong',
  };
};

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [passwordChecks, setPasswordChecks] = useState(() => evaluatePassword(''));
  const [passwordStrength, setPasswordStrength] = useState(() => determineStrength(evaluatePassword('')));

  useEffect(() => {
    if (!token) {
      setError('Reset token is missing or invalid. Please use the link from your email.');
    }
  }, [token]);

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

    const passwordValue = password.trim();
    const confirmValue = confirmPassword.trim();

    const latestChecks = evaluatePassword(passwordValue);
    setPasswordChecks(latestChecks);
    setPasswordStrength(determineStrength(latestChecks));

    if (Object.values(latestChecks).some((flag) => !flag)) {
      setError('Password must include 8+ characters with uppercase, lowercase, number, and special character.');
      return;
    }

    if (!isStrongPassword(passwordValue)) {
      setError(PASSWORD_REQUIREMENTS);
      return;
    }
    if (passwordValue !== confirmValue) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.resetPassword({ token, new_password: passwordValue }, { skipErrorToast: true });
      const successMessage = res.data?.message || 'Password reset successful. You can now sign in.';
      setMessage(successMessage);
      emitToast('success', successMessage);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Reset failed. The link may be invalid or expired.';
      setError(errorMessage);
      emitToast('error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    const checks = evaluatePassword(value);
    setPasswordChecks(checks);
    setPasswordStrength(determineStrength(checks));
  };

  const passwordMissingSummaries = useMemo(
    () => PASSWORD_RULES.filter((rule) => !passwordChecks[rule.key]).map((rule) => rule.label),
    [passwordChecks],
  );

  const passwordEntered = password.length > 0;
  const showPasswordFeedback = passwordEntered;
  const passwordMatches = confirmPassword.length === 0 ? null : password === confirmPassword;

  return (
    <div className="register-page">
      <div className="register-gradient" aria-hidden="true" />
      <span className="register-blob register-blob-one" aria-hidden="true" />
      <span className="register-blob register-blob-two" aria-hidden="true" />
      <span className="register-blob register-blob-three" aria-hidden="true" />

      <header className="register-header">
        <Link to="/" className="register-brand" aria-label="Brag Board home">
          <span className="register-brand-mark">Brag Board</span>
          <span className="register-brand-pill">Password reset</span>
        </Link>
        <Link to="/login" className="btn btn-outline register-header-cta">
          Back to login
        </Link>
      </header>

      <main className="register-main">
        <div className="register-grid">
          <section className={`register-hero ${isReady ? 'register-hero-enter' : ''}`}>
            <p className="register-kicker">Reset and rejoin</p>
            <h1 className="register-title">Secure your account with a stronger password.</h1>
            <p className="register-subtitle">
              Create a fresh password to keep your shoutouts, analytics, and teammate tags protected. You&rsquo;ll be back in the loop in seconds.
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
                <div className="register-stat-number">61%</div>
                <p className="register-stat-label">Users adopt stronger passwords after reset</p>
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
              <p className="register-stat-note">Security copilots make sure your recognition history stays yours.</p>
            </div>
          </section>

          <section className={`register-card register-card--reset ${isReady ? 'register-card-enter' : ''}`}>
            <div className="register-card-header">
              <h2>Reset your password</h2>
              <p>Enter a strong password and confirm it to secure your account.</p>
            </div>

            {message && (
              <div className="register-alert is-success" role="status">
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
                <label className="register-label" htmlFor="password">New password</label>
                <div className="register-password-field">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    className="register-input register-password-input"
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(event) => handlePasswordChange(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="register-password-toggle no-anim"
                    aria-label={showPassword ? 'Hide new password' : 'Show new password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>

                {showPasswordFeedback && (
                  <div className="register-password-feedback">
                    <div className={`register-strength-track ${passwordStrength.state}`}>
                      <div
                        className="register-strength-indicator"
                        style={{ width: `${passwordStrength.percentage}%` }}
                      />
                    </div>
                    {passwordStrength.state !== 'is-empty' && (
                      <p className={`register-strength-copy ${passwordStrength.state}`}>
                        {passwordStrength.label}
                      </p>
                    )}
                    <ul className="register-password-rules">
                      {PASSWORD_RULES.map((rule) => {
                        const satisfied = passwordChecks[rule.key];
                        return (
                          <li
                            key={rule.key}
                            className={`register-password-rule ${satisfied ? 'is-complete' : ''}`}
                          >
                            <span className="register-rule-indicator" aria-hidden="true" />
                            <span>{rule.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                    {passwordMissingSummaries.length > 0 && (
                      <p className="register-password-missing">
                        Missing: {passwordMissingSummaries.join(', ')}.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="register-field">
                <label className="register-label" htmlFor="confirmPassword">Confirm password</label>
                <div className="register-password-field">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    className="register-input register-password-input"
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="register-password-toggle no-anim"
                    aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {passwordMatches === false && (
                  <p className="register-helper register-helper--error">Passwords do not match yet.</p>
                )}
                {passwordMatches && (
                  <p className="register-helper register-helper--success">Passwords match.</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !token}
                className="btn btn-primary register-submit"
              >
                {loading ? 'Resetting…' : 'Reset password'}
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
