// fireEvent (not userEvent) on purpose: user-event v13 loads its own copy of
// @testing-library/dom, so its events skip React's act() wrapping in this setup.
import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { __setMockUser } from './firebase';

jest.mock('./firebase');

const renderAt = (path) => {
  window.history.pushState({}, '', path);
  return render(<App />);
};

beforeEach(() => {
  localStorage.clear();
  __setMockUser(null);
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

test('saving the personal section updates questionnaire progress', () => {
  __setMockUser({ uid: 'test-user', email: 'test@example.com', displayName: 'Test User', photoURL: null });
  renderAt('/questionnaire');

  expect(screen.getByText(/0 of 3 sections complete/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /personal information/i }));
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Test User' } });
  fireEvent.click(screen.getByLabelText(/^female$/i));
  fireEvent.change(screen.getByLabelText(/age/i), { target: { value: '30' } });
  fireEvent.change(screen.getByLabelText(/height/i), { target: { value: '170' } });
  fireEvent.change(screen.getByLabelText(/weight/i), { target: { value: '65' } });
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

  expect(screen.getByText(/1 of 3 sections complete/i)).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  const saved = JSON.parse(localStorage.getItem('healthnet:questionnaire:test-user'));
  expect(saved.personal).toMatchObject({ name: 'Test User', gender: 'female', age: 30, height: 170, weight: 65 });
});
