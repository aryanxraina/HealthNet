// fireEvent (not userEvent) on purpose: user-event v13 loads its own copy of
// @testing-library/dom, so its events skip React's act() wrapping in this setup.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { __getMockStore, __resetMockStore, __setMockUser } from './firebase';
import { downloadReportCard } from './report/download';
import { readDocument } from './ocr/readDocument';
import { textToLines } from './ocr/labParser';

jest.mock('./firebase');
// The PDF library is ESM-only and heavy; check the call instead of rendering a PDF here
jest.mock('./report/download');
// File reading needs a browser (pdf.js, OCR); tests supply the text the reader would return
jest.mock('./ocr/readDocument', () => ({ readDocument: jest.fn() }));
// Photos are converted with a canvas, which the test environment lacks; pass files through unchanged
jest.mock('./ocr/images', () => ({ imageCanvas: async () => null, imageAsJpeg: async (file) => file }));
// Chart.js measures its container, which jsdom can't lay out; tests check the numbers shown beside the charts
jest.mock('react-chartjs-2', () => ({ Line: () => null, Bar: () => null }));

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

// ---- Dashboard risk scores ----

const fixture = require('./api/__fixtures__/assessment.json');

const yearsAgo = (years) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().slice(0, 10);
};

const dashboardAnswers = () => ({
  about: { dateOfBirth: yearsAgo(50), gender: 'female', country: 'IN', height: 160, weight: 68, waist: 86, neck: 34, _status: 'complete' },
  lifestyle: { smoking: 'never', dailyActivity: 'no', fruitVeg: 'yes', auditFrequency: 'never' },
  medical: {
    conditions: ['none'], bpMedication: 'no', statin: 'no', highGlucoseHistory: 'no', familyDiabetes: 'immediate',
    parentsHypertension: 'one', pregnancies: 2, medications: 'Metformin',
  },
  vitals: { systolic: 128, diastolic: 82, fastingGlucose: 104 },
  mental: { phq1: '2', phq2: '2', phq3: '1', phq4: '0' },
  sleep: { snoring: 'no', tired: 'yes', observedApnea: 'no' },
});

const mockApi = (response = fixture.response) => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => response });
};

afterEach(() => {
  delete global.fetch;
});

