import React from 'react';
import { Link } from 'react-router-dom';
import { Watch, FolderLock, ShieldCheck } from 'lucide-react';
import ComingSoonBadge from '../components/ComingSoonBadge';

const integrations = [
  {
    icon: Watch,
    title: 'Wearable & Phone Sync',
    description: 'Bring in steps, heart rate and sleep from Apple Health, Android Health Connect and popular fitness bands.'
  },
  {
    icon: FolderLock,
    title: 'Secure Health Records',
    description: 'Keep lab reports, prescriptions and checkup results together in one private place that you control.'
  },
  {
    icon: ShieldCheck,
    title: 'Privacy Controls',
    description: 'Choose exactly what you share and with whom, and change your mind at any time.'
  }
];

const Home = () => {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-1/2 mb-8 md:mb-0">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">AI-Powered Preventive Healthcare for Everyone</h1>
              <p className="text-lg md:text-xl mb-8 text-indigo-100">Personalized AI insights that help you predict, prevent, and manage health risks before they become serious, wherever you live.</p>
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <Link to="/questionnaire" className="bg-white text-indigo-700 px-6 py-3 rounded-lg font-medium hover:bg-indigo-50 transition text-center">Get Started</Link>
                <a href="#features" className="border border-white text-white px-6 py-3 rounded-lg font-medium hover:bg-white hover:bg-opacity-10 transition text-center">Learn More</a>
              </div>
            </div>
            <div className="md:w-1/2 flex justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-full max-w-md" viewBox="0 0 800 600" fill="none" aria-hidden="true">
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

      {/* Integrations Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Your Health Data, Connected</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">HealthNet is being built to work with the devices and records you already use, so your insights reflect your whole health picture.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {integrations.map(({ icon: Icon, title, description }) => (
              <div key={title} className="bg-white p-6 rounded-xl shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border border-gray-100">
                <div className="bg-indigo-100 rounded-full p-3 mb-4 inline-flex">
                  <Icon className="h-8 w-8 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">{title}</h3>
                <p className="text-gray-600 mb-4">{description}</p>
                <ComingSoonBadge />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 bg-gray-50 scroll-mt-16">
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
          <p className="text-xl text-indigo-100 mb-8 max-w-3xl mx-auto">Create your account to start predicting, preventing, and managing your health risks with personalized AI insights.</p>
          <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Link to="/login?mode=signup" className="bg-white text-indigo-700 px-8 py-4 rounded-lg font-medium hover:bg-indigo-50 transition">Create Your Account</Link>
            <button
              type="button"
              disabled
              title="Coming soon"
              className="border border-white text-white px-8 py-4 rounded-lg font-medium opacity-80 cursor-not-allowed inline-flex items-center justify-center"
            >
              Schedule a Demo
              <ComingSoonBadge className="ml-2" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
