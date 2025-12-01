import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../App.css';

const PASSWORD_RULES = [
  { key: 'length', present: 'Includes at least 8 characters', missing: 'Add at least 8 characters', summary: '8 characters' },
  { key: 'upper', present: 'Contains an uppercase letter', missing: 'Add an uppercase letter', summary: 'uppercase letter' },
  { key: 'lower', present: 'Contains a lowercase letter', missing: 'Add a lowercase letter', summary: 'lowercase letter' },
  { key: 'number', present: 'Contains a number', missing: 'Add a number', summary: 'number' },
  { key: 'special', present: 'Contains a special character (!@#$ etc.)', missing: 'Add a special character (!@#$ etc.)', summary: 'special character' },
];

const HERO_FEATURES = [
  {
    title: 'Celebrate wins in real time',
    description: 'Broadcast achievements across teams with animated shoutouts that spark instant reactions.',
  },
  {
    title: 'Collect rich engagement analytics',
    description: 'Spot trending contributors, track department pulse, and unlock insights your leaders will love.',
  },
  {
    title: 'Launch in minutes with smart automations',
    description: 'Auto-tag teammates, schedule follow-ups, and let nudges keep the recognition loop alive.',
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

const emailIsValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
    role: 'employee',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordChecks, setPasswordChecks] = useState(() => evaluatePassword(''));
  const [passwordStrength, setPasswordStrength] = useState(() => determineStrength(evaluatePassword('')));
  const [isReady, setIsReady] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const { register } = useAuth();
  const navigate = useNavigate();
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
    setSuccess('');

    const name = formData.name.trim();
    const email = formData.email.trim();
    const password = formData.password.trim();
    const department = formData.department.trim();
    const role = department === 'HR'
      ? ((formData.role || '').trim() || 'employee')
      : 'employee';

    if (!name) {
      setError('Full name is required.');
      return;
    }
    if (!emailIsValid(email)) {
      setError('Enter a valid email address.');
      return;
    }
    const latestPasswordChecks = evaluatePassword(password);
    setPasswordChecks(latestPasswordChecks);
    setPasswordStrength(determineStrength(latestPasswordChecks));
    if (Object.values(latestPasswordChecks).some((flag) => !flag)) {
      setError('Password must include at least 8 characters, plus uppercase, lowercase, number, and special character.');
      return;
    }
    if (!department) {
      setError('Please select a department.');
      return;
    }
    if (department === 'HR' && !role) {
      setError('Please choose a role.');
      return;
    }
    setLoading(true);

    try {
      const payload = {
        ...formData,
        name,
        email: email.toLowerCase(),
        password,
        department,
        role,
      };
      const res = await register(payload);
      if (res?.requires_verification) {
        setSuccess(res?.message || 'Registration successful. Please check your email to verify your account.');
        // Optionally redirect to login after a short delay
        // setTimeout(() => navigate('/login'), 3000);
      } else {
        navigate('/');
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message;
      setError(detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const nextState = { ...prev, [name]: value };
      if (name === 'department' && value !== 'HR') {
        nextState.role = 'employee';
      }
      return nextState;
    });
    if (name === 'password') {
      const nextChecks = evaluatePassword(value);
      setPasswordChecks(nextChecks);
      setPasswordStrength(determineStrength(nextChecks));
    }
  };

  const passwordMeetsAll = Object.values(passwordChecks).every(Boolean);
  const passwordMissingSummaries = useMemo(
    () => PASSWORD_RULES.filter((rule) => !passwordChecks[rule.key]).map((rule) => rule.summary),
    [passwordChecks],
  );
  const passwordEntered = formData.password.length > 0;
  const showPasswordFeedback = passwordEntered;
  const showPasswordHints = passwordEntered && !passwordMeetsAll;

  return (
    <div className="register-page">
      <div className="register-gradient" aria-hidden="true" />
      <span className="register-blob register-blob-one" aria-hidden="true" />
      <span className="register-blob register-blob-two" aria-hidden="true" />
      <span className="register-blob register-blob-three" aria-hidden="true" />

      <header className="register-header">
        <Link to="/" className="register-brand" aria-label="Brag Board home">
          <span className="register-brand-mark">Brag Board</span>
          <span className="register-brand-pill">Social recognition platform</span>
        </Link>
        <Link to="/login" className="btn btn-outline register-header-cta">
          Sign in
        </Link>
      </header>

      <main className="register-main">
        <div className="register-grid">
          <section className={`register-hero ${isReady ? 'register-hero-enter' : ''}`}>
            <p className="register-kicker">Team culture platform</p>
            <h1 className="register-title">Light up your team&apos;s wins with social shoutouts.</h1>
            <p className="register-subtitle">
              Spark momentum with an internal feed that keeps recognition loud, visible, and impossible to miss.
              Invite your crew, automate nudges, and let the celebrations roll.
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
                <div className="register-stat-number">92%</div>
                <p className="register-stat-label">Average engagement after launch</p>
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
              <p className="register-stat-note">Join teams in 52 countries building recognition rituals that stick.</p>
            </div>
          </section>

          <section className={`register-card ${isReady ? 'register-card-enter' : ''}`}>
            <div className="register-card-header">
              <h2>Create your account</h2>
              <p>Free to get started. No credit card required.</p>
            </div>

            {success && (
              <div className="register-alert is-success" role="status">
                {success}
              </div>
            )}
            {error && (
              <div className="register-alert is-error" role="alert">
                {error}
              </div>
            )}

            <form className="register-form" onSubmit={handleSubmit}>
              <div className="register-field">
                <label className="register-label" htmlFor="name">Full name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  className="register-input"
                  placeholder="Alex Rivera"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>

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
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>

              <div className="register-field">
                <label className="register-label" htmlFor="password">Password</label>
                <div className="register-password-field">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    className="register-input register-password-input"
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChange={handleChange}
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

                {showPasswordFeedback && (
                  <div className="register-password-feedback">
                    <div className={`register-strength-track ${passwordStrength.state}`}>
                      <div
                        className="register-strength-indicator"
                        style={{ width: `${passwordStrength.percentage}%` }}
                      />
                    </div>
                    {!passwordMeetsAll && (
                      <p className={`register-strength-copy ${passwordStrength.state}`}>
                        {passwordStrength.label}
                      </p>
                    )}
                    {showPasswordHints && (
                      <>
                        <ul className="register-password-rules">
                          {PASSWORD_RULES.map((rule) => {
                            const satisfied = passwordChecks[rule.key];
                            return (
                              <li
                                key={rule.key}
                                className={`register-password-rule ${satisfied ? 'is-complete' : ''}`}
                              >
                                <span className="register-rule-indicator" aria-hidden="true" />
                                <span>{satisfied ? rule.present : rule.missing}</span>
                              </li>
                            );
                          })}
                        </ul>
                        <p className="register-password-missing">
                          Missing: {passwordMissingSummaries.join(', ')}.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="register-field">
                <label className="register-label" htmlFor="department">Department</label>
                <select
                  id="department"
                  name="department"
                  required
                  className="register-select"
                  value={formData.department}
                  onChange={handleChange}
                >
                  <option value="">Select department</option>
                  <option value="HR">HR</option>
                  <option value="Finance">Finance</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Product Development">Product Development</option>
                  <option value="Quality Assurance">Quality Assurance</option>
                  <option value="Security">Security</option>
                </select>
              </div>

              {formData.department === 'HR' && (
                <div className="register-field">
                  <label className="register-label" htmlFor="role">Role</label>
                  <select
                    id="role"
                    name="role"
                    required
                    className="register-select"
                    value={formData.role}
                    onChange={handleChange}
                  >
                    <option value="employee">Employee (default)</option>
                    <option value="admin">Admin</option>
                  </select>
                  <p className="register-helper">Admins unlock moderation, analytics, and launch templates once verified.</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary register-submit"
              >
                {loading ? 'Creating account...' : 'Create free account'}
              </button>
            </form>

            <div className="register-divider" aria-hidden="true" />

            <p className="register-terms">
              By continuing, you agree to our{' '}
              <Link to="/" className="register-inline-link">Terms</Link>{' '}
              and{' '}
              <Link to="/" className="register-inline-link">Privacy Policy</Link>.
            </p>

            <p className="register-footer-link">
              Already have an account?{' '}
              <Link to="/login" className="register-inline-link">Sign in</Link>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