test('the dashboard invites people with no answers to the questionnaire', async () => {
  mockApi();
  __setMockUser(testUser);
  renderAt('/dashboard');

  expect(await screen.findByText('Your scores will appear here')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Start the questionnaire' })).toHaveAttribute('href', '/questionnaire');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('the dashboard shows real scores and saves them', async () => {
  mockApi();
  __getMockStore()['test-user'] = { answers: dashboardAnswers() };
  __setMockUser(testUser);
  renderAt('/dashboard');

  const who = await screen.findByRole('article', { name: 'Heart attack & stroke risk (WHO)' });
  expect(within(who).getByText('3.2')).toBeInTheDocument();
  expect(within(who).getByText('Under 5%')).toBeInTheDocument();
  expect(within(who).getByText('Without blood tests (uses BMI)')).toBeInTheDocument();

  // PREVENT needs lab results: says what to add and links to that section
  const prevent = screen.getByRole('article', { name: 'Heart disease risk (AHA PREVENT)' });
  expect(within(prevent).getByText(/add total cholesterol, hdl cholesterol and 1 more to unlock/i)).toBeInTheDocument();
  expect(within(prevent).getByRole('link', { name: /add answers/i })).toHaveAttribute('href', '/questionnaire#vitals');

  // Positive anxiety screen shows where to get help
  expect(screen.getByRole('link', { name: /find a free, confidential helpline/i })).toHaveAttribute('href', 'https://findahelpline.com');

  // Calculated on this device: nothing about the person was sent anywhere
  expect(global.fetch).not.toHaveBeenCalled();
  await waitFor(() => expect(__getMockStore()['test-user'].results.scores.whoCvd.value).toBe(3.2));
  // The fixture is the Python reference engine's output for these same answers
  const { buildProfile } = require('./api/risk');
  expect(buildProfile(dashboardAnswers())).toEqual(fixture.profile);
  expect(__getMockStore()['test-user'].results.scores).toEqual(fixture.response.scores);
});

test('saved scores are reused while the answers are unchanged', async () => {
  mockApi();
  const answers = dashboardAnswers();
  const { buildProfile, profileKey } = require('./api/risk');
  __getMockStore()['test-user'] = {
    answers,
    results: { ...fixture.response, profileKey: profileKey(buildProfile(answers)), calculatedAt: '2026-10-20T10:00:00Z' },
  };
  __setMockUser(testUser);
  renderAt('/dashboard');

  expect(await screen.findByRole('article', { name: 'Type 2 diabetes risk (FINDRISC)' })).toBeInTheDocument();
  expect(screen.getByText(/updated/i)).toHaveTextContent('Oct 20, 2026');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('the diabetes card switches between FINDRISC and the experimental model', async () => {
  mockApi();
  __getMockStore()['test-user'] = { answers: dashboardAnswers() };
  __setMockUser(testUser);
  renderAt('/dashboard');

  const findrisc = await screen.findByRole('article', { name: 'Type 2 diabetes risk (FINDRISC)' });
  expect(within(findrisc).getByText('13')).toBeInTheDocument();

  fireEvent.click(within(findrisc).getByRole('radio', { name: 'ML (experimental)' }));

  const ml = await screen.findByRole('article', { name: 'Diabetes estimate (experimental)' });
  expect(within(ml).getByText(/trained on one population of women/i)).toBeInTheDocument();
  expect(within(ml).getByText('11.9')).toBeInTheDocument();
  await waitFor(() => expect(__getMockStore()['test-user'].settings.diabetesModel).toBe('ml'));
});

test('the dashboard explains answers the risk engine cannot use', async () => {
  const answers = dashboardAnswers();
  // Outside what the questionnaire allows, e.g. saved by an older version of the app
  answers.vitals.systolic = 400;
  __getMockStore()['test-user'] = { answers };
  __setMockUser(testUser);
  renderAt('/dashboard');

  expect(await screen.findByText(/some of your answers could not be used/i)).toBeInTheDocument();
});

test('Settings downloads the PDF report card with fresh scores', async () => {
  mockApi();
  __getMockStore()['test-user'] = { answers: dashboardAnswers() };
  __setMockUser(testUser);
  renderAt('/settings');

  const pdf = await screen.findByRole('button', { name: 'PDF' });
  await waitFor(() => expect(pdf).toBeEnabled());
  fireEvent.click(pdf);

  await waitFor(() => expect(downloadReportCard).toHaveBeenCalledTimes(1));
  const [{ name, results, answers }] = downloadReportCard.mock.calls[0];
  expect(name).toBe('Test User');
  expect(results.scores.whoCvd.value).toBe(3.2);
  expect(answers.about.country).toBe('IN');
  // Scores were missing, so they were calculated on the device and saved on the way
  expect(global.fetch.mock.calls.filter(([url]) => String(url).includes('/risk/'))).toHaveLength(0);
  await waitFor(() => expect(__getMockStore()['test-user'].results.profileKey).toBeDefined());
});

test('the report card needs questionnaire answers first', async () => {
  __setMockUser(testUser);
  renderAt('/settings');

  const pdf = await screen.findByRole('button', { name: 'PDF' });
  await waitFor(() => expect(pdf).toBeEnabled());
  fireEvent.click(pdf);

  expect(await screen.findByText(/answer the health questionnaire first/i)).toBeInTheDocument();
  expect(downloadReportCard).not.toHaveBeenCalled();
});

// ---- Importing a lab report ----

const LAB_TEXT = `
  Cholesterol, Total   195  mg/dL
  HDL Cholesterol       52  mg/dL
  Hemoglobin A1c       5.6  %
  Creatinine          0.92  mg/dL
  Triglycerides        150  mg/dL
  Glucose, Fasting    1040  mg/dL
`;

const chooseFile = async () => {
  const input = await screen.findByLabelText('Choose a PDF or photo');
  fireEvent.change(input, { target: { files: [new File(['%PDF'], 'labs.pdf', { type: 'application/pdf' })] } });
};

test('a lab report is read, reviewed and saved into Vitals from the Dashboard', async () => {
  mockApi();
  readDocument.mockResolvedValue({ lines: textToLines(LAB_TEXT), method: 'pdfText' });
  __getMockStore()['test-user'] = { answers: dashboardAnswers() };
  __setMockUser(testUser);
  renderAt('/dashboard');

  fireEvent.click((await screen.findAllByRole('button', { name: 'Upload report' }))[0]);
  const dialog = screen.getByRole('dialog', { name: 'Import from a lab report' });
  expect(within(dialog).getByText(/never uploaded/i)).toBeInTheDocument();
  await chooseFile();

  expect(await within(dialog).findByRole('heading', { name: 'Check the values we found' })).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Total cholesterol')).toHaveValue(195);
  // A misread glucose of 1040 is shown but not ticked
  expect(within(dialog).getByRole('checkbox', { name: /include fasting blood sugar/i })).not.toBeChecked();
  // Untick creatinine before saving
  fireEvent.click(within(dialog).getByRole('checkbox', { name: /include creatinine/i }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save 3 values' }));

  expect(await screen.findByText(/saved 3 values from your report/i)).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() =>
    expect(__getMockStore()['test-user'].answers.vitals).toMatchObject({
      systolic: 128,
      totalCholesterol: 195,
      hdlCholesterol: 52,
      hba1c: 5.6,
    })
  );
  expect(__getMockStore()['test-user'].answers.vitals.creatinine).toBeUndefined();
});

test('values are reviewed in the units the user chose', async () => {
  readDocument.mockResolvedValue({ lines: textToLines('Total cholesterol 5.2 mmol/L'), method: 'ocr' });
  __getMockStore()['test-user'] = { settings: { units: { lab: 'mmol/L' } }, answers: {} };
  __setMockUser(testUser);
  renderAt('/dashboard');

  fireEvent.click((await screen.findAllByRole('button', { name: 'Upload report' }))[0]);
  await chooseFile();
  const dialog = screen.getByRole('dialog');
  expect(await within(dialog).findByLabelText('Total cholesterol')).toHaveValue(5.2);
  expect(within(dialog).getByText('mmol/L')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save 1 value' }));
  await waitFor(() => expect(__getMockStore()['test-user'].answers.vitals.totalCholesterol).toBeCloseTo(201.08, 1));
});

test('the Vitals step can import from a report too', async () => {
  readDocument.mockResolvedValue({ lines: textToLines(LAB_TEXT), method: 'pdfText' });
  __setMockUser(testUser);
  renderAt('/questionnaire#vitals');

  fireEvent.click(await screen.findByRole('button', { name: 'Import from a lab report' }));
  await chooseFile();
  fireEvent.click(await screen.findByRole('button', { name: 'Save 4 values' }));

  expect(await screen.findByLabelText('Total cholesterol')).toHaveValue(195);
  expect(screen.getByLabelText('HbA1c')).toHaveValue(5.6);
});

test('the import explains when nothing useful is found', async () => {
  readDocument.mockResolvedValue({ lines: textToLines('Vitamin D 32 ng/mL'), method: 'ocr' });
  __setMockUser(testUser);
  renderAt('/dashboard');

  fireEvent.click((await screen.findAllByRole('button', { name: 'Upload report' }))[0]);
  await chooseFile();
  expect(await screen.findByText(/couldn't find the values healthnet uses/i)).toBeInTheDocument();
});

// ---- Reading a prescription ----

const PRESCRIPTION_TEXT = `
  Sample Clinic            Dr. A. Example, MBBS
  Rx
  1. Tab. Metfromin 500mg  1-0-1  x 30 days  after food
  2. Tab Dolo 650  SOS
  Review after 2 weeks
`;

// Answers /drugs/match like the real API: a match for metformin, nothing for other names
const mockDrugApi = ({ offline = false } = {}) => {
  global.fetch = jest.fn(async (url) => {
    if (offline) throw new TypeError('Failed to fetch');
    const q = decodeURIComponent(String(url).split('q=')[1] || '').toLowerCase();
    const matches = /metfromin|metformin/.test(q)
      ? [{ rxcui: '861007', name: 'metformin hydrochloride 500 MG Oral Tablet', termType: 'SCD', ingredient: 'metformin', similarity: 0.89 }]
      : /atorvastatin/.test(q)
        ? [{ rxcui: '617312', name: 'atorvastatin 10 MG Oral Tablet', termType: 'SCD', ingredient: 'atorvastatin', similarity: 1 }]
        : [];
    return { ok: true, json: async () => ({ query: q, matches }) };
  });
};

const choosePrescription = async () => {
  const input = await screen.findByLabelText('Choose a photo or PDF');
  fireEvent.change(input, { target: { files: [new File(['img'], 'rx.jpg', { type: 'image/jpeg' })] } });
};

test('a prescription is read, matched against RxNorm, reviewed and added on the Medical step', async () => {
  mockDrugApi();
  readDocument.mockResolvedValue({ lines: textToLines(PRESCRIPTION_TEXT), method: 'ocr' });
  __setMockUser(testUser);
  renderAt('/questionnaire#medical');

  fireEvent.click(await screen.findByRole('button', { name: 'Add from a prescription' }));
  await choosePrescription();

  const dialog = await screen.findByRole('dialog', { name: 'Check the medicines we found' });
  expect(within(dialog).getByText(/check every medicine/i)).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Medicine 1')).toHaveValue('Metfromin');
  expect(within(dialog).getByText('Found in RxNorm: metformin hydrochloride 500 MG Oral Tablet')).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Medicine 2')).toHaveValue('Dolo 650');
  expect(within(dialog).getByText(/not found in rxnorm/i)).toBeInTheDocument();
  // Fix the misread name; a changed name drops the automatic match
  fireEvent.change(within(dialog).getByLabelText('Medicine 1'), { target: { value: 'Metformin' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save 2 medicines' }));

  expect(await screen.findByText('Metformin 500 mg · 1-0-1 (morning-afternoon-night) · After food · 30 days')).toBeInTheDocument();
  expect(screen.getByText('Dolo 650 · When needed')).toBeInTheDocument();
  await waitFor(() => expect(__getMockStore()['test-user']?.answers?.medical?.medicationList).toHaveLength(2), { timeout: 3000 });
  const [metformin] = __getMockStore()['test-user'].answers.medical.medicationList;
  expect(metformin).toMatchObject({ name: 'Metformin', strength: '500 mg', rxcui: null, source: 'prescription' });
  // Only medicine names were sent to the API
  global.fetch.mock.calls.forEach(([url]) => expect(String(url)).toMatch(/\/drugs\/match\?q=/));
});

test('medicines can be typed in, matched and removed', async () => {
  mockDrugApi();
  __setMockUser(testUser);
  renderAt('/questionnaire#medical');

  fireEvent.change(await screen.findByLabelText('Type a medicine'), { target: { value: 'Atorvastatin 10 mg at bedtime' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(await screen.findByText('Atorvastatin 10 mg · At bedtime')).toBeInTheDocument();
  expect(screen.getByText('Found in RxNorm: atorvastatin 10 MG Oral Tablet')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Atorvastatin' }));
  expect(screen.queryByText('Atorvastatin 10 mg · At bedtime')).not.toBeInTheDocument();
});

test('the Dashboard can scan a prescription into the medical history', async () => {
  mockDrugApi();
  readDocument.mockResolvedValue({ lines: textToLines(PRESCRIPTION_TEXT), method: 'ocr' });
  __getMockStore()['test-user'] = { answers: { medical: { conditions: ['none'], medicationList: [{ id: 'old', name: 'Aspirin', strength: '75 mg' }] } } };
  __setMockUser(testUser);
  renderAt('/dashboard');

  fireEvent.click(await screen.findByRole('button', { name: 'Scan prescription' }));
  await choosePrescription();
  fireEvent.click(await screen.findByRole('button', { name: 'Save 2 medicines' }));

  expect(await screen.findByText(/added 2 medicines/i)).toBeInTheDocument();
  await waitFor(() => expect(__getMockStore()['test-user'].answers.medical.medicationList.map((m) => m.name)).toEqual(['Aspirin', 'Metfromin', 'Dolo 650']));
  expect(__getMockStore()['test-user'].answers.medical.medicationList[1].rxcui).toBe('861007');
});

test('prescriptions can still be saved when the drug database is unreachable', async () => {
  mockDrugApi({ offline: true });
  readDocument.mockResolvedValue({ lines: textToLines(PRESCRIPTION_TEXT), method: 'ocr' });
  __setMockUser(testUser);
  renderAt('/dashboard');

  fireEvent.click(await screen.findByRole('button', { name: 'Scan prescription' }));
  await choosePrescription();

  const dialog = await screen.findByRole('dialog', { name: 'Check the medicines we found' });
  expect(within(dialog).getByText(/couldn't be checked right now/i)).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Save 2 medicines' })).toBeEnabled();
});

// ---- Enhanced (cloud) reading ----

// A fake HealthNet API: provider status, cloud extraction, drug matching and risk scores
const mockCloudApi = ({ extract = {}, extractStatus = 200, available = true } = {}) => {
  global.fetch = jest.fn(async (url, options = {}) => {
    const path = String(url);
    const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });
    if (path.includes('/extract/status')) return reply(200, { available, provider: 'claude', providerName: 'Claude (Anthropic)', model: 'claude-opus-5-5' });
    if (path.includes('/extract/')) return reply(extractStatus, extractStatus < 400 ? { providerName: 'Claude (Anthropic)', ...extract } : { detail: { code: 'notConfigured' } });
    if (path.includes('/drugs/match')) {
      const q = decodeURIComponent(path.split('q=')[1]).toLowerCase();
      return reply(200, { query: q, matches: q.includes('amlodipine') ? [{ rxcui: '329528', name: 'amlodipine 5 MG', termType: 'SCDC', ingredient: 'amlodipine', similarity: 1 }] : [] });
    }
    throw new Error(`unexpected request ${path}`);
  });
};

const uploadCalls = () => global.fetch.mock.calls.filter(([url, options]) => String(url).match(/\/extract\/(labReport|prescription)/) && options?.method === 'POST');

test('enhanced reading is off by default and shows the server status when switched on', async () => {
  mockCloudApi();
  __setMockUser(testUser);
  renderAt('/settings');

  const toggle = await screen.findByRole('switch', { name: /enhanced reading/i });
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(toggle);

  expect(await screen.findByText('Ready, using Claude (Anthropic).')).toBeInTheDocument();
  await waitFor(() => expect(__getMockStore()['test-user'].settings.enhancedReading).toBe(true));
});

test('enhanced reading is never offered while it is switched off', async () => {
  mockCloudApi();
  readDocument.mockResolvedValue({ lines: textToLines('Vitamin D 32 ng/mL'), method: 'ocr' });
  __setMockUser(testUser);
  renderAt('/dashboard');

  fireEvent.click((await screen.findAllByRole('button', { name: 'Upload report' }))[0]);
  await chooseFile();
  expect(await screen.findByText(/couldn't find the values healthnet uses/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Try enhanced reading' })).not.toBeInTheDocument();
  expect(uploadCalls()).toHaveLength(0);
});

test('a lab report the device cannot read is sent to the cloud only after consent', async () => {
  mockCloudApi({
    extract: { labResults: [
      { test: 'totalCholesterol', printedName: 'Cholesterol', value: 5.4, unit: 'mmol/L', sourceText: 'Cholesterol 5.4 mmol/L' },
      { test: 'glucoseUnspecified', printedName: 'Glucose', value: 99, unit: 'mg/dL', sourceText: 'Glucose 99 mg/dL' },
    ] },
  });
  readDocument.mockResolvedValue({ lines: textToLines('blurry unreadable text'), method: 'ocr' });
  __getMockStore()['test-user'] = { settings: { enhancedReading: true }, answers: {} };
  __setMockUser(testUser);
  renderAt('/dashboard');

  fireEvent.click((await screen.findAllByRole('button', { name: 'Upload report' }))[0]);
  await chooseFile();
  fireEvent.click(await screen.findByRole('button', { name: 'Try enhanced reading' }));

  expect(screen.getByText('Send this file to Claude (Anthropic)?')).toBeInTheDocument();
  expect(uploadCalls()).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Send to Claude (Anthropic)' }));

  const dialog = await screen.findByRole('dialog', { name: 'Check the values we found' });
  expect(within(dialog).getByText(/read by claude \(anthropic\)\. healthnet did not store your file/i)).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Total cholesterol')).toHaveValue(209);
  expect(within(dialog).getByText('Check that this was a fasting test.')).toBeInTheDocument();
  const [[url, options]] = uploadCalls();
  expect(url).toMatch(/\/extract\/labReport$/);
  expect(options.body).toBeInstanceOf(FormData);
  expect(options.headers.Authorization).toBe('Bearer test-token');

  fireEvent.click(within(dialog).getByRole('button', { name: 'Save 2 values' }));
  await waitFor(() => expect(__getMockStore()['test-user'].answers.vitals.totalCholesterol).toBeCloseTo(208.8, 0));
  expect(__getMockStore()['test-user'].answers.vitals.fastingGlucose).toBe(99);
});

test('a prescription can be read in the cloud and is still checked against RxNorm', async () => {
  mockCloudApi({
    extract: { medicines: [{ name: 'Amlodipine', strength: '5 mg', frequency: '0-0-1', duration: '', instructions: 'afterFood', sourceText: 'Tab Amlodipine 5mg 0-0-1 after food' }] },
  });
  readDocument.mockResolvedValue({ lines: textToLines('~~ scribbles ~~'), method: 'ocr' });
  __getMockStore()['test-user'] = { settings: { enhancedReading: true }, answers: {} };
  __setMockUser(testUser);
  renderAt('/dashboard');

  fireEvent.click(await screen.findByRole('button', { name: 'Scan prescription' }));
  // A PDF, because photos are converted to JPEG with a canvas, which the test environment lacks
  fireEvent.change(await screen.findByLabelText('Choose a photo or PDF'), { target: { files: [new File(['%PDF'], 'rx.pdf', { type: 'application/pdf' })] } });
  fireEvent.click(await screen.findByRole('button', { name: 'Try enhanced reading' }));
  fireEvent.click(screen.getByRole('button', { name: 'Send to Claude (Anthropic)' }));

  const dialog = await screen.findByRole('dialog', { name: 'Check the medicines we found' });
  expect(within(dialog).getByLabelText('Medicine 1')).toHaveValue('Amlodipine');
  expect(within(dialog).getByText('Found in RxNorm: amlodipine 5 MG')).toBeInTheDocument();
  expect(within(dialog).getByDisplayValue('0-0-1 (morning-afternoon-night)')).toBeInTheDocument();
  expect(within(dialog).getByDisplayValue('After food')).toBeInTheDocument();
});

test('enhanced reading explains server-side problems', async () => {
  mockCloudApi({ extractStatus: 503 });
  readDocument.mockResolvedValue({ lines: [], method: 'ocr' });
  __getMockStore()['test-user'] = { settings: { enhancedReading: true }, answers: {} };
  __setMockUser(testUser);
  renderAt('/dashboard');

  fireEvent.click((await screen.findAllByRole('button', { name: 'Upload report' }))[0]);
  await chooseFile();
  fireEvent.click(await screen.findByRole('button', { name: 'Try enhanced reading' }));
  fireEvent.click(screen.getByRole('button', { name: 'Send to Claude (Anthropic)' }));

  expect(await screen.findByText("Enhanced reading isn't set up on the HealthNet server yet.")).toBeInTheDocument();
});

// ---- Food log ----

const { dateKey } = require('./food/nutrition');

const BANANA = {
  id: 'usda:2709224', source: 'usda', name: 'Banana, raw', brand: null,
  per100g: { kcal: 97, protein: 0.7, carbs: 22.7, fat: 0.3, fiber: 1.7, sugar: 15.8 },
  servings: [{ label: '1 banana', grams: 126 }, { label: '1 cup, mashed', grams: 225 }],
};
const SPREAD = {
  id: 'off:3017624010701', source: 'openfoodfacts', name: 'Hazelnut spread', brand: 'Example Foods',
  per100g: { kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9, fiber: null, sugar: 56.3 }, servings: [],
};

const mockFoodApi = ({ searchStatus = 200 } = {}) => {
  global.fetch = jest.fn(async (url) => {
    const path = String(url);
    const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });
    if (path.includes('/food/search')) return searchStatus === 200 ? reply(200, { query: 'banana', foods: [BANANA] }) : reply(searchStatus, { detail: { code: 'rateLimited' } });
    if (path.includes('/food/barcode/3017624010701')) return reply(200, SPREAD);
    if (path.includes('/food/barcode/')) return reply(404, { detail: { code: 'notFound' } });
    throw new Error(`unexpected request ${path}`);
  });
};

const today = () => dateKey(new Date());

test('foods are searched, portioned and logged to the right meal', async () => {
  mockFoodApi();
  __setMockUser(testUser);
  renderAt('/food-tracker');

  expect(await screen.findAllByText('Nothing logged yet.')).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: 'Add food to Breakfast' }));
  const dialog = screen.getByRole('dialog', { name: 'Add to Breakfast' });
  fireEvent.change(within(dialog).getByLabelText('Search foods'), { target: { value: 'banana' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Search' }));
  fireEvent.click(await within(dialog).findByRole('button', { name: /banana, raw/i }));

  fireEvent.change(within(dialog).getByLabelText('Amount'), { target: { value: '2' } });
  expect(within(dialog).getByText('This portion: 244 kcal · P 1.8 g · C 57.2 g · F 0.8 g')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add to Breakfast' }));

  const breakfast = screen.getByRole('group', { name: /breakfast/i });
  expect(within(breakfast).getByText('Banana, raw')).toBeInTheDocument();
  expect(within(breakfast).getByText(/2 × 1 banana/)).toBeInTheDocument();
  expect(screen.getByTestId('calories-consumed')).toHaveTextContent('244');
  expect(screen.getByTestId('calories-remaining')).toHaveTextContent('1756');
  await waitFor(() => expect(__getMockStore()['test-user'].food[today()].breakfast[0]).toMatchObject({ name: 'Banana, raw', kcal: 244, grams: 252, sourceId: 'usda:2709224' }));
  // Only the search words were sent
  expect(String(global.fetch.mock.calls[0][0])).toMatch(/\/food\/search\?q=banana$/);
});

test('a barcode is looked up and logged by weight', async () => {
  mockFoodApi();
  __setMockUser(testUser);
  renderAt('/food-tracker');

  fireEvent.click(await screen.findByRole('button', { name: 'Look up a barcode' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Barcode number'), { target: { value: '3017624010701' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Look up' }));

  expect(await within(dialog).findByText('Hazelnut spread')).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText('Amount'), { target: { value: '15' } });
  fireEvent.click(within(dialog).getByRole('button', { name: /^Add to/ }));

  expect(await screen.findByText('Hazelnut spread')).toBeInTheDocument();
  // 15 g of 539 kcal/100 g, shown on the entry and as the meal total
  expect(screen.getAllByText('81 kcal')).toHaveLength(2);
});

test('unknown barcodes and busy food search are explained', async () => {
  mockFoodApi({ searchStatus: 429 });
  __setMockUser(testUser);
  renderAt('/food-tracker');

  fireEvent.click(await screen.findByRole('button', { name: 'Look up a barcode' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Barcode number'), { target: { value: '12345678' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Look up' }));
  expect(await within(dialog).findByText(/in open food facts yet/i)).toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole('tab', { name: 'Search' }));
  fireEvent.change(within(dialog).getByLabelText('Search foods'), { target: { value: 'rice' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Search' }));
  expect(await within(dialog).findByText(/the food database is busy/i)).toBeInTheDocument();
});

test('your own foods can be added and any entry removed', async () => {
  mockFoodApi();
  __setMockUser(testUser);
  renderAt('/food-tracker');

  fireEvent.click(await screen.findByRole('button', { name: 'Add food to Dinner' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('tab', { name: 'Your own' }));
  fireEvent.change(within(dialog).getByLabelText('Food'), { target: { value: 'Dal and rice' } });
  fireEvent.change(within(dialog).getByLabelText('Portion (optional)'), { target: { value: '1 bowl' } });
  fireEvent.change(within(dialog).getByLabelText('Calories (kcal)'), { target: { value: '520' } });
  fireEvent.change(within(dialog).getByLabelText('Protein (g)'), { target: { value: '18' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add to Dinner' }));

  const dinner = screen.getByRole('group', { name: /dinner/i });
  expect(within(dinner).getByText('Dal and rice')).toBeInTheDocument();
  fireEvent.click(within(dinner).getByRole('button', { name: 'Remove Dal and rice' }));
  expect(within(dinner).getByText('Nothing logged yet.')).toBeInTheDocument();
  await waitFor(() => expect(__getMockStore()['test-user'].food[today()].dinner).toEqual([]));
});

test('the calorie goal can be adjusted', async () => {
  __getMockStore()['test-user'] = {
    food: { [today()]: { lunch: [{ id: 'x', name: 'Sandwich', amountLabel: '1', kcal: 500, protein: 20, carbs: 50, fat: 20 }] } },
  };
  __setMockUser(testUser);
  renderAt('/food-tracker');

  expect(await screen.findByText('Sandwich')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Adjust goal' }));
  fireEvent.change(screen.getByLabelText('Daily calorie goal (kcal)'), { target: { value: '1800' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(screen.getByTestId('calories-remaining')).toHaveTextContent('1300');
  await waitFor(() => expect(__getMockStore()['test-user'].settings.calorieGoal).toBe(1800));
});

test('the weekly view summarises logged days', async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  __getMockStore()['test-user'] = {
    food: {
      [today()]: { lunch: [{ id: 'a', name: 'Salad', amountLabel: '1', kcal: 1800, protein: 0, carbs: 0, fat: 0 }] },
      [dateKey(yesterday)]: { dinner: [{ id: 'b', name: 'Pasta', amountLabel: '1', kcal: 2200, protein: 0, carbs: 0, fat: 0 }] },
    },
  };
  __setMockUser(testUser);
  renderAt('/food-tracker');

  fireEvent.click(await screen.findByRole('button', { name: 'Weekly view' }));
  expect(await screen.findByText('Average on logged days: 2000 kcal')).toBeInTheDocument();
});

test('a meal photo is estimated in the cloud only with consent, then reviewed and logged', async () => {
  global.fetch = jest.fn(async (url) => {
    const path = String(url);
    const reply = (body) => ({ ok: true, status: 200, json: async () => body });
    if (path.includes('/extract/status')) return reply({ available: true, provider: 'claude', providerName: 'Claude (Anthropic)', model: 'claude-opus-5-5' });
    if (path.includes('/extract/mealPhoto')) {
      return reply({ foods: [
        { name: 'Boiled white rice', portion: '1 cup', grams: 158, kcal: 205, protein: 4.3, carbs: 44.5, fat: 0.4 },
        { name: 'Lentil curry', portion: '1 bowl', grams: 200, kcal: 230, protein: 12, carbs: 30, fat: 6 },
      ] });
    }
    throw new Error(`unexpected request ${path}`);
  });
  __getMockStore()['test-user'] = { settings: { enhancedReading: true } };
  __setMockUser(testUser);
  renderAt('/food-tracker');

  fireEvent.click(await screen.findByRole('button', { name: 'Add food to Lunch' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.click(await within(dialog).findByRole('tab', { name: 'Photo' }));
  fireEvent.change(within(dialog).getByLabelText('Take or choose a photo of your meal'), {
    target: { files: [new File(['jpg'], 'lunch.jpg', { type: 'image/jpeg' })] },
  });

  expect(within(dialog).getByText('Send this file to Claude (Anthropic)?')).toBeInTheDocument();
  expect(global.fetch.mock.calls.some(([url]) => String(url).includes('/extract/mealPhoto'))).toBe(false);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Send to Claude (Anthropic)' }));

  expect(await within(dialog).findByText(/these are ai estimates/i)).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText('Calories (kcal) 2'), { target: { value: '260' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add 2 to Lunch' }));

  const lunch = screen.getByRole('group', { name: /lunch/i });
  expect(within(lunch).getByText('Boiled white rice')).toBeInTheDocument();
  expect(within(lunch).getByText('Lentil curry')).toBeInTheDocument();
  expect(screen.getByTestId('calories-consumed')).toHaveTextContent('465');
  await waitFor(() => expect(__getMockStore()['test-user'].food[today()].lunch.map((entry) => entry.source)).toEqual(['photo', 'photo']));
});

test('the Photo tab only appears when Enhanced reading is on', async () => {
  mockFoodApi();
  __setMockUser(testUser);
  renderAt('/food-tracker');

  fireEvent.click(await screen.findByRole('button', { name: 'Add food to Lunch' }));
  expect(screen.getByRole('tab', { name: 'Search' })).toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: 'Photo' })).not.toBeInTheDocument();
});

// ---- Wearable sync (Google Health) ----

const daysAgo = (n) => {
  const day = new Date();
  day.setDate(day.getDate() - n);
  return dateKey(day);
};

const mockWearableApi = ({ available = true, connected = false, lastSyncAt = null, days = [], syncStatus = 200, syncCode } = {}) => {
  global.fetch = jest.fn(async (url, options = {}) => {
    const path = String(url);
    const reply = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
    if (path.includes('/wearables/status')) {
      return reply({ providers: [{ id: 'google', available, connected, connectedAt: connected ? '2026-10-01T09:00:00Z' : null, lastSyncAt }] });
    }
    if (path.includes('/wearables/google/sync') && options.method === 'POST') {
      return syncStatus === 200 ? reply({ provider: 'google', days }) : reply({ detail: { code: syncCode } }, syncStatus);
    }
    if (path.includes('/wearables/google/disconnect') && options.method === 'POST') {
      connected = false;
      return reply({ connected: false });
    }
    throw new Error(`unexpected request ${path}`);
  });
};

const wearableCalls = (part) => global.fetch.mock.calls.filter(([url]) => String(url).includes(part));

test('Settings explains when device syncing is not set up on the server', async () => {
  mockWearableApi({ available: false });
  __setMockUser(testUser);
  renderAt('/settings');

  expect(await screen.findByText('Not set up on this HealthNet server yet.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
  expect(screen.getByText('Oura')).toBeInTheDocument();
});

test('coming back from Google connects, syncs 30 days and saves them to the account', async () => {
  mockWearableApi({
    connected: true,
    days: [
      { date: daysAgo(1), steps: 9100, restingHeartRate: 59, sleepMinutes: 450 },
      { date: daysAgo(0), steps: 2300, restingHeartRate: null, sleepMinutes: 437 },
    ],
  });
  __getMockStore()['test-user'] = { settings: {} };
  __setMockUser(testUser);
  renderAt('/settings?device=google&result=connected');

  expect(await screen.findByText('Synced 2 days of readings.')).toBeInTheDocument();
  const [syncUrl] = wearableCalls('/wearables/google/sync')[0];
  expect(syncUrl).toContain(`end=${today()}`);
  expect(syncUrl).toContain('days=30');
  const store = __getMockStore()['test-user'];
  expect(store.activity[daysAgo(1)]).toEqual({ steps: 9100, restingHeartRate: 59, sleepMinutes: 450, source: 'google' });
  await waitFor(() => expect(__getMockStore()['test-user'].settings.connectedDevice).toBe('google'));
  // The return address is tidied away so a reload doesn't sync again
  expect(window.location.search).toBe('');
});

test('a refused Google sign-in is explained', async () => {
  mockWearableApi();
  __setMockUser(testUser);
  renderAt('/settings?device=google&result=denied');
  expect(await screen.findByText(/wasn't connected because access wasn't allowed/i)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId('google-health-status')).toHaveTextContent('Not connected'));
  expect(wearableCalls('/sync')).toHaveLength(0);
});

test('disconnecting ends the connection and clears the Dashboard hint', async () => {
  mockWearableApi({ connected: true, lastSyncAt: new Date().toISOString() });
  __getMockStore()['test-user'] = { settings: { connectedDevice: 'google' } };
  __setMockUser(testUser);
  renderAt('/settings');

  fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
  expect(await screen.findByText(/HealthNet can no longer read from Google Health/)).toBeInTheDocument();
  expect(wearableCalls('/wearables/google/disconnect')).toHaveLength(1);
  // The status is asked again and no longer shows a connection
  await waitFor(() => expect(screen.getByTestId('google-health-status')).toHaveTextContent('Not connected'));
  expect(screen.getByRole('button', { name: 'Connect' })).toBeEnabled();
  await waitFor(() => expect(__getMockStore()['test-user'].settings.connectedDevice).toBeNull());
});

test('the Dashboard shows synced activity without calling the server when it synced recently', async () => {
  mockWearableApi({ connected: true, lastSyncAt: new Date().toISOString() });
  __getMockStore()['test-user'] = {
    settings: { connectedDevice: 'google' },
    activity: {
      [daysAgo(2)]: { steps: 8000, restingHeartRate: 62, sleepMinutes: 400, source: 'google' },
      [daysAgo(1)]: { steps: 10000, restingHeartRate: 60, sleepMinutes: 437, source: 'google' },
    },
  };
  __setMockUser(testUser);
  renderAt('/dashboard');

  expect(await screen.findByTestId('activity-latest')).toHaveTextContent('10,000 steps');
  expect(screen.getByTestId('activity-average')).toHaveTextContent('9,000 steps');
  fireEvent.click(screen.getByRole('radio', { name: 'Sleep' }));
  expect(screen.getByTestId('activity-latest')).toHaveTextContent('7.3 h');
  fireEvent.click(screen.getByRole('radio', { name: 'Resting heart rate' }));
  expect(screen.getByTestId('activity-latest')).toHaveTextContent('60 bpm');
  expect(await screen.findByText(/From Google Health · synced/)).toBeInTheDocument();
  expect(wearableCalls('/sync')).toHaveLength(0);
});

test('the Dashboard syncs by itself when the last sync is old', async () => {
  mockWearableApi({
    connected: true,
    lastSyncAt: '2026-01-01T00:00:00Z',
    days: [{ date: daysAgo(0), steps: 4321, restingHeartRate: null, sleepMinutes: null }],
  });
  __getMockStore()['test-user'] = { settings: { connectedDevice: 'google' } };
  __setMockUser(testUser);
  renderAt('/dashboard');

  expect(await screen.findByTestId('activity-latest')).toHaveTextContent('4,321 steps');
  expect(wearableCalls('/sync')).toHaveLength(1);
});

test('the Dashboard asks to reconnect when Google access has ended', async () => {
  mockWearableApi({ connected: true, syncStatus: 409, syncCode: 'reconnect' });
  __getMockStore()['test-user'] = { settings: { connectedDevice: 'google' } };
  __setMockUser(testUser);
  renderAt('/dashboard');

  expect(await screen.findByText(/Google Health access has ended/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open Settings' })).toHaveAttribute('href', '/settings#devices');
  await waitFor(() => expect(__getMockStore()['test-user'].settings.connectedDevice).toBeNull());
});

test('without a device the Dashboard points to Settings and never calls the wearable API', async () => {
  mockWearableApi();
  __setMockUser(testUser);
  renderAt('/dashboard');

  expect(await screen.findByRole('link', { name: 'Connect a device' })).toHaveAttribute('href', '/settings#devices');
  expect(wearableCalls('/wearables')).toHaveLength(0);
});
