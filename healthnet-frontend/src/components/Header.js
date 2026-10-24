import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Search, User, Menu, X, ChevronDown, Bell, Settings, LogOut } from 'lucide-react';
import { useAuth, getDisplayName } from '../context/AuthContext';
import ComingSoonBadge from './ComingSoonBadge';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/questionnaire', label: 'Questionnaire' },
  { to: '/food-tracker', label: 'Food Tracker' }
];

const searchDatabase = [
  { name: 'Dashboard', path: '/dashboard', category: 'Page' },
  { name: 'Health Questionnaire', path: '/questionnaire', category: 'Page' },
  { name: 'Food Tracker', path: '/food-tracker', category: 'Page' },
  { name: 'Heart Rate Monitoring', path: '/dashboard', category: 'Feature' },
  { name: 'Blood Pressure Tracking', path: '/dashboard', category: 'Feature' },
  { name: 'Nutrition Analysis', path: '/food-tracker', category: 'Feature' },
  { name: 'AI Health Assessment', path: '/questionnaire', category: 'Feature' },
  { name: 'Health Reports', path: '/dashboard', category: 'Feature' }
];

const desktopLinkClass = ({ isActive }) =>
  `font-medium ${isActive ? 'text-indigo-600' : 'text-gray-700 hover:text-indigo-600'}`;

const mobileLinkClass = ({ isActive }) =>
  `block py-2 font-medium ${isActive ? 'text-indigo-600' : 'text-gray-700 hover:text-indigo-600'}`;

const Header = () => {
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef(null);
  const profileRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const filteredResults = searchDatabase.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close every menu when the page changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setShowProfileMenu(false);
    setShowSearch(false);
  }, [location.pathname]);

  // Close the search and profile panels on Escape or a click outside them
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearch(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setShowSearch(false);
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const goToResult = (path) => {
    setShowSearch(false);
    setSearchQuery('');
    navigate(path);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (filteredResults.length > 0) {
      goToResult(filteredResults[0].path);
    }
  };

  const handleLogout = async () => {
    setShowProfileMenu(false);
    await signOut();
    navigate('/');
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link to="/" className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="ml-2 text-xl font-bold text-gray-800">HealthNet</span>
        </Link>

        <nav className="hidden md:flex space-x-8">
          {navLinks.map(link => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} className={desktopLinkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Search */}
          <div className="relative" ref={searchRef}>
            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 text-gray-600 hover:text-indigo-600 transition-colors"
              aria-label="Search HealthNet"
              aria-expanded={showSearch}
            >
              <Search className="h-5 w-5" />
            </button>

            {showSearch && (
              <div className="absolute right-0 top-12 w-[calc(100vw-2rem)] max-w-sm sm:w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-4">
                <form onSubmit={handleSearchSubmit} className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search HealthNet..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    aria-label="Search pages and features"
                    autoFocus
                  />
                </form>

                {searchQuery && (
                  <div className="max-h-64 overflow-y-auto">
                    {filteredResults.length > 0 ? (
                      filteredResults.map((result) => (
                        <button
                          key={result.name}
                          type="button"
                          onClick={() => goToResult(result.path)}
                          className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <div className="font-medium text-gray-800">{result.name}</div>
                          <div className="text-sm text-gray-500">{result.category}</div>
                        </button>
                      ))
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        No results found for "{searchQuery}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notifications */}
          <button
            type="button"
            disabled
            title="Notifications (coming soon)"
            aria-label="Notifications (coming soon)"
            className="hidden sm:block p-2 text-gray-400 cursor-not-allowed"
          >
            <Bell className="h-5 w-5" />
          </button>

          {user ? (
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                className="flex items-center"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                aria-haspopup="menu"
                aria-expanded={showProfileMenu}
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-indigo-100 p-1">
                    <User className="h-6 w-6 text-indigo-600" />
                  </div>
                )}
                <span className="ml-2 hidden sm:inline text-sm font-medium text-gray-700">{getDisplayName(user)}</span>
                <ChevronDown className="h-4 w-4 ml-1 text-gray-500" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-12 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2" role="menu">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <div className="font-medium text-gray-800 truncate">{getDisplayName(user)}</div>
                    {user.email && <div className="text-sm text-gray-500 truncate">{user.email}</div>}
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    disabled
                    className="w-full text-left px-4 py-2 text-sm text-gray-400 flex items-center cursor-not-allowed"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Profile
                    <ComingSoonBadge className="ml-auto" />
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled
                    className="w-full text-left px-4 py-2 text-sm text-gray-400 flex items-center cursor-not-allowed"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                    <ComingSoonBadge className="ml-auto" />
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="whitespace-nowrap bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Sign in
            </Link>
          )}

          <button
            type="button"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6 text-gray-700" />
            ) : (
              <Menu className="h-6 w-6 text-gray-700" />
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav className="md:hidden bg-white py-2 px-4 border-t border-gray-200">
          {navLinks.map(link => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} className={mobileLinkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
};

export default Header;
