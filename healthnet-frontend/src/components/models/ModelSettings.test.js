import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '../../i18n';
import ModelSettings from './ModelSettings';

// A stand-in for src/models' store, so the screen can be tested without network or WebCrypto
const fakeStore = ({ fail } = {}) => {
  let installed = null;
  const store = {
    calls: [],
    installedInfo: async () => installed,
    check: async () => {
      store.calls.push('check');
      if (fail) throw Object.assign(new Error('x'), { code: fail });
      return { models: [{ id: 'healthnet-tagger', builtIn: '1.0.0', installed: installed?.version ?? null, latest: '1.1.0', sizeBytes: 300 * 1024, status: installed ? 'upToDate' : 'updateAvailable' }] };
    },
    install: async () => {
      store.calls.push('install');
      installed = { version: '1.1.0', installedAt: '2026-10-26T10:00:00Z', sizeBytes: 300 * 1024 };
      return '1.1.0';
    },
    remove: async () => {
      store.calls.push('remove');
      installed = null;
    },
  };
  return store;
};

const renderSettings = (store) => render(<I18nProvider><ModelSettings store={store} /></I18nProvider>);

test('shows the built-in version without going online', async () => {
  const store = fakeStore();
  renderSettings(store);
  expect(await screen.findByText('Using the built-in version 1.0.0')).toBeInTheDocument();
  expect(store.calls).toEqual([]);
});

test('checking, installing and removing an update', async () => {
  const store = fakeStore();
  renderSettings(store);
  fireEvent.click(await screen.findByRole('button', { name: 'Check for updates' }));
  expect(await screen.findByText('Version 1.1.0 is available (300 KB).')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Install 1.1.0' }));
  expect(await screen.findByText(/checked against HealthNet's signature and tested before use/)).toBeInTheDocument();
  expect(screen.getByTestId('model-status-healthnet-tagger')).toHaveTextContent('Using downloaded version 1.1.0');
  expect(screen.queryByRole('button', { name: 'Install 1.1.0' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Use the built-in version' }));
  await waitFor(() => expect(screen.getByTestId('model-status-healthnet-tagger')).toHaveTextContent('Using the built-in version 1.0.0'));
  expect(store.calls).toEqual(['check', 'install', 'remove']);
});

test('a bad signature is explained and nothing is installed', async () => {
  const store = fakeStore({ fail: 'signature' });
  renderSettings(store);
  fireEvent.click(await screen.findByRole('button', { name: 'Check for updates' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/didn't carry a valid HealthNet signature/);
  expect(store.calls).toEqual(['check']);
});
