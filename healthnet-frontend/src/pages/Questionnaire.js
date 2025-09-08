import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Questionnaire = () => {
  const [activeSection, setActiveSection] = useState(null);
  const [progress, setProgress] = useState(0);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [formData, setFormData] = useState({
    personal: {},
    lifestyle: {},
    medical: {},
    vitals: {},
    mental: {},
    checkups: {},
    menstrual: {},
    device: {}
  });

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

  const handleSectionClick = (section) => {
    setActiveSection(section);
  };

  const closeModal = () => {
    setActiveSection(null);
  };

  const updateProgress = () => {
    const sections = ['personal', 'lifestyle', 'medical', 'vitals', 'mental', 'checkups', 'menstrual', 'device'];
    const completedSections = sections.filter(section => 
      Object.keys(formData[section]).length > 0
    );
    const progressPercentage = (completedSections.length / sections.length) * 100;
    setProgress(progressPercentage);
  };

  useEffect(() => {
    updateProgress();
  }, [formData]);

  const renderPersonalModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Personal Information</h2>
          <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">What is your full name?</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">What is your gender?</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center">
                <input type="radio" name="gender" value="male" className="mr-2" required />
                Male
              </label>
              <label className="flex items-center">
                <input type="radio" name="gender" value="female" className="mr-2" />
                Female
              </label>
              <label className="flex items-center">
                <input type="radio" name="gender" value="other" className="mr-2" />
                Other
              </label>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">What is your age?</label>
            <input 
              type="number" 
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">What is your height (cm)?</label>
            <input 
              type="number" 
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">What is your weight (kg)?</label>
            <input 
              type="number" 
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <button 
              type="button" 
              onClick={closeModal}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderLifestyleModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Lifestyle & Habits</h2>
          <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">How often do you exercise?</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center">
                <input type="radio" name="exercise" value="never" className="mr-2" required />
                Never
              </label>
              <label className="flex items-center">
                <input type="radio" name="exercise" value="rarely" className="mr-2" />
                Rarely (1-2 times/month)
              </label>
              <label className="flex items-center">
                <input type="radio" name="exercise" value="sometimes" className="mr-2" />
                Sometimes (1-2 times/week)
              </label>
              <label className="flex items-center">
                <input type="radio" name="exercise" value="regularly" className="mr-2" />
                Regularly (3-5 times/week)
              </label>
              <label className="flex items-center">
                <input type="radio" name="exercise" value="daily" className="mr-2" />
                Daily
              </label>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Do you smoke?</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center">
                <input type="radio" name="smoking" value="never" className="mr-2" required />
                Never smoked
              </label>
              <label className="flex items-center">
                <input type="radio" name="smoking" value="former" className="mr-2" />
                Former smoker
              </label>
              <label className="flex items-center">
                <input type="radio" name="smoking" value="current" className="mr-2" />
                Current smoker
              </label>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">How much alcohol do you consume?</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center">
                <input type="radio" name="alcohol" value="never" className="mr-2" required />
                Never
              </label>
              <label className="flex items-center">
                <input type="radio" name="alcohol" value="occasionally" className="mr-2" />
                Occasionally
              </label>
              <label className="flex items-center">
                <input type="radio" name="alcohol" value="moderate" className="mr-2" />
                Moderate
              </label>
              <label className="flex items-center">
                <input type="radio" name="alcohol" value="heavy" className="mr-2" />
                Heavy
              </label>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <button 
              type="button" 
              onClick={closeModal}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderMedicalModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Medical History</h2>
          <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Do you have any chronic conditions?</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center">
                <input type="checkbox" name="diabetes" className="mr-2" />
                Diabetes
              </label>
              <label className="flex items-center">
                <input type="checkbox" name="hypertension" className="mr-2" />
                Hypertension
              </label>
              <label className="flex items-center">
                <input type="checkbox" name="heart_disease" className="mr-2" />
                Heart Disease
              </label>
              <label className="flex items-center">
                <input type="checkbox" name="asthma" className="mr-2" />
                Asthma
              </label>
              <label className="flex items-center">
                <input type="checkbox" name="none" className="mr-2" />
                None
              </label>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Are you currently taking any medications?</label>
            <textarea 
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              rows="3"
              placeholder="List your current medications..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Do you have any allergies?</label>
            <textarea 
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              rows="3"
              placeholder="List any allergies..."
            />
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <button 
              type="button" 
              onClick={closeModal}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderModal = () => {
    switch (activeSection) {
      case 'personal':
        return renderPersonalModal();
      case 'lifestyle':
        return renderLifestyleModal();
      case 'medical':
        return renderMedicalModal();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">HealthTracker</h1>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <Link to="/" className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  <i className="fas fa-home mr-2"></i>Home
                </Link>
                <Link to="/dashboard" className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  <i className="fas fa-chart-line mr-2"></i>Dashboard
                </Link>
                <Link to="/questionnaire" className="bg-blue-100 text-blue-700 px-3 py-2 rounded-md text-sm font-medium">
                  <i className="fas fa-clipboard-list mr-2"></i>Questionnaire
                </Link>
                <Link to="/food-tracker" className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  <i className="fas fa-utensils mr-2"></i>Food Tracker
                </Link>
              </div>
            </div>
            
            {/* Universal Search */}
            <div className="relative hidden md:block ml-4">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search HealthNet..." 
                  value={searchQuery}
                  onChange={handleSearch}
                  className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fas fa-search text-gray-400"></i>
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
            
            {/* Mobile menu button */}
            <div className="md:hidden">
              <button 
                type="button" 
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="bg-white inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              >
                <i className="fas fa-bars"></i>
              </button>
            </div>
          </div>
          
          {/* Mobile menu */}
          {showMobileMenu && (
            <div className="md:hidden">
              <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                <Link to="/" className="text-gray-500 hover:text-gray-700 block px-3 py-2 rounded-md text-base font-medium">
                  <i className="fas fa-home mr-2"></i>Home
                </Link>
                <Link to="/dashboard" className="text-gray-500 hover:text-gray-700 block px-3 py-2 rounded-md text-base font-medium">
                  <i className="fas fa-chart-line mr-2"></i>Dashboard
                </Link>
                <Link to="/questionnaire" className="bg-blue-100 text-blue-700 block px-3 py-2 rounded-md text-base font-medium">
                  <i className="fas fa-clipboard-list mr-2"></i>Questionnaire
                </Link>
                <Link to="/food-tracker" className="text-gray-500 hover:text-gray-700 block px-3 py-2 rounded-md text-base font-medium">
                  <i className="fas fa-utensils mr-2"></i>Food Tracker
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Health Questionnaire</h1>
            <p className="mt-2 text-lg text-gray-600">Complete all sections to create your personalized health profile</p>
          </div>
          
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Progress</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
          
          {/* Tiles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Personal Information Tile */}
            <div 
              className="bg-blue-50 border-l-4 border-blue-500 rounded-lg shadow-md p-6 aspect-square flex flex-col justify-between cursor-pointer hover:shadow-lg transition-all duration-300"
              onClick={() => handleSectionClick('personal')}
            >
              <div>
                <h2 className="text-xl font-semibold text-gray-800">1. Personal Information</h2>
                <p className="mt-2 text-gray-600">Add your basic information</p>
              </div>
              <div className="mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-700 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
            
            {/* Lifestyle & Habits Tile */}
            <div 
              className="bg-green-50 border-l-4 border-green-500 rounded-lg shadow-md p-6 aspect-square flex flex-col justify-between cursor-pointer hover:shadow-lg transition-all duration-300"
              onClick={() => handleSectionClick('lifestyle')}
            >
              <div>
                <h2 className="text-xl font-semibold text-gray-800">2. Lifestyle & Habits</h2>
                <p className="mt-2 text-gray-600">Add your lifestyle habits</p>
              </div>
              <div className="mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-700 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            
            {/* Medical History Tile */}
            <div 
              className="bg-red-50 border-l-4 border-red-500 rounded-lg shadow-md p-6 aspect-square flex flex-col justify-between cursor-pointer hover:shadow-lg transition-all duration-300"
              onClick={() => handleSectionClick('medical')}
            >
              <div>
                <h2 className="text-xl font-semibold text-gray-800">3. Medical History</h2>
                <p className="mt-2 text-gray-600">Add your medical history</p>
              </div>
              <div className="mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-700 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            
            {/* Vitals Tracking Tile */}
            <div 
              className="bg-orange-50 border-l-4 border-orange-500 rounded-lg shadow-md p-6 aspect-square flex flex-col justify-between cursor-pointer hover:shadow-lg transition-all duration-300"
              onClick={() => handleSectionClick('vitals')}
            >
              <div>
                <h2 className="text-xl font-semibold text-gray-800">4. Vitals Tracking</h2>
                <p className="mt-2 text-gray-600">Add your vital measurements</p>
              </div>
              <div className="mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-700 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            
            {/* Mental & Emotional Health Tile */}
            <div 
              className="bg-purple-50 border-l-4 border-purple-500 rounded-lg shadow-md p-6 aspect-square flex flex-col justify-between cursor-pointer hover:shadow-lg transition-all duration-300"
              onClick={() => handleSectionClick('mental')}
            >
              <div>
                <h2 className="text-xl font-semibold text-gray-800">5. Mental Health</h2>
                <p className="mt-2 text-gray-600">Add your mental health info</p>
              </div>
              <div className="mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-700 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
            </div>
            
            {/* Preventive Checkups Tile */}
            <div 
              className="bg-gray-50 border-l-4 border-gray-500 rounded-lg shadow-md p-6 aspect-square flex flex-col justify-between cursor-pointer hover:shadow-lg transition-all duration-300"
              onClick={() => handleSectionClick('checkups')}
            >
              <div>
                <h2 className="text-xl font-semibold text-gray-800">6. Preventive Checkups</h2>
                <p className="mt-2 text-gray-600">Add checkup information</p>
              </div>
              <div className="mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-700 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
            
            {/* Wellness Device Tracking Tile */}
            <div 
              className="bg-emerald-50 border-l-4 border-emerald-500 rounded-lg shadow-md p-6 aspect-square flex flex-col justify-between cursor-pointer hover:shadow-lg transition-all duration-300"
              onClick={() => handleSectionClick('device')}
            >
              <div>
                <h2 className="text-xl font-semibold text-gray-800">7. Wellness Device Tracking</h2>
                <p className="mt-2 text-gray-600">Add device tracking info</p>
              </div>
              <div className="mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-700 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Render Modal */}
      {renderModal()}
    </div>
  );
};

export default Questionnaire; 