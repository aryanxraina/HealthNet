import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

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
    setShowSearchResults(e.target.value.length > 0);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setShowProfileMenu(false);
  };

  return (
    <div>
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="ml-2 text-xl font-bold text-gray-800">HealthNet</span>
          </div>
          
          <nav className="hidden md:flex space-x-8">
            <Link to="/" className="text-indigo-600 font-medium">Home</Link>
            <Link to="/dashboard" className="text-gray-700 hover:text-indigo-600 font-medium">Dashboard</Link>
            <Link to="/questionnaire" className="text-gray-700 hover:text-indigo-600 font-medium">Questionnaire</Link>
            <Link to="/food-tracker" className="text-gray-700 hover:text-indigo-600 font-medium">Food Tracker</Link>
          </nav>
          
          {/* Universal Search */}
          <div className="relative hidden md:block">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search HealthNet..." 
                value={searchQuery}
                onChange={handleSearch}
                className="w-64 lg:w-80 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                aria-label="Search HealthNet features and content"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fas fa-search text-gray-400" aria-hidden="true"></i>
              </div>
            </div>
            
            {/* Search Results Dropdown */}
            {showSearchResults && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                {filteredResults.map((result, index) => (
                  <Link
                    key={index}
                    to={result.path}
                    className="block px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    onClick={() => {
                      setShowSearchResults(false);
                      setSearchQuery('');
                    }}
                  >
                    <div className="font-medium text-gray-800">{result.name}</div>
                    <div className="text-sm text-gray-500">{result.category}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            {isLoggedIn ? (
              <div className="relative">
                <div 
                  className="flex items-center cursor-pointer" 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                >
                  <img 
                    src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXVzZXItY2lyY2xlIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTAiIHI9IjMiLz48cGF0aCBkPSJNNyAyMXYtMmE0IDQgMCAwIDEgNC00aDJhNCA0IDAgMCAxIDQgNHYyIi8+PC9zdmc+" 
                    alt="Profile" 
                    className="h-8 w-8 rounded-full bg-gray-200 p-1"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">Rahul Sharma</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {showProfileMenu && (
                  <div className="absolute right-4 mt-2 w-48 bg-white rounded-md shadow-lg py-1">
                    <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Your Profile</a>
                    <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Health Records</a>
                    <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Settings</a>
                    <hr className="my-1" />
                    <button 
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button 
                onClick={() => setIsLoggedIn(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
              >
                Login
              </button>
            )}
            <button 
              className="md:hidden" 
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              aria-label="Toggle mobile menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="md:hidden bg-white py-2 px-4">
            <Link to="/" className="block py-2 text-indigo-600 font-medium">Home</Link>
            <Link to="/dashboard" className="block py-2 text-gray-700 hover:text-indigo-600 font-medium">Dashboard</Link>
            <Link to="/questionnaire" className="block py-2 text-gray-700 hover:text-indigo-600 font-medium">Questionnaire</Link>
            <Link to="/food-tracker" className="block py-2 text-gray-700 hover:text-indigo-600 font-medium">Food Tracker</Link>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-1/2 mb-8 md:mb-0">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">AI-Powered Preventive Healthcare for Every Indian</h1>
              <p className="text-lg md:text-xl mb-8 text-indigo-100">Leveraging India's Digital Public Infrastructure to predict, prevent, and manage health risks before they become serious.</p>
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <Link to="/questionnaire" className="bg-white text-indigo-700 px-6 py-3 rounded-lg font-medium hover:bg-indigo-50 transition text-center">Get Started</Link>
                <button className="border border-white text-white px-6 py-3 rounded-lg font-medium hover:bg-white hover:bg-opacity-10 transition">Learn More</button>
              </div>
            </div>
            <div className="md:w-1/2 flex justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-full max-w-md" viewBox="0 0 800 600" fill="none">
                <rect x="100" y="100" width="600" height="400" rx="20" fill="#ffffff" fillOpacity="0.1"/>
                <circle cx="400" cy="300" r="150" fill="#ffffff" fillOpacity="0.1"/>
                <path d="M300 300C300 250 350 200 400 200C450 200 500 250 500 300C500 350 450 400 400 400C350 400 300 350 300 300Z" stroke="white" strokeWidth="8"/>
                <path d="M400 200V150" stroke="white" strokeWidth="8" strokeLinecap="round"/>
                <path d="M400 450V400" stroke="white" strokeWidth="8" strokeLinecap="round"/>
                <path d="M500 300H550" stroke="white" strokeWidth="8" strokeLinecap="round"/>
                <path d="M250 300H300" stroke="white" strokeWidth="8" strokeLinecap="round"/>
                <circle cx="400" cy="300" r="20" fill="white"/>
                <path d="M380 250L420 350" stroke="white" strokeWidth="8" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Integration with DPI Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Seamlessly Integrated with India's Digital Public Infrastructure</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">HealthNet leverages national digital assets to provide a secure, efficient, and personalized healthcare experience.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-md transition-all duration-300 card-hover border border-gray-100">
              <div className="feature-icon mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">ABHA Integration</h3>
              <p className="text-gray-600 mb-4">Connect your Ayushman Bharat Health Account for seamless access to your health records across healthcare providers.</p>
              <button className="text-indigo-600 font-medium flex items-center">
                Link ABHA ID
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border border-gray-100">
              <div className="bg-indigo-100 rounded-full p-3 mb-4 inline-flex">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">DigiLocker Access</h3>
              <p className="text-gray-600 mb-4">Securely store and access your medical reports, prescriptions, and health documents through DigiLocker integration.</p>
              <button className="text-indigo-600 font-medium flex items-center">
                Connect DigiLocker
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border border-gray-100">
              <div className="bg-indigo-100 rounded-full p-3 mb-4 inline-flex">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">UPI Payments</h3>
              <p className="text-gray-600 mb-4">Hassle-free payment for consultations, health packages, and medications through secure UPI integration.</p>
              <button className="text-indigo-600 font-medium flex items-center">
                Setup UPI
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">AI-Powered Health Monitoring & Risk Prediction</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">Our platform uses advanced AI algorithms to analyze your health data and provide personalized insights and recommendations.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-indigo-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Health Risk Assessment</h3>
              <p className="text-gray-600">AI-powered analysis of your health data to identify potential risks and provide personalized prevention strategies.</p>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-indigo-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Continuous Monitoring</h3>
              <p className="text-gray-600">Track vital health parameters over time with smart alerts for any concerning changes or trends.</p>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-indigo-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Personalized Recommendations</h3>
              <p className="text-gray-600">Receive customized health advice, diet plans, and lifestyle modifications based on your unique health profile.</p>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-indigo-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Health Reminders</h3>
              <p className="text-gray-600">Smart reminders for medications, check-ups, vaccinations, and other preventive health measures.</p>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-indigo-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Care Coordination</h3>
              <p className="text-gray-600">Connect with healthcare providers, family members, and caregivers for collaborative health management.</p>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-indigo-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Appointment Scheduling</h3>
              <p className="text-gray-600">Easily book appointments with healthcare providers and receive timely reminders.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-indigo-600 to-purple-600">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Take Control of Your Health Journey Today</h2>
          <p className="text-xl text-indigo-100 mb-8 max-w-3xl mx-auto">Join thousands of Indians who are using HealthNet to predict, prevent, and manage their health risks.</p>
          <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Link to="/questionnaire" className="bg-white text-indigo-700 px-8 py-4 rounded-lg font-medium hover:bg-indigo-50 transition">Create Your Account</Link>
            <button className="border border-white text-white px-8 py-4 rounded-lg font-medium hover:bg-white hover:bg-opacity-10 transition">Schedule a Demo</button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home; 