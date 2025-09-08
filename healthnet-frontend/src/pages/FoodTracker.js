import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const FoodTracker = () => {
  const [activeTab, setActiveTab] = useState('daily');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [caloriesConsumed, setCaloriesConsumed] = useState(0);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [caloriesGoal, setCaloriesGoal] = useState(2000);
  const [carbsConsumed, setCarbsConsumed] = useState(0);
  const [proteinConsumed, setProteinConsumed] = useState(0);
  const [fatConsumed, setFatConsumed] = useState(0);
  const [meals, setMeals] = useState({
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: []
  });

  const chartRef = useRef(null);
  const chartInstance = useRef(null);

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

  const formatDate = (date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const navigateDate = (direction) => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (direction === 'next') {
      newDate.setDate(newDate.getDate() + 1);
    } else {
      newDate.setTime(new Date().getTime());
    }
    setCurrentDate(newDate);
  };

  const calculateCaloriePercentage = () => {
    return Math.min((caloriesConsumed / caloriesGoal) * 100, 100);
  };

  const calculateRemainingCalories = () => {
    return Math.max(caloriesGoal - caloriesConsumed + caloriesBurned, 0);
  };

  useEffect(() => {
    // Initialize Chart.js for weekly view
    if (chartRef.current && window.Chart && activeTab === 'weekly') {
      const ctx = chartRef.current.getContext('2d');
      
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      chartInstance.current = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            label: 'Calories Consumed',
            data: [1850, 2100, 1950, 2200, 1800, 2400, 2000],
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4
          }, {
            label: 'Calorie Goal',
            data: [2000, 2000, 2000, 2000, 2000, 2000, 2000],
            borderColor: 'rgb(239, 68, 68)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderDash: [5, 5],
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: true,
              text: 'Weekly Calorie Intake'
            }
          },
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [activeTab]);

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
                <Link to="/questionnaire" className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  <i className="fas fa-clipboard-list mr-2"></i>Questionnaire
                </Link>
                <Link to="/food-tracker" className="bg-blue-100 text-blue-700 px-3 py-2 rounded-md text-sm font-medium">
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
                <Link to="/questionnaire" className="text-gray-500 hover:text-gray-700 block px-3 py-2 rounded-md text-base font-medium">
                  <i className="fas fa-clipboard-list mr-2"></i>Questionnaire
                </Link>
                <Link to="/food-tracker" className="bg-blue-100 text-blue-700 block px-3 py-2 rounded-md text-base font-medium">
                  <i className="fas fa-utensils mr-2"></i>Food Tracker
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Nutrition Tracker</h1>
              <p className="mt-1 text-lg text-gray-600">Track your daily nutrition and calorie intake</p>
            </div>
            
            {/* Date Navigation */}
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
              <div 
                className="p-2 rounded-full hover:bg-gray-100 cursor-pointer transition-colors" 
                onClick={() => navigateDate('prev')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-lg font-medium text-gray-900">{formatDate(currentDate)}</div>
              <div 
                className="p-2 rounded-full hover:bg-gray-100 cursor-pointer transition-colors" 
                onClick={() => navigateDate('next')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <button 
                className="ml-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                onClick={() => navigateDate('today')}
              >
                Today
              </button>
            </div>
          </div>
          
          {/* View Tabs */}
          <div className="flex border-b border-gray-200 mb-6">
            <div 
              className={`py-3 px-6 font-medium cursor-pointer transition-colors ${
                activeTab === 'daily' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('daily')}
            >
              Daily View
            </div>
            <div 
              className={`py-3 px-6 font-medium cursor-pointer transition-colors ${
                activeTab === 'weekly' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('weekly')}
            >
              Weekly View
            </div>
          </div>
          
          {/* Daily View Content */}
          {activeTab === 'daily' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Summary */}
              <div className="lg:col-span-1">
                {/* Calorie Summary Card */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">Calorie Summary</h2>
                  
                  <div className="flex items-center justify-between mb-6">
                    <div className="relative w-24 h-24">
                      <svg className="transform -rotate-90" width="100" height="100">
                        <circle 
                          className="text-gray-200" 
                          strokeWidth="8" 
                          stroke="currentColor" 
                          fill="transparent" 
                          r="40" 
                          cx="50" 
                          cy="50"
                        />
                        <circle 
                          className="text-blue-600" 
                          strokeWidth="8" 
                          strokeDasharray={251.2}
                          strokeDashoffset={251.2 - (251.2 * calculateCaloriePercentage()) / 100}
                          strokeLinecap="round"
                          stroke="currentColor" 
                          fill="transparent" 
                          r="40" 
                          cx="50" 
                          cy="50"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-bold text-gray-800">{Math.round(calculateCaloriePercentage())}%</span>
                      </div>
                    </div>
                    
                    <div className="flex-1 ml-6">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-500">Consumed</span>
                        <span className="text-sm font-semibold text-gray-800">{caloriesConsumed}</span>
                      </div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-500">Burned</span>
                        <span className="text-sm font-semibold text-gray-800">{caloriesBurned}</span>
                      </div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-500">Goal</span>
                        <span className="text-sm font-semibold text-gray-800">{caloriesGoal}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-500">Remaining</span>
                        <span className="text-sm font-semibold text-blue-600">{calculateRemainingCalories()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <button className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
                      <i className="fas fa-running mr-2"></i>Add Exercise
                    </button>
                    <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors">
                      <i className="fas fa-sliders-h mr-2"></i>Adjust Goal
                    </button>
                  </div>
                </div>
                
                {/* Macronutrients Card */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">Macronutrients</h2>
                  
                  <div className="space-y-4">
                    {/* Carbs */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center">
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium mr-2">C</span>
                          <span className="text-sm font-medium text-gray-700">Carbs</span>
                        </div>
                        <div className="text-sm font-semibold text-gray-800">
                          {carbsConsumed}g / 250g
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                          style={{width: `${Math.min((carbsConsumed / 250) * 100, 100)}%`}}
                        ></div>
                      </div>
                    </div>
                    
                    {/* Protein */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center">
                          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium mr-2">P</span>
                          <span className="text-sm font-medium text-gray-700">Protein</span>
                        </div>
                        <div className="text-sm font-semibold text-gray-800">
                          {proteinConsumed}g / 125g
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                          style={{width: `${Math.min((proteinConsumed / 125) * 100, 100)}%`}}
                        ></div>
                      </div>
                    </div>
                    
                    {/* Fat */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center">
                          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium mr-2">F</span>
                          <span className="text-sm font-medium text-gray-700">Fat</span>
                        </div>
                        <div className="text-sm font-semibold text-gray-800">
                          {fatConsumed}g / 65g
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-yellow-500 h-2 rounded-full transition-all duration-300" 
                          style={{width: `${Math.min((fatConsumed / 65) * 100, 100)}%`}}
                        ></div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-500">Macro Ratio</span>
                      <span className="text-xs text-gray-500">Target: 50% / 25% / 25%</span>
                    </div>
                    <div className="w-full h-4 flex rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full" style={{width: '50%'}}></div>
                      <div className="bg-green-500 h-full" style={{width: '25%'}}></div>
                      <div className="bg-yellow-500 h-full" style={{width: '25%'}}></div>
                    </div>
                  </div>
                </div>

                {/* Quick Add Food */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Add Food</h2>
                  <div className="space-y-3">
                    <button className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center">
                      <i className="fas fa-plus text-blue-600 mr-3"></i>
                      <span className="text-gray-700">Add Food Item</span>
                    </button>
                    <button className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center">
                      <i className="fas fa-camera text-green-600 mr-3"></i>
                      <span className="text-gray-700">Scan Barcode</span>
                    </button>
                    <button className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center">
                      <i className="fas fa-utensils text-purple-600 mr-3"></i>
                      <span className="text-gray-700">Add Recipe</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Meals */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-6">Today's Meals</h2>
                  
                  <div className="space-y-6">
                    {/* Breakfast */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-medium text-gray-800">Breakfast</h3>
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          <i className="fas fa-plus mr-1"></i>Add Food
                        </button>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 min-h-[100px] flex items-center justify-center">
                        <p className="text-gray-500">No foods added yet</p>
                      </div>
                    </div>

                    {/* Lunch */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-medium text-gray-800">Lunch</h3>
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          <i className="fas fa-plus mr-1"></i>Add Food
                        </button>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 min-h-[100px] flex items-center justify-center">
                        <p className="text-gray-500">No foods added yet</p>
                      </div>
                    </div>

                    {/* Dinner */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-medium text-gray-800">Dinner</h3>
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          <i className="fas fa-plus mr-1"></i>Add Food
                        </button>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 min-h-[100px] flex items-center justify-center">
                        <p className="text-gray-500">No foods added yet</p>
                      </div>
                    </div>

                    {/* Snacks */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-medium text-gray-800">Snacks</h3>
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          <i className="fas fa-plus mr-1"></i>Add Food
                        </button>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 min-h-[100px] flex items-center justify-center">
                        <p className="text-gray-500">No foods added yet</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Weekly View Content */}
          {activeTab === 'weekly' && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Weekly Nutrition Overview</h2>
              <canvas ref={chartRef} className="w-full h-64"></canvas>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FoodTracker; 