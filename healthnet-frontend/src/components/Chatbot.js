import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Welcome to HealthNet! I'm your AI health assistant. How can I help you today?",
      sender: 'bot'
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const replyTimerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cancel a pending reply if the chat goes away
  useEffect(() => () => clearTimeout(replyTimerRef.current), []);

  const generateResponse = (message) => {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('dashboard') || lowerMessage.includes('health data')) {
      return "The Dashboard gives you an overview of your health metrics, risk assessments, and AI-powered insights. It shows sample data until you add your own.";
    }

    if (lowerMessage.includes('questionnaire') || lowerMessage.includes('assessment')) {
      return "The Health Questionnaire builds your personalized health profile. Personal info, lifestyle, and medical history are ready now, and more sections are coming soon.";
    }

    if (lowerMessage.includes('food tracker') || lowerMessage.includes('nutrition')) {
      return "The Food Tracker shows your daily calories and macro breakdown. Meal logging and custom goals are coming soon.";
    }

    if (lowerMessage.includes('login') || lowerMessage.includes('sign in') || lowerMessage.includes('account')) {
      return "Use the Sign in button at the top right to sign in or create an account with your email or Google.";
    }
    
    return "Welcome to HealthNet! I'm here to help you navigate our AI-powered health platform. You can explore the Dashboard, complete the Health Questionnaire, or start tracking your nutrition.";
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: inputMessage,
      sender: 'user'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    replyTimerRef.current = setTimeout(() => {
      const botResponse = {
        id: Date.now() + 1,
        text: generateResponse(inputMessage),
        sender: 'bot'
      };
      setMessages(prev => [...prev, botResponse]);
      setIsTyping(false);
    }, 1000);
  };

  const handleKeyDown = (e) => {
    // Ignore Enter while an input method (e.g. for Chinese or Japanese) is composing text
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      handleSendMessage();
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-4 shadow-lg transition-all duration-300 transform hover:scale-110"
          aria-label={isOpen ? 'Close AI Health Assistant' : 'Open AI Health Assistant'}
          aria-expanded={isOpen}
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      </div>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[calc(100vw-3rem)] sm:w-80 md:w-96 h-96 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 z-50">
          <div className="bg-indigo-600 text-white p-4 rounded-t-lg">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <Bot className="h-5 w-5 mr-2" />
                <span className="font-semibold">Health Assistant</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-white hover:text-gray-200"
                aria-label="Close chat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="h-64 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start ${message.sender === 'user' ? 'justify-end' : ''}`}
              >
                <div
                  className={`rounded-lg p-3 max-w-xs ${
                    message.sender === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200'
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex items-start">
                <div className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 rounded-lg p-3 max-w-xs">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-slate-700">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything..."
                aria-label="Message the health assistant"
                className="flex-1 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={isTyping}
              />
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={isTyping || !inputMessage.trim()}
                aria-label="Send message"
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot; 