import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { UserDataProvider } from './context/UserDataContext';
import { I18nProvider } from './i18n';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Questionnaire from './pages/Questionnaire';
import FoodTracker from './pages/FoodTracker';
import Settings from './pages/Settings';
import Chatbot from './components/Chatbot';
import './App.css';

const protectedRoutes = [
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/questionnaire', element: <Questionnaire /> },
  { path: '/food-tracker', element: <FoodTracker /> },
  { path: '/settings', element: <Settings /> },
];

function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <AuthProvider>
          {/* Loads the signed-in user's settings and answers from Firestore */}
          <UserDataProvider>
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <div className="App">
                <Header />
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  {protectedRoutes.map(({ path, element }) => (
                    <Route key={path} path={path} element={<ProtectedRoute>{element}</ProtectedRoute>} />
                  ))}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                <Chatbot />
              </div>
            </Router>
          </UserDataProvider>
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

export default App;
