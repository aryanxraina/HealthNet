import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, User, Menu, X, ChevronDown, Bell, Settings, LogOut } from 'lucide-react';

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();

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

  const filteredResults = searchDatabase.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchResultClick = (path) => {
    window.location.href = path;
    setShowSearch(false);
    setSearchQuery('');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setShowProfileMenu(false);
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center">
          <div className="h-8 w-8 text-indigo-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="ml-2 text-xl font-bold text-gray-800">HealthNet</span>
        </div>
        
        <nav className="hidden md:flex space-x-8">
          <Link to="/" className={`font-medium ${location.pathname === '/' ? 'text-indigo-600' : 'text-gray-700 hover:text-indigo-600'}`}>
            Home
          </Link>
          <Link to="/dashboard" className={`font-medium ${location.pathname === '/dashboard' ? 'text-indigo-600' : 'text-gray-700 hover:text-indigo-600'}`}>
            Dashboard
          </Link>
          <Link to="/questionnaire" className={`font-medium ${location.pathname === '/questionnaire' ? 'text-indigo-600' : 'text-gray-700 hover:text-indigo-600'}`}>
            Questionnaire
          </Link>
          <Link to="/food-tracker" className={`font-medium ${location.pathname === '/food-tracker' ? 'text-indigo-600' : 'text-gray-700 hover:text-indigo-600'}`}>
            Food Tracker
          </Link>
        </nav>
        
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="relative">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 text-gray-600 hover:text-indigo-600 transition-colors"
            >
              <Search className="h-5 w-5" />
            </button>
            
            {showSearch && (
              <div className="absolute right-0 top-12 w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-4">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search HealthNet..."
                    value={searchQuery}
                    onChange={handleSearch}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
                
                {searchQuery && (
                  <div className="max-h-64 overflow-y-auto">
                    {filteredResults.length > 0 ? (
                      filteredResults.map((result, index) => (
                        <button
                          key={index}
                          onClick={() => handleSearchResultClick(result.path)}
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
          <button className="p-2 text-gray-600 hover:text-indigo-600 transition-colors relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
              3
            </span>
          </button>

          {isLoggedIn ? (
            <div className="relative">
              <div
                className="flex items-center cursor-pointer"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                <div className="h-8 w-8 rounded-full bg-indigo-100 p-1">
                  <User className="h-6 w-6 text-indigo-600" />
                </div>
                <span className="ml-2 text-sm font-medium text-gray-700">Rahul Sharma</span>
                <ChevronDown className="h-4 w-4 ml-1 text-gray-500" />
              </div>
              
              {showProfileMenu && (
                <div className="absolute right-0 top-12 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <div className="font-medium text-gray-800">Rahul Sharma</div>
                    <div className="text-sm text-gray-500">rahul@healthnet.com</div>
                  </div>
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    Profile
                  </button>
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsLoggedIn(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Login
            </button>
          )}
          
          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
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
        <div className="md:hidden bg-white py-2 px-4 border-t border-gray-200">
          <Link to="/" className="block py-2 text-indigo-600 font-medium">Home</Link>
          <Link to="/dashboard" className="block py-2 text-gray-700 hover:text-indigo-600 font-medium">Dashboard</Link>
          <Link to="/questionnaire" className="block py-2 text-gray-700 hover:text-indigo-600 font-medium">Questionnaire</Link>
          <Link to="/food-tracker" className="block py-2 text-gray-700 hover:text-indigo-600 font-medium">Food Tracker</Link>
        </div>
      )}
    </header>
  );
};

export default Header; 