import { apiFetch } from './client';

// The cloud part of the "Explain my results" assistant (FINAL YEAR PROJECT/assistant_api.py). Only
// called after the person agrees; sends the conversation and a summary of their scores.

// { available, provider, providerName, model } - asked each time the assistant opens
export const getAssistantStatus = () => apiFetch('/assistant/status');

// messages: [{ role: 'user' | 'assistant', content }]; scores: from scoreSummaries
// -> { reply, safety, providerName }
export const sendChat = (messages, scores) => apiFetch('/assistant/chat', { method: 'POST', body: { messages, scores } });
