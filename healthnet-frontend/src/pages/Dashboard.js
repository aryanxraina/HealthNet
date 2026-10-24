import React from 'react';
import { Line } from 'react-chartjs-2';
import '../chartSetup';
import { useAuth, getDisplayName } from '../context/AuthContext';
import ComingSoonBadge, { SampleDataBadge } from '../components/ComingSoonBadge';

// Sample readings until real vitals are stored
const healthTrendData = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  datasets: [{
    label: 'Heart Rate (bpm)',
    data: [72, 75, 73, 78, 76, 74],
    borderColor: 'rgb(99, 102, 241)',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    tension: 0.4
  }, {
    label: 'Systolic BP (mmHg)',
    data: [120, 118, 122, 125, 121, 119],
    borderColor: 'rgb(239, 68, 68)',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    tension: 0.4
  }]
};

const healthTrendOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
    },
    title: {
      display: true,
      text: 'Health Trends (Last 6 Months)'
    }
  },
  scales: {
    y: {
      beginAtZero: false
    }
  }
};

const Dashboard = () => {
  const { user } = useAuth();
  const firstName = getDisplayName(user).split(' ')[0];

  return (
    <div>
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Health Dashboard</h1>
            <p className="text-gray-600">Welcome back, {firstName}! Your dashboard shows sample data until you add your own.</p>
          </div>
          <div className="flex space-x-3 mt-4 md:mt-0">
            <button type="button" disabled title="Coming soon" className="bg-indigo-600 text-white px-4 py-2 rounded-md transition flex items-center disabled:opacity-60 disabled:cursor-not-allowed">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload Report
              <ComingSoonBadge className="ml-2" />
            </button>
            <button type="button" disabled title="Coming soon" className="border border-indigo-600 text-indigo-600 px-4 py-2 rounded-md transition flex items-center disabled:opacity-60 disabled:cursor-not-allowed">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Start Scan
              <ComingSoonBadge className="ml-2" />
            </button>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI Health Risk Summary */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-800">AI Health Risk Assessment</h2>
                <SampleDataBadge />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Overall Health Score</span>
                    <span className="text-sm font-medium text-green-600">Good</span>
                  </div>
                  <div className="flex items-center">
                    <div className="text-3xl font-bold text-green-600">82</div>
                    <div className="ml-2 text-sm text-green-600">/ 100</div>
                  </div>
                  <div className="mt-2 w-full bg-white rounded-full h-2.5">
                    <div className="bg-green-500 h-2.5 rounded-full" style={{width: '82%'}}></div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Metabolic Health</span>
                    <span className="text-sm font-medium text-blue-600">Excellent</span>
                  </div>
                  <div className="flex items-center">
                    <div className="text-3xl font-bold text-blue-600">91</div>
                    <div className="ml-2 text-sm text-blue-600">/ 100</div>
                  </div>
                  <div className="mt-2 w-full bg-white rounded-full h-2.5">
                    <div className="bg-blue-500 h-2.5 rounded-full" style={{width: '91%'}}></div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Cardiovascular Health</span>
                    <span className="text-sm font-medium text-purple-600">Good</span>
                  </div>
                  <div className="flex items-center">
                    <div className="text-3xl font-bold text-purple-600">78</div>
                    <div className="ml-2 text-sm text-purple-600">/ 100</div>
                  </div>
                  <div className="mt-2 w-full bg-white rounded-full h-2.5">
                    <div className="bg-purple-500 h-2.5 rounded-full" style={{width: '78%'}}></div>
                  </div>
                </div>
              </div>
              
              <h3 className="text-lg font-medium text-gray-800 mb-4">Health Risk Factors</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">Diabetes Risk</span>
                    <span className="text-sm font-medium text-green-600">Low (12%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-green-500 h-2.5 rounded-full" style={{width: '12%'}}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">Cardiovascular Risk</span>
                    <span className="text-sm font-medium text-yellow-600">Moderate (35%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-yellow-500 h-2.5 rounded-full" style={{width: '35%'}}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">Hypertension Risk</span>
                    <span className="text-sm font-medium text-red-600">High (68%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-red-500 h-2.5 rounded-full" style={{width: '68%'}}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">Obesity Risk</span>
                    <span className="text-sm font-medium text-green-600">Low (8%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-green-500 h-2.5 rounded-full" style={{width: '8%'}}></div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                <div className="flex">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-indigo-800">AI-Powered Recommendation</h4>
                    <p className="text-sm text-indigo-600">Consider lifestyle modifications to reduce your hypertension risk. Regular monitoring of blood pressure is recommended.</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Latest Report Preview */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-gray-800">Latest Health Report</h2>
                  <SampleDataBadge />
                </div>
                <button type="button" disabled title="Coming soon" className="text-indigo-600 text-sm font-medium flex items-center disabled:opacity-60 disabled:cursor-not-allowed">
                  View All Reports
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-medium text-gray-800">Complete Blood Count (CBC)</h3>
                    <p className="text-sm text-gray-500">Uploaded on May 15, 2023</p>
                  </div>
                  <div className="flex space-x-2">
                    <button type="button" disabled title="Download (coming soon)" aria-label="Download report (coming soon)" className="text-gray-400 cursor-not-allowed">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                    <button type="button" disabled title="Share (coming soon)" aria-label="Share report (coming soon)" className="text-gray-400 cursor-not-allowed">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parameter</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Normal Range</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-4 py-2 text-sm text-gray-700">Hemoglobin</td>
                        <td className="px-4 py-2 text-sm text-gray-700">14.2 g/dL</td>
                        <td className="px-4 py-2 text-sm text-gray-500">13.5 - 17.5 g/dL</td>
                        <td className="px-4 py-2">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Normal</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-sm text-gray-700">White Blood Cells</td>
                        <td className="px-4 py-2 text-sm text-gray-700">6.8 x10^9/L</td>
                        <td className="px-4 py-2 text-sm text-gray-500">4.5 - 11.0 x10^9/L</td>
                        <td className="px-4 py-2">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Normal</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-sm text-gray-700">Platelets</td>
                        <td className="px-4 py-2 text-sm text-gray-700">380 x10^9/L</td>
                        <td className="px-4 py-2 text-sm text-gray-500">150 - 450 x10^9/L</td>
                        <td className="px-4 py-2">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Normal</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-sm text-gray-700">Red Blood Cells</td>
                        <td className="px-4 py-2 text-sm text-gray-700">5.2 x10^12/L</td>
                        <td className="px-4 py-2 text-sm text-gray-500">4.5 - 5.5 x10^12/L</td>
                        <td className="px-4 py-2">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Normal</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-sm text-gray-700">Hematocrit</td>
                        <td className="px-4 py-2 text-sm text-gray-700">42%</td>
                        <td className="px-4 py-2 text-sm text-gray-500">38.3 - 48.6%</td>
                        <td className="px-4 py-2">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Normal</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-blue-800">AI Analysis</h4>
                      <p className="text-sm text-blue-600">All parameters are within normal range. Your blood count is healthy with no significant abnormalities detected.</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <button type="button" disabled title="Coming soon" className="w-full py-2 border border-indigo-600 text-indigo-600 rounded-md transition flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View Full Report
              </button>
            </div>
            
            {/* Real-time Vitals */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Health Metrics</h2>
                <SampleDataBadge />
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">72</div>
                  <div className="text-sm text-gray-600">Heart Rate</div>
                  <div className="text-xs text-green-600">Normal</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">120/80</div>
                  <div className="text-sm text-gray-600">Blood Pressure</div>
                  <div className="text-xs text-green-600">Normal</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">95</div>
                  <div className="text-sm text-gray-600">Glucose (mg/dL)</div>
                  <div className="text-xs text-green-600">Normal</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">98.6</div>
                  <div className="text-sm text-gray-600">Temperature (°F)</div>
                  <div className="text-xs text-green-600">Normal</div>
                </div>
              </div>
              
              <div className="relative h-64">
                <Line data={healthTrendData} options={healthTrendOptions} />
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Quick Actions</h2>
                <ComingSoonBadge />
              </div>
              <div className="space-y-3">
                <button type="button" disabled title="Coming soon" className="w-full text-left p-3 border border-gray-200 rounded-lg transition flex items-center disabled:opacity-60 disabled:cursor-not-allowed">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Schedule Appointment
                </button>
                <button type="button" disabled title="Coming soon" className="w-full text-left p-3 border border-gray-200 rounded-lg transition flex items-center disabled:opacity-60 disabled:cursor-not-allowed">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload Report
                </button>
                <button type="button" disabled title="Coming soon" className="w-full text-left p-3 border border-gray-200 rounded-lg transition flex items-center disabled:opacity-60 disabled:cursor-not-allowed">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Get Health Tips
                </button>
                <button type="button" disabled title="Coming soon" className="w-full text-left p-3 border border-gray-200 rounded-lg transition flex items-center disabled:opacity-60 disabled:cursor-not-allowed">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Contact Support
                </button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Recent Activity</h2>
                <SampleDataBadge />
              </div>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></div>
                  <div>
                    <p className="text-sm text-gray-800">Blood pressure recorded</p>
                    <p className="text-xs text-gray-500">2 hours ago</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                  <div>
                    <p className="text-sm text-gray-800">Appointment scheduled</p>
                    <p className="text-xs text-gray-500">1 day ago</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3"></div>
                  <div>
                    <p className="text-sm text-gray-800">Health report uploaded</p>
                    <p className="text-xs text-gray-500">3 days ago</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 mr-3"></div>
                  <div>
                    <p className="text-sm text-gray-800">Medication reminder</p>
                    <p className="text-xs text-gray-500">1 week ago</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Health Goals */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Health Goals</h2>
                <SampleDataBadge />
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-700">Daily Steps</span>
                    <span className="text-sm text-gray-600">8,420 / 10,000</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{width: '84%'}}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-700">Water Intake</span>
                    <span className="text-sm text-gray-600">6 / 8 glasses</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{width: '75%'}}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-700">Sleep Hours</span>
                    <span className="text-sm text-gray-600">7.5 / 8 hours</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full" style={{width: '94%'}}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard; 