// fireEvent (not userEvent) on purpose: user-event v13 loads its own copy of
// @testing-library/dom, so its events skip React's act() wrapping in this setup.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { __getMockStore, __resetMockStore, __setMockUser } from './firebase';

jest.mock('./firebase');

const testUser = {
  uid: 'test-user',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: null,
  providerData: [{ providerId: 'password' }],
};

const renderAt = (path) => {
  window.history.pushState({}, '', path);
  return render(<App />);
};

beforeEach(() => {
  localStorage.clear();
  __resetMockStore();
  __setMockUser(null);
  document.documentElement.classList.remove('dark');
});

test('renders the home page for signed-out visitors', () => {
  renderAt('/');

  expect(screen.getByRole('heading', { level: 1, name: /preventive healthcare for everyone/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
});

test('sends signed-out visitors from the dashboard to sign in', () => {
  renderAt('/dashboard');

  expect(screen.getByRole('heading', { name: /sign in to healthnet/i })).toBeInTheDocument();
});

const fillAboutYou = () => {
  fireEvent.change(screen.getByLabelText('What is your date of birth?'), { target: { value: '1985-04-12' } });
  fireEvent.click(within(screen.getByRole('group', { name: /what is your gender/i })).getByRole('radio', { name: 'Female' }));
  fireEvent.change(screen.getByLabelText('Which country do you live in?'), { target: { value: 'GB' } });
};

test('completing About you saves answers in standard units and moves on', async () => {
  __setMockUser(testUser);
  renderAt('/questionnaire');

  expect(await screen.findByRole('heading', { name: 'About you' })).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: /questionnaire progress/i })).toHaveAttribute('aria-valuenow', '0');

  fillAboutYou();
  fireEvent.change(screen.getByLabelText('How tall are you?'), { target: { value: '170' } });
  fireEvent.change(screen.getByLabelText('How much do you weigh?'), { target: { value: '65' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));

  expect(await screen.findByRole('heading', { name: 'Lifestyle' })).toBeInTheDocument();
  expect(Number(screen.getByRole('progressbar', { name: /questionnaire progress/i }).getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  expect(screen.getByText(/unlocked: bmi & waist-to-height/i)).toBeInTheDocument();
  await waitFor(() =>
    expect(__getMockStore()['test-user'].answers.about).toEqual({
      dateOfBirth: '1985-04-12',
      gender: 'female',
      country: 'GB',
      height: 170,
      weight: 65,
      _status: 'complete',
    })
  );
});

test('imperial answers are converted to cm and kg', async () => {
  __getMockStore()['test-user'] = { settings: { units: { system: 'imperial' } } };
  __setMockUser(testUser);
  renderAt('/questionnaire');

  await screen.findByRole('heading', { name: 'About you' });
  fillAboutYou();
  fireEvent.change(screen.getByRole('spinbutton', { name: 'ft' }), { target: { value: '5' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'in' }), { target: { value: '7' } });
  fireEvent.change(screen.getByLabelText('How much do you weigh?'), { target: { value: '154' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));

  await screen.findByRole('heading', { name: 'Lifestyle' });
  const saved = __getMockStore()['test-user'].answers.about;
  expect(saved.height).toBeCloseTo(170.18, 2);
  expect(saved.weight).toBeCloseTo(69.853, 2);
});

test('Next points out missing answers instead of moving on', async () => {
  __setMockUser(testUser);
  renderAt('/questionnaire');

  await screen.findByRole('heading', { name: 'About you' });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));

  expect(screen.getByRole('alert')).toHaveTextContent(/need attention/i);
  expect(screen.getAllByText('Please answer this question.')).toHaveLength(5);
  expect(screen.getByLabelText('What is your date of birth?')).toHaveFocus();
  expect(screen.getByRole('heading', { name: 'About you' })).toBeInTheDocument();
});

test("a non-binary gender asks which sex to use, and women see the women's health section", async () => {
  __setMockUser(testUser);
  renderAt('/questionnaire');

  await screen.findByRole('heading', { name: 'About you' });
  const nav = screen.getByRole('navigation', { name: /questionnaire sections/i });
  expect(within(nav).queryByRole('button', { name: /women's health/i })).not.toBeInTheDocument();

  fireEvent.click(within(screen.getByRole('group', { name: /what is your gender/i })).getByRole('radio', { name: 'Non-binary' }));
  const riskSex = screen.getByRole('group', { name: /which sex should we use/i });
  fireEvent.click(within(riskSex).getByRole('radio', { name: 'Female' }));

  expect(within(nav).getByRole('button', { name: /women's health/i })).toBeInTheDocument();
});

test('"None of these" clears the other conditions', async () => {
  __setMockUser(testUser);
  renderAt('/questionnaire#medical');

  const group = await screen.findByRole('group', { name: /has a doctor ever told you/i });
  fireEvent.click(within(group).getByRole('checkbox', { name: 'Diabetes' }));
  fireEvent.click(within(group).getByRole('checkbox', { name: 'Asthma or COPD' }));
  fireEvent.click(within(group).getByRole('checkbox', { name: 'None of these' }));

  expect(within(group).getByRole('checkbox', { name: 'None of these' })).toBeChecked();
  expect(within(group).getByRole('checkbox', { name: 'Diabetes' })).not.toBeChecked();
  expect(within(group).getByRole('checkbox', { name: 'Asthma or COPD' })).not.toBeChecked();
});

test('answers from the first questionnaire version move to the cloud and the new sections', async () => {
  localStorage.setItem(
    'healthnet:questionnaire:test-user',
    JSON.stringify({
      personal: { name: 'Test User', gender: 'female', age: 30, height: 170, weight: 65 },
      lifestyle: { exercise: 'daily', smoking: 'never', alcohol: 'never' },
    })
  );
  __setMockUser(testUser);
  renderAt('/questionnaire');

  await screen.findByRole('heading', { name: 'About you' });
  await waitFor(() =>
    expect(__getMockStore()['test-user'].answers.lifestyle).toEqual({ smoking: 'never', exerciseFrequency: 'daily' })
  );
  expect(__getMockStore()['test-user'].answers.about).toEqual({ gender: 'female', height: 170, weight: 65 });
  expect(screen.getByLabelText('How tall are you?')).toHaveValue(170);
  expect(localStorage.getItem('healthnet:questionnaire:test-user')).toBeNull();
});

test('finished questionnaires open on the review step', async () => {
  const complete = { _status: 'complete' };
  __getMockStore()['test-user'] = {
    answers: {
      about: { dateOfBirth: '1980-01-01', gender: 'male', country: 'US', height: 180, weight: 85, ...complete },
      lifestyle: { smoking: 'never', dailyActivity: 'yes', fruitVeg: 'yes', auditFrequency: 'never', ...complete },
      medical: {
        conditions: ['none'],
        bpMedication: 'no',
        statin: 'no',
        highGlucoseHistory: 'no',
        familyDiabetes: 'no',
        parentsHypertension: 'none',
        ...complete,
      },
      vitals: { _status: 'skipped' },
      mental: { phq1: '0', phq2: '0', phq3: '0', phq4: '0', ...complete },
      sleep: { _status: 'skipped' },
      checkups: { _status: 'skipped' },
      devices: { _status: 'skipped' },
    },
  };
  __setMockUser(testUser);
  renderAt('/questionnaire');

  expect(await screen.findByRole('heading', { name: "You're all set" })).toBeInTheDocument();
  expect(screen.getByText('100% complete')).toBeInTheDocument();
  const row = (name) => screen.getAllByRole('listitem').find((item) => item.textContent.startsWith(name));
  expect(row('Anxiety & mood check (PHQ-4)')).toHaveTextContent('Ready');
  expect(row('Diabetes estimate (experimental)')).toHaveTextContent('Women only');

  fireEvent.click(screen.getByRole('button', { name: 'Edit: Lifestyle' }));
  expect(await screen.findByRole('heading', { name: 'Lifestyle' })).toBeInTheDocument();
});

test('switching to dark mode applies and saves the theme', async () => {
  __setMockUser(testUser);
  renderAt('/settings');

  fireEvent.click(await screen.findByRole('radio', { name: 'Dark' }));

  expect(document.documentElement).toHaveClass('dark');
  await waitFor(() => expect(__getMockStore()['test-user'].settings.theme).toBe('dark'));
});

test('changing the display name updates the header', async () => {
  __setMockUser(testUser);
  renderAt('/settings');

  const input = await screen.findByLabelText(/display name/i);
  fireEvent.change(input, { target: { value: 'Alex Morgan' } });
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

  expect(await screen.findByText('Name updated.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /alex morgan/i })).toBeInTheDocument();
});

test('deleting the account removes saved data and signs out', async () => {
  __setMockUser(testUser);
  renderAt('/settings');
  fireEvent.click(await screen.findByRole('radio', { name: 'Dark' }));
  await waitFor(() => expect(__getMockStore()['test-user']).toBeDefined());

  fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
  const confirmButton = screen.getByRole('button', { name: /permanently delete/i });
  expect(confirmButton).toBeDisabled();

  fireEvent.change(screen.getByLabelText(/type delete to confirm/i), { target: { value: 'DELETE' } });
  fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: 'secret123' } });
  fireEvent.click(confirmButton);

  expect(await screen.findByRole('link', { name: /sign in/i })).toBeInTheDocument();
  expect(__getMockStore()['test-user']).toBeUndefined();
});
