import React, { useState, useEffect } from 'react';

// --- Configuration ---
// Make sure this matches the URL of your FastAPI backend
const API_URL = 'http://127.0.0.1:8000';

/**
 * Main application component.
 * Manages state for authentication and view rendering.
 */
function App() {
  // 'view' controls which page to show: 'login', 'register', or 'dashboard'
  const [view, setView] = useState('login');
  
  // 'token' stores the JWT.
  const [token, setToken] = useState(null);
  
  // 'userData' stores details of the logged-in user
  const [userData, setUserData] = useState(null);
  
  // 'error' stores login/registration error messages
  const [error, setError] = useState('');

  // Effect to fetch user data whenever the token changes
  useEffect(() => {
    if (token) {
      fetchUserData(token);
    } else {
      // If token is null, reset user data and show login page
      setUserData(null);
      setView('login');
    }
  }, [token]);

  /**
   * Fetches the current user's data from the /users/me endpoint.
   * @param {string} currentToken - The JWT to use for authentication.
   */
  const fetchUserData = async (currentToken) => {
    try {
      const response = await fetch(`${API_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${currentToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserData(data);
        setView('dashboard'); // Show dashboard on successful fetch
        setError('');
      } else {
        // If token is invalid or expired, log out
        console.error('Failed to fetch user data:', response.statusText);
        handleLogout();
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError('Could not connect to server.');
      handleLogout();
    }
  };

  /**
   * Logs the user out by clearing the token.
   */
  const handleLogout = () => {
    setToken(null);
  };

  /**
   * Renders the correct component based on the current 'view' state.
   */
  const renderView = () => {
    switch (view) {
      case 'login':
        return (
          <LoginPage 
            onLoginSuccess={(newToken) => setToken(newToken)} 
            onGoToRegister={() => setView('register')}
            onError={setError}
            error={error}
          />
        );
      case 'register':
        return (
          <RegisterPage 
            onRegisterSuccess={() => {
              setView('login');
              setError('Registration successful! Please log in.');
            }} 
            onGoToLogin={() => setView('login')}
            onError={setError}
            error={error}
          />
        );
      case 'dashboard':
        return (
          <DashboardPage 
            userData={userData} 
            token={token}
            onLogout={handleLogout} 
          />
        );
      default:
        return (
          <LoginPage 
            onLoginSuccess={(newToken) => setToken(newToken)} 
            onGoToRegister={() => setView('register')}
            onError={setError}
            error={error}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900">
      <main className="flex flex-col items-center justify-center min-h-screen p-4">
        {renderView()}
      </main>
    </div>
  );
}

// --- Components ---

/**
 * Login Page Component
 */
function LoginPage({ onLoginSuccess, onGoToRegister, onError, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    onError(''); // Clear previous errors
    
    // FastAPI's OAuth2PasswordRequestForm expects form data
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    try {
      const response = await fetch(`${API_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        onLoginSuccess(data.access_token);
      } else {
        const errData = await response.json();
        onError(errData.detail || 'Login failed. Please check credentials.');
      }
    } catch (err) {
      console.error('Login error:', err);
      onError('Could not connect to server.');
    }
  };

  return (
    <AuthCard>
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Welcome Back</h2>
      {error && <ErrorMessage message={error} />}
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput 
          label="Email"
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <FormInput 
          label="Password"
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button 
          type="submit" 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-300 ease-in-out"
        >
          Sign In
        </button>
      </form>
      <p className="text-sm text-center text-gray-600 mt-6">
        Don't have an account?{' '}
        <button 
          onClick={onGoToRegister} 
          className="font-medium text-blue-600 hover:text-blue-500"
        >
          Sign Up
        </button>
      </p>
    </AuthCard>
  );
}

/**
 * Register Page Component
 */
function RegisterPage({ onRegisterSuccess, onGoToLogin, onError, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState('employee'); // Default role

  const handleSubmit = async (e) => {
    e.preventDefault();
    onError('');

    const newUser = {
      email,
      password,
      name,
      department: department || null, // Send null if empty
      role,
    };

    try {
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
      });

      if (response.ok) {
        onRegisterSuccess();
      } else {
        const errData = await response.json();
        onError(errData.detail || 'Registration failed.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      onError('Could not connect to server.');
    }
  };

  return (
    <AuthCard>
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Create Account</h2>
      {error && <ErrorMessage message={error} />}
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput 
          label="Name"
          id="register-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <FormInput 
          label="Email"
          id="register-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <FormInput 
          label="Password"
          id="register-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <FormInput 
          label="Department (e.g., Sales, Engineering)"
          id="register-department"
          type="text"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        />
        <div>
          <label htmlFor="register-role" className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <select
            id="register-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button 
          type="submit" 
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition duration-300 ease-in-out"
        >
          Sign Up
        </button>
      </form>
      <p className="text-sm text-center text-gray-600 mt-6">
        Already have an account?{' '}
        <button 
          onClick={onGoToLogin} 
          className="font-medium text-blue-600 hover:text-blue-500"
        >
          Sign In
        </button>
      </p>
    </AuthCard>
  );
}

/**
 * Dashboard Page Component
 */
function DashboardPage({ userData, token, onLogout }) {
  const [deptData, setDeptData] = useState(null);
  const [deptError, setDeptError] = useState('');
  const [adminData, setAdminData] = useState(null);
  const [adminError, setAdminError] = useState('');

  // Fetch department data
  const fetchDeptData = async () => {
    setDeptError('');
    try {
      const response = await fetch(`${API_URL}/department/data`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setDeptData(data);
      } else {
        const err = await response.json();
        setDeptError(err.detail || "Could not fetch department data.");
      }
    } catch (err) {
      setDeptError('Could not connect to server.');
    }
  };

  // Fetch admin data (only if user is admin)
  const fetchAdminData = async () => {
    setAdminError('');
    try {
      const response = await fetch(`${API_URL}/admin/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAdminData(data);
      } else {
        const err = await response.json();
        setAdminError(err.detail || "Could not fetch admin data.");
      }
    } catch (err) {
      setAdminError('Could not connect to server.');
    }
  };

  if (!userData) {
    return (
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
        <p className="text-center text-gray-700">Loading user data...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl p-8 space-y-6 bg-white rounded-xl shadow-lg">
      <div className="flex justify-between items-center border-b pb-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Welcome, {userData.name}!
        </h1>
        <button 
          onClick={onLogout}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition duration-300 ease-in-out"
        >
          Sign Out
        </button>
      </div>

      {/* User Info Card */}
      <div className="bg-gray-50 p-6 rounded-lg shadow-inner">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">Your Profile</h3>
        <div className="space-y-2">
          <InfoRow label="Email" value={userData.email} />
          <InfoRow label="Department" value={userData.department || 'Not Assigned'} />
          <InfoRow label="Role" value={userData.role} />
          <InfoRow label="Joined" value={new Date(userData.joined_at).toLocaleDateString()} />
        </div>
      </div>
      
      {/* Department Data Section */}
      <div className="bg-gray-50 p-6 rounded-lg shadow-inner">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">Department Data</h3>
        <button
          onClick={fetchDeptData}
          className="mb-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        >
          Fetch Department Data
        </button>
        {deptError && <ErrorMessage message={deptError} />}
        {deptData && (
          <div className="p-4 bg-white rounded shadow">
            <h4 className="font-bold">{deptData.message}</h4>
            <ul className="list-disc list-inside mt-2 text-gray-700">
              {deptData.data && deptData.data.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Admin Data Section (Conditional) */}
      {userData.role === 'admin' && (
        <div className="bg-blue-50 p-6 rounded-lg shadow-inner border border-blue-200">
          <h3 className="text-xl font-semibold text-blue-800 mb-4">Admin Panel</h3>
          <button
            onClick={fetchAdminData}
            className="mb-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition"
          >
            Fetch Admin Data
          </button>
          {adminError && <ErrorMessage message={adminError} />}
          {adminData && (
            <div className="p-4 bg-white rounded shadow">
              <h4 className="font-bold text-green-800">{adminData.message}</h4>
              <ul className="list-disc list-inside mt-2 text-gray-700">
                {adminData.admin_data && adminData.admin_data.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Helper Components ---

/**
 * A reusable card wrapper for the auth forms.
 */
function AuthCard({ children }) {
  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
      {children}
    </div>
  );
}

/**
 * A reusable form input component.
 */
function FormInput({ label, id, type, value, onChange, required = false }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={type === 'password' ? 'current-password' : 'email'}
        required={required}
        value={value}
        onChange={onChange}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}

/**
 * A reusable component to display error messages.
 */
function ErrorMessage({ message }) {
  return (
    <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-lg" role="alert">
      <p>{message}</p>
    </div>
  );
}

/**
* A reusable component for displaying a row of info.
*/
function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="font-medium text-gray-600">{label}:</span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
}

export default App;
