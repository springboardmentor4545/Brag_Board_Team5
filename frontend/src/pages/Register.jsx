import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PASSWORD_RULES = [
  { key: 'length', present: 'Includes at least 8 characters', missing: 'Add at least 8 characters', summary: '8 characters' },
  { key: 'upper', present: 'Contains an uppercase letter', missing: 'Add an uppercase letter', summary: 'uppercase letter' },
  { key: 'lower', present: 'Contains a lowercase letter', missing: 'Add a lowercase letter', summary: 'lowercase letter' },
  { key: 'number', present: 'Contains a number', missing: 'Add a number', summary: 'number' },
  { key: 'special', present: 'Contains a special character (!@#$ etc.)', missing: 'Add a special character (!@#$ etc.)', summary: 'special character' },
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
      barClass: 'bg-gray-300',
      textClass: 'text-gray-500 dark:text-gray-400',
    };
  }
  const percentage = Math.min(total, 5) * 20;
  if (total <= 2) {
    return {
      label: 'Password strength: Weak',
      percentage,
      barClass: 'bg-red-500',
      textClass: 'text-red-600 dark:text-red-400',
    };
  }
  if (total <= 4) {
    return {
      label: 'Password strength: Moderate',
      percentage,
      barClass: 'bg-yellow-500',
      textClass: 'text-yellow-600 dark:text-yellow-400',
    };
  }
  return {
    label: 'Password strength: Strong',
    percentage,
    barClass: 'bg-green-500',
    textClass: 'text-green-600 dark:text-green-400',
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
  const { register } = useAuth();
  const navigate = useNavigate();
  const handleSubmit = async (e) => {
    e.preventDefault();
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
      setError(detail || 'Registration failed');
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
  const passwordMissingSummaries = PASSWORD_RULES.filter((rule) => !passwordChecks[rule.key]).map((rule) => rule.summary);
  const passwordEntered = formData.password.length > 0;
  const showPasswordFeedback = passwordEntered;
  const showPasswordHints = passwordEntered && !passwordMeetsAll;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 py-12 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="absolute top-6 left-6 flex items-center space-x-2">
        <Link 
          to="/register" 
          className="text-blue-600 dark:text-blue-400 font-bold text-3xl"
        >
          Brag Board
        </Link>
       
      </div>
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            Create your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {success && (
            <div className="bg-green-100 dark:bg-green-900/40 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 px-4 py-3 rounded">
              {success}
            </div>
          )}
          {error && (
            <div className="bg-red-100 dark:bg-red-900/40 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div className="rounded-md shadow-sm space-y-4">
            <input
              name="name"
              type="text"
              required
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-800"
              placeholder="Full Name"
              value={formData.name}
              onChange={handleChange}
            />
            <input
              name="email"
              type="email"
              required
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-800"
              placeholder="Email address"
              value={formData.email}
              onChange={handleChange}
            />
            <div className="relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-800"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-xs font-medium text-blue-600 dark:text-blue-300"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {showPasswordFeedback && (
              <div className="mt-3 space-y-2">
                {!passwordMeetsAll && (
                  <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className={`h-2 transition-all duration-300 ${passwordStrength.barClass}`}
                      style={{ width: `${passwordStrength.percentage}%` }}
                    />
                  </div>
                )}
                {passwordEntered && !passwordMeetsAll && (
                  <p className={`text-xs font-semibold ${passwordStrength.textClass}`}>
                    {passwordStrength.label}
                  </p>
                )}
                {showPasswordHints && (
                  <>
                    <ul className="space-y-1">
                      {PASSWORD_RULES.map((rule) => {
                        const satisfied = passwordChecks[rule.key];
                        return (
                          <li
                            key={rule.key}
                            className={`text-xs flex items-center gap-2 ${satisfied ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                          >
                            <span
                              className={`inline-flex h-2 w-2 rounded-full ${satisfied ? 'bg-green-500' : 'bg-red-500'}`}
                              aria-hidden="true"
                            />
                            <span>{satisfied ? rule.present : rule.missing}</span>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-xs text-red-500 dark:text-red-400">
                      Missing: {passwordMissingSummaries.join(', ')}.
                    </p>
                  </>
                )}
              </div>
            )}
            <select
              name="department"
              required
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-800"
              value={formData.department}
              onChange={handleChange}
            >
              <option value="">Select Department</option>
              <option value="HR">HR</option>
              <option value="Finance">Finance</option>
              <option value="Marketing">Marketing</option>
              <option value="Product Development">Product Development</option>
              <option value="Quality Assurance">Quality Assurance</option>
              <option value="Security">Security</option>
            </select>
            {formData.department === 'HR' && (
              <>
                <select
                  name="role"
                  required
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-800"
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="employee">Employee (default)</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400">Choosing Admin grants elevated moderation and analytics access after email verification.</p>
              </>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full text-sm disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Sign up'}
            </button>
          </div>

          <div className="text-center">
            <Link to="/login" className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300">
              Already have an account? Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
