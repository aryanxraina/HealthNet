import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bot, Cloud, Loader2, MessageCircle, Send, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUserData } from '../context/UserDataContext';
import { useTranslation } from '../i18n';
import { useRiskAssessment } from '../api/useRiskAssessment';
import { getAssistantStatus, sendChat } from '../api/assistant';
import { emergencyIn } from '../assistant/safety';
import { localAnswer, replyBlocks, scoreSummaries, suggestedQuestions, topicFor } from '../assistant/localAnswers';

// "Explain my results": the health assistant behind the chat button.
// - Suggested questions are answered on the device from the person's own scores.
// - Typed questions go to the cloud assistant only after the person agrees, with their scores summary
//   (no name, email or questionnaire answers). Without it, typed questions are matched to a topic locally.
// - Emergencies (chest pain, stroke signs, self-harm...) are caught on the device first.

const MAX_HISTORY = 12;
let nextId = 1;
const message = (from, blocks, extra = {}) => ({ id: nextId++, from, blocks, ...extra });
const textOf = (blocks) => blocks.map((b) => (b.type === 'list' ? b.items.map((i) => `- ${i}`).join('\n') : b.text)).join('\n');

const Blocks = ({ blocks }) =>
  blocks.map((block, index) =>
    block.type === 'list' ? (
      <ul key={index} className="ml-4 list-disc space-y-1">
        {block.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    ) : (
      <p key={index}>{block.text}</p>
    )
  );

const SafetyMessage = ({ code, t }) => (
  <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100" role="alert">
    <p className="flex items-center gap-2 font-semibold">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      {t(`assistant.safety.${code}`)}
    </p>
    <p>{t('assistant.safety.callNow')}</p>
    {code === 'selfHarm' && (
      <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
        {t('dashboard.risk.support.helplines')}
      </a>
    )}
  </div>
);

const AssistantPanel = ({ onClose }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { answers } = useUserData();
  const { results } = useRiskAssessment();
  const signedIn = Boolean(user);
  const scoresReady = signedIn && results ? results : null;
  const [messages, setMessages] = useState(() => [message('assistant', [{ type: 'p', text: t(user ? 'assistant.welcome' : 'assistant.welcomeSignedOut') }])]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [cloud, setCloud] = useState(null); // { available, providerName } once known
  const [consented, setConsented] = useState(false);
  const [pending, setPending] = useState(null); // a typed question waiting for consent
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, pending]);

  useEffect(() => {
    if (!signedIn) return undefined;
    let live = true;
    getAssistantStatus()
      .then((status) => live && setCloud(status))
      .catch(() => live && setCloud({ available: false }));
    return () => {
      live = false;
    };
  }, [signedIn]);

  const add = (...items) => setMessages((current) => [...current, ...items]);

  const answerLocally = (topic, note) => {
    const blocks = localAnswer(topic, { results: scoresReady, answers, t });
    add(message('assistant', note ? [...blocks, { type: 'p', text: note }] : blocks, { source: 'device' }));
  };

  const askCloud = async (question, history) => {
    setBusy(true);
    const conversation = [...history, { role: 'user', content: question }].slice(-MAX_HISTORY * 2);
    try {
      const { reply, safety, providerName } = await sendChat(conversation, scoresReady ? scoreSummaries(scoresReady, t) : []);
      add(safety ? message('assistant', [], { safety }) : message('assistant', replyBlocks(reply), { source: 'cloud', providerName }));
    } catch (error) {
      add(message('assistant', [{ type: 'p', text: t(`assistant.errors.${error.code}`) }], { error: true }));
    } finally {
      setBusy(false);
    }
  };

  // The conversation so far, as the cloud assistant should see it
  const history = () =>
    messages
      .filter((m) => !m.safety && !m.error && m.blocks.length && m.id !== messages[0].id)
      .map((m) => ({ role: m.from === 'user' ? 'user' : 'assistant', content: textOf(m.blocks) }));

  const askTyped = (text) => {
    const question = text.trim();
    if (!question || busy) return;
    setInput('');
    const previous = history();
    add(message('user', [{ type: 'p', text: question }]));
    const emergency = emergencyIn(question);
    if (emergency) {
      add(message('assistant', [], { safety: emergency }));
      return;
    }
    if (!signedIn) {
      answerLocally(topicFor(question) === 'privacy' ? 'privacy' : 'whatIs', t('assistant.signInForMore'));
      return;
    }
    if (cloud?.available) {
      if (consented) askCloud(question, previous);
      else setPending({ question, previous });
      return;
    }
    const topic = topicFor(question);
    if (topic) answerLocally(topic, t('assistant.localOnly'));
    else add(message('assistant', [{ type: 'p', text: t('assistant.typedNeedsCloud') }], { source: 'device' }));
  };

  const askSuggested = (id) => {
    if (busy) return;
    add(message('user', [{ type: 'p', text: t(`assistant.questions.${id}`) }]));
    answerLocally(id);
  };

  const consent = (agree) => {
    const { question, previous } = pending;
    setPending(null);
    if (agree) {
      setConsented(true);
      askCloud(question, previous);
    } else {
      const topic = topicFor(question);
      if (topic) answerLocally(topic, t('assistant.localOnly'));
      else add(message('assistant', [{ type: 'p', text: t('assistant.declined') }], { source: 'device' }));
    }
  };

  const suggestions = suggestedQuestions(scoresReady);

  return (
    <div
      role="dialog"
      aria-label={t('assistant.title')}
      data-cloud={!signedIn ? 'signedOut' : cloud ? (cloud.available ? 'available' : 'unavailable') : 'checking'}
      className="fixed bottom-24 right-4 z-50 flex h-[min(36rem,calc(100vh-8rem))] w-[calc(100vw-2rem)] flex-col rounded-xl border border-gray-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:right-6 sm:w-96"
    >
      <div className="flex items-center justify-between rounded-t-xl bg-indigo-600 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" aria-hidden="true" />
          <span className="font-semibold">{t('assistant.title')}</span>
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-indigo-500" aria-label={t('assistant.close')}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.from === 'user' ? 'justify-end' : ''}`}>
            {m.safety ? (
              <SafetyMessage code={m.safety} t={t} />
            ) : (
              <div
                className={`max-w-[85%] space-y-2 rounded-lg p-3 ${
                  m.from === 'user'
                    ? 'bg-indigo-600 text-white'
                    : m.error
                      ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100'
                      : 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-gray-100'
                }`}
              >
                <Blocks blocks={m.blocks} />
                {m.source && (
                  <p className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                    {m.source === 'cloud' ? <Cloud className="h-3 w-3" aria-hidden="true" /> : <ShieldCheck className="h-3 w-3" aria-hidden="true" />}
                    {m.source === 'cloud' ? t('assistant.fromCloud', { provider: m.providerName }) : t('assistant.fromDevice')}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        {pending && (
          <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
            <p className="font-semibold">{t('assistant.consent.title', { provider: cloud.providerName })}</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>{t('assistant.consent.sent')}</li>
              <li>{t('assistant.consent.notSent')}</li>
              <li>{t('assistant.consent.provider', { provider: cloud.providerName })}</li>
            </ul>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => consent(true)} className="rounded-lg bg-violet-600 px-3 py-1.5 font-semibold text-white hover:bg-violet-700">
                {t('assistant.consent.send', { provider: cloud.providerName })}
              </button>
              <button type="button" onClick={() => consent(false)} className="rounded-lg border border-violet-300 px-3 py-1.5 font-medium hover:bg-violet-100 dark:border-violet-700 dark:hover:bg-violet-900/50">
                {t('assistant.consent.notNow')}
              </button>
            </div>
          </div>
        )}

        {busy && (
          <p className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t('assistant.thinking')}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-gray-200 p-3 dark:border-slate-700">
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t('assistant.suggested')}>
          {suggestions.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => askSuggested(id)}
              disabled={busy}
              className="whitespace-nowrap rounded-full border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
            >
              {t(`assistant.questions.${id}`)}
            </button>
          ))}
          {!signedIn && (
            <Link to="/login" onClick={onClose} className="whitespace-nowrap rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
              {t('assistant.signIn')}
            </Link>
          )}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            askTyped(input);
          }}
        >
          <input
            type="text"
            value={input}
            maxLength={1000}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t('assistant.placeholder')}
            aria-label={t('assistant.inputLabel')}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
            disabled={busy || Boolean(pending)}
          />
          <button
            type="submit"
            disabled={busy || Boolean(pending) || !input.trim()}
            aria-label={t('assistant.send')}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-2 text-[11px] leading-snug text-gray-500 dark:text-gray-400">{t('assistant.disclaimer')}</p>
      </div>
    </div>
  );
};

const Chatbot = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="transform rounded-full bg-indigo-600 p-4 text-white shadow-lg transition-all duration-300 hover:scale-110 hover:bg-indigo-700"
          aria-label={open ? t('assistant.closeButton') : t('assistant.openButton')}
          aria-expanded={open}
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      </div>
      {open && <AssistantPanel onClose={() => setOpen(false)} />}
    </>
  );
};

export default Chatbot;
