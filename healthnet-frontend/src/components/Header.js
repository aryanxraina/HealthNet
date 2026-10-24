import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Search, User, Menu, X, ChevronDown, Bell, Settings, LogOut } from 'lucide-react';
import { useAuth, getDisplayName } from '../context/AuthContext';
import { useTranslation } from '../i18n';

const navLinks = [
  { to: '/', labelKey: 'nav.home' },
  { to: '/dashboard', labelKey: 'nav.dashboard' },
  { to: '/questionnaire', labelKey: 'nav.questionnaire' },
  { to: '/food-tracker', labelKey: 'nav.foodTracker' }
];

const searchDatabase = [
  { nameKey: 'search.dashboard', path: '/dashboard', categoryKey: 'header.categoryPage' },
  { nameKey: 'search.questionnaire', path: '/questionnaire', categoryKey: 'header.categoryPage' },
  { nameKey: 'search.foodTracker', path: '/food-tracker', categoryKey: 'header.categoryPage' },
  { nameKey: 'search.settings', path: '/settings', categoryKey: 'header.categoryPage' },
  { nameKey: 'search.heartRate', path: '/dashboard', categoryKey: 'header.categoryFeature' },
  { nameKey: 'search.bloodPressure', path: '/dashboard', categoryKey: 'header.categoryFeature' },
  { nameKey: 'search.nutrition', path: '/food-tracker', categoryKey: 'header.categoryFeature' },
  { nameKey: 'search.assessment', path: '/questionnaire', categoryKey: 'header.categoryFeature' },
  { nameKey: 'search.reports', path: '/dashboard', categoryKey: 'header.categoryFeature' }
];

const desktopLinkClass = ({ isActive }) =>
  `font-medium ${
    isActive
      ? 'text-indigo-600 dark:text-indigo-400'
      : 'text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400'
  }`;

const mobileLinkClass = (args) => `block py-2 ${desktopLinkClass(args)}`;

const menuItemClass =
  'w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center';

const Header = () => {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef(null);
  const profileRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const filteredResults = searchDatabase.filter(item =>
    t(item.nameKey).toLowerCase().includes(searchQuery.toLowerCase())
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

  const goTo = (path) => {
    setShowSearch(false);
    setShowProfileMenu(false);
    setSearchQuery('');
    navigate(path);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (filteredResults.length > 0) {
      goTo(filteredResults[0].path);
    }
  };

  const handleLogout = async () => {
    setShowProfileMenu(false);
    await signOut();
    navigate('/');
  };

  return (
    <header className="bg-white dark:bg-slate-900 shadow-sm dark:shadow-none dark:border-b dark:border-slate-800 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link to="/" className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="ml-2 text-xl font-bold text-gray-800 dark:text-gray-100">HealthNet</span>
        </Link>

        <nav className="hidden md:flex space-x-8">
          {navLinks.map(link => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} className={desktopLinkClass}>
              {t(link.labelKey)}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Search */}
          <div className="relative" ref={searchRef}>
            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              aria-label={t('header.openSearch')}
              aria-expanded={showSearch}
            >
              <Search className="h-5 w-5" />
            </button>

            {showSearch && (
              <div className="absolute right-0 top-12 w-[calc(100vw-2rem)] max-w-sm sm:w-80 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 p-4">
                <form onSubmit={handleSearchSubmit} className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t('header.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    aria-label={t('header.searchLabel')}
                    autoFocus
                  />
                </form>

                {searchQuery && (
                  <div className="max-h-64 overflow-y-auto">
                    {filteredResults.length > 0 ? (
                      filteredResults.map((result) => (
                        <button
                          key={result.nameKey}
                          type="button"
                          onClick={() => goTo(result.path)}
                          className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <div className="font-medium text-gray-800 dark:text-gray-100">{t(result.nameKey)}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{t(result.categoryKey)}</div>
                        </button>
                      ))
                    ) : (
                      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                        {t('header.noResults', { query: searchQuery })}
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
            title={t('header.notifications')}
            aria-label={t('header.notifications')}
            className="hidden sm:block p-2 text-gray-400 dark:text-gray-500 cursor-not-allowed"
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
                  <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 p-1">
                    <User className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
                  </div>
                )}
                <span className="ml-2 hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-200">{getDisplayName(user)}</span>
                <ChevronDown className="h-4 w-4 ml-1 text-gray-500 dark:text-gray-400" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-12 w-56 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-2" role="menu">
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-800">
                    <div className="font-medium text-gray-800 dark:text-gray-100 truncate">{getDisplayName(user)}</div>
                    {user.email && <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</div>}
                  </div>
                  <button type="button" role="menuitem" onClick={() => goTo('/settings#profile')} className={menuItemClass}>
                    <User className="h-4 w-4 mr-2" />
                    {t('header.profile')}
                  </button>
                  <button type="button" role="menuitem" onClick={() => goTo('/settings')} className={menuItemClass}>
                    <Settings className="h-4 w-4 mr-2" />
                    {t('header.settings')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    {t('header.signOut')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="whitespace-nowrap bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              {t('header.signIn')}
            </Link>
          )}

          <button
            type="button"
            className="md:hidden text-gray-700 dark:text-gray-200"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={t('header.toggleMenu')}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav className="md:hidden bg-white dark:bg-slate-900 py-2 px-4 border-t border-gray-200 dark:border-slate-700">
          {navLinks.map(link => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} className={mobileLinkClass}>
              {t(link.labelKey)}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
};

export default Header;
