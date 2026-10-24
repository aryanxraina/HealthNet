import React, { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Activity, Camera, Plus, SlidersHorizontal, Utensils } from 'lucide-react';
import '../chartSetup';
import { themedOptions, useChartColors } from '../lib/chartTheme';
import ComingSoonBadge, { SampleDataBadge } from '../components/ComingSoonBadge';

const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

// Sample week until food logging is built
const weeklyChartData = {
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
};

const weeklyChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
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
};

const tabClass = (isActive) =>
  `py-3 px-6 font-medium transition-colors ${
    isActive
      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-b-2 hover:border-gray-300 dark:hover:border-slate-600'
  }`;

const FoodTracker = () => {
  const [activeTab, setActiveTab] = useState('daily');
  const [currentDate, setCurrentDate] = useState(new Date());
  const chartColors = useChartColors();
  const chartOptions = useMemo(() => themedOptions(weeklyChartOptions, chartColors), [chartColors]);

  // Totals stay at zero until food logging is built
  const caloriesConsumed = 0;
  const caloriesBurned = 0;
  const caloriesGoal = 2000;
  const carbsConsumed = 0;
  const proteinConsumed = 0;
  const fatConsumed = 0;

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
      // undefined uses the viewer's own locale for the date format
      return date.toLocaleDateString(undefined, {
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

  const dateLabel = formatDate(currentDate);
  const mealsHeading = ['Today', 'Yesterday', 'Tomorrow'].includes(dateLabel)
    ? `${dateLabel}'s Meals`
    : `Meals for ${dateLabel}`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Nutrition Tracker</h1>
              <p className="mt-1 text-lg text-gray-600 dark:text-gray-300">Track your daily nutrition and calorie intake</p>
            </div>

            {/* Date Navigation */}
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
              <button
                type="button"
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                onClick={() => navigateDate('prev')}
                aria-label="Previous day"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
              <div className="text-lg font-medium text-gray-900 dark:text-gray-100" aria-live="polite">{dateLabel}</div>
              <button
                type="button"
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                onClick={() => navigateDate('next')}
                aria-label="Next day"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                type="button"
                className="ml-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
                onClick={() => navigateDate('today')}
              >
                Today
              </button>
            </div>
          </div>

          {/* View Tabs */}
          <div className="flex border-b border-gray-200 dark:border-slate-700 mb-6">
            <button
              type="button"
              className={tabClass(activeTab === 'daily')}
              onClick={() => setActiveTab('daily')}
              aria-pressed={activeTab === 'daily'}
            >
              Daily View
            </button>
            <button
              type="button"
              className={tabClass(activeTab === 'weekly')}
              onClick={() => setActiveTab('weekly')}
              aria-pressed={activeTab === 'weekly'}
            >
              Weekly View
            </button>
          </div>

          {/* Daily View Content */}
          {activeTab === 'daily' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Summary */}
              <div className="lg:col-span-1">
                {/* Calorie Summary Card */}
                <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 mb-6">
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Calorie Summary</h2>

                  <div className="flex items-center justify-between mb-6">
                    <div className="relative w-24 h-24">
                      <svg className="transform -rotate-90" width="100" height="100">
                        <circle
                          className="text-gray-200 dark:text-slate-700"
                          strokeWidth="8"
                          stroke="currentColor"
                          fill="transparent"
                          r="40"
                          cx="50"
                          cy="50"
                        />
                        <circle
                          className="text-blue-600 dark:text-blue-400"
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
                        <span className="text-xl font-bold text-gray-800 dark:text-gray-100">{Math.round(calculateCaloriePercentage())}%</span>
                      </div>
                    </div>

                    <div className="flex-1 ml-6">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Consumed</span>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{caloriesConsumed}</span>
                      </div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Burned</span>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{caloriesBurned}</span>
                      </div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Goal</span>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{caloriesGoal}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Remaining</span>
                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{calculateRemainingCalories()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <button
                      type="button"
                      disabled
                      title="Coming soon"
                      className="px-4 py-2 bg-blue-500 text-white rounded-md transition-colors inline-flex items-center disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Activity className="h-4 w-4 mr-2" />Add Exercise
                    </button>
                    <button
                      type="button"
                      disabled
                      title="Coming soon"
                      className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-md transition-colors inline-flex items-center disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <SlidersHorizontal className="h-4 w-4 mr-2" />Adjust Goal
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Exercise logging and custom goals are coming soon.</p>
                </div>

                {/* Macronutrients Card */}
                <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 mb-6">
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Macronutrients</h2>

                  <div className="space-y-4">
                    {/* Carbs */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center">
                          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium mr-2">C</span>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Carbs</span>
                        </div>
                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                          {carbsConsumed}g / 250g
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
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
                          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 rounded-full text-xs font-medium mr-2">P</span>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Protein</span>
                        </div>
                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                          {proteinConsumed}g / 125g
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
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
                          <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300 rounded-full text-xs font-medium mr-2">F</span>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Fat</span>
                        </div>
                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                          {fatConsumed}g / 65g
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                          style={{width: `${Math.min((fatConsumed / 65) * 100, 100)}%`}}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Macro Ratio</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Target: 50% / 25% / 25%</span>
                    </div>
                    <div className="w-full h-4 flex rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full" style={{width: '50%'}}></div>
                      <div className="bg-green-500 h-full" style={{width: '25%'}}></div>
                      <div className="bg-yellow-500 h-full" style={{width: '25%'}}></div>
                    </div>
                  </div>
                </div>

                {/* Quick Add Food */}
                <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Quick Add Food</h2>
                    <ComingSoonBadge />
                  </div>
                  <div className="space-y-3">
                    <button type="button" disabled title="Coming soon" className="w-full text-left p-3 border border-gray-200 dark:border-slate-700 rounded-lg transition-colors flex items-center disabled:opacity-60 disabled:cursor-not-allowed">
                      <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-3" />
                      <span className="text-gray-700 dark:text-gray-200">Add Food Item</span>
                    </button>
                    <button type="button" disabled title="Coming soon" className="w-full text-left p-3 border border-gray-200 dark:border-slate-700 rounded-lg transition-colors flex items-center disabled:opacity-60 disabled:cursor-not-allowed">
                      <Camera className="h-4 w-4 text-green-600 dark:text-green-400 mr-3" />
                      <span className="text-gray-700 dark:text-gray-200">Scan Barcode</span>
                    </button>
                    <button type="button" disabled title="Coming soon" className="w-full text-left p-3 border border-gray-200 dark:border-slate-700 rounded-lg transition-colors flex items-center disabled:opacity-60 disabled:cursor-not-allowed">
                      <Utensils className="h-4 w-4 text-purple-600 dark:text-purple-400 mr-3" />
                      <span className="text-gray-700 dark:text-gray-200">Add Recipe</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Meals */}
              <div className="lg:col-span-2">
                <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{mealsHeading}</h2>
                    <ComingSoonBadge />
                  </div>

                  <div className="space-y-6">
                    {meals.map((meal) => (
                      <div key={meal}>
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">{meal}</h3>
                          <button
                            type="button"
                            disabled
                            title="Coming soon"
                            className="text-blue-600 dark:text-blue-400 text-sm font-medium inline-flex items-center disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <Plus className="h-4 w-4 mr-1" />Add Food
                          </button>
                        </div>
                        <div className="bg-gray-50 dark:bg-slate-800/60 rounded-lg p-4 min-h-[100px] flex items-center justify-center">
                          <p className="text-gray-500 dark:text-gray-400">No foods added yet</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Weekly View Content */}
          {activeTab === 'weekly' && (
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Weekly Nutrition Overview</h2>
                <SampleDataBadge />
              </div>
              <div className="relative h-64">
                <Line data={weeklyChartData} options={chartOptions} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FoodTracker;
