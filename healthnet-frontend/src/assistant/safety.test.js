import { emergencyIn } from './safety';
import { replyBlocks, topicFor } from './localAnswers';

// Same cases as FINAL YEAR PROJECT/tests/test_assistant.py, so both checks agree

test('emergencies are recognised', () => {
  expect(emergencyIn('I have crushing chest pain right now')).toBe('heart');
  expect(emergencyIn('I want to kill myself')).toBe('selfHarm');
  expect(emergencyIn('my face is drooping and I have slurred speech')).toBe('stroke');
  expect(emergencyIn("I can't breathe")).toBe('breathing');
});

test('ordinary questions are left alone', () => {
  ['How can I lower my stroke risk?', 'What is a heart attack risk score?', 'Does breathing exercise help?', 'Is my cholesterol high?'].forEach((text) => {
    expect(emergencyIn(text)).toBeNull();
  });
});

test('typed questions are matched to on-device topics', () => {
  expect(topicFor('Is my blood pressure ok?')).toBe('heart');
  expect(topicFor('what about my sugar levels')).toBe('diabetes');
  expect(topicFor('How can I improve?')).toBe('improve');
  expect(topicFor('Tell me a joke')).toBeNull();
});

test('cloud replies become paragraphs and lists', () => {
  expect(replyBlocks('Your score is low.\n\n- Walk daily\n* Eat **more** fibre\nSee a doctor.')).toEqual([
    { type: 'p', text: 'Your score is low.' },
    { type: 'list', items: ['Walk daily', 'Eat **more** fibre'] },
    { type: 'p', text: 'See a doctor.' },
  ]);
});
