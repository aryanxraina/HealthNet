import React, { useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ERROR_MESSAGES = {
  'app/not-configured': "Sign-in isn't available until the Firebase keys are added (see the note above).",
  'auth/configuration-not-found': "Firebase Authentication isn't turned on for this project yet. In the Firebase console, open Authentication, click \"Get started\", then enable Email/Password and Google.",
  'auth/invalid-api-key': 'Firebase rejected the API key. Check REACT_APP_FIREBASE_API_KEY in .env.local (no quotes or commas), then restart the app.',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Firebase rejected the API key. Check REACT_APP_FIREBASE_API_KEY in .env.local (no quotes or commas), then restart the app.',
  'auth/invalid-credential': "That email and password don't match an account. Check them, or create an account if you're new.",
  'auth/wrong-password': "That email and password don't match an account. Check them, or create an account if you're new.",
  'auth/user-not-found': "That email and password don't match an account. Check them, or create an account if you're new.",
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/missing-password': 'Please enter your password.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
  'auth/weak-password': 'Please choose a password with at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/popup-closed-by-user': 'The Google sign-in window was closed before finishing.',
  'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups and try again.',
  'auth/operation-not-allowed': "This sign-in method isn't enabled in Firebase yet.",
  'auth/unauthorized-domain': "This site's domain isn't authorized for sign-in yet. Add it in Firebase Authentication settings.",
};

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
);

const Login = () => {
  const { user, isConfigured, signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [mode, setMode] = useState(searchParams.get('mode') === 'signup' ? 'signup' : 'signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isSignUp = mode === 'signup';
  const from = location.state?.from;
  const redirectTo = from ? `${from.pathname}${from.search || ''}` : '/dashboard';

  // Signing in updates `user`, which sends people back to the page they wanted
  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  const runAction = async (action) => {
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      await action();
    } catch (err) {
      if (err.code !== 'auth/cancelled-popup-request') {
        // Show the code for anything unexpected so it can be looked up
        setError(ERROR_MESSAGES[err.code] || `Something went wrong${err.code ? ` (${err.code})` : ''}. Please try again.`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    runAction(() =>
      isSignUp ? signUp(name.trim(), email.trim(), password) : signIn(email.trim(), password)
    );
  };

  const handleForgotPassword = () => {
    if (!email.trim()) {
      setNotice('');
      setError('Enter your email address above, then choose "Forgot password?" again.');
      return;
    }
    runAction(async () => {
      await resetPassword(email.trim());
      setNotice(`If an account exists for ${email.trim()}, a password reset link is on its way.`);
    });
  };

  const switchMode = () => {
    setMode(isSignUp ? 'signin' : 'signup');
    setError('');
    setNotice('');
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 dark:bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 text-center">
          {isSignUp ? 'Create your account' : 'Sign in to HealthNet'}
        </h1>
        <p className="mt-2 text-center text-gray-600 dark:text-gray-300">
          {isSignUp ? 'Start tracking and understanding your health.' : 'Welcome back! Sign in to continue.'}
        </p>

        {!isConfigured && (
          <div className="mt-6 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-200">
            Sign-in isn't set up yet. Add your Firebase keys to <code>healthnet-frontend/.env.local</code> (see{' '}
            <code>.env.example</code>) and restart the app.
          </div>
        )}

        <button
          type="button"
          onClick={() => runAction(signInWithGoogle)}
          disabled={submitting}
          className="mt-6 w-full flex items-center justify-center gap-3 border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2.5 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-sm text-gray-400">
          <span className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
          or
          <span className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Full name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Password</label>
              {!isSignUp && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              minLength={6}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {isSignUp && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">At least 6 characters.</p>}
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>
          )}
          {notice && (
            <p role="status" className="rounded-lg bg-green-50 dark:bg-green-950/40 p-3 text-sm text-green-700 dark:text-green-400">{notice}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-300">
          {isSignUp ? 'Already have an account?' : 'New to HealthNet?'}{' '}
          <button type="button" onClick={switchMode} className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300">
            {isSignUp ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </div>
    </main>
  );
};

export default Login;
