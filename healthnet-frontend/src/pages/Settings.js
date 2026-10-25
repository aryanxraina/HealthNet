import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileText, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useUserData } from '../context/UserDataContext';
import { deleteUserData, loadActivityRange, loadFoodRange } from '../firebase';
import { disconnectGoogle } from '../api/wearables';
import { LANGUAGES, useTranslation } from '../i18n';
import { formatMeasurement } from '../lib/units';
import { saveFile, todayStamp } from '../lib/saveFile';
import { useReportDownload } from '../report/useReportDownload';
import { EnhancedReadingSetting } from '../components/import/EnhancedReading';
import DataStatusBanner from '../components/DataStatusBanner';
import DevicesSetting from '../components/devices/DevicesSetting';

const cardClass = 'bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 scroll-mt-20';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2';
const helpClass = 'text-sm text-gray-500 dark:text-gray-400';
const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

// Pick one option from a row of buttons
const SegmentedControl = ({ label, value, options, onChange }) => (
  <div>
    <p className={labelClass} id={`${label}-label`}>{label}</p>
    <div role="radiogroup" aria-labelledby={`${label}-label`} className="inline-flex flex-wrap rounded-lg bg-gray-100 dark:bg-slate-800 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            value === option.value
              ? 'bg-white dark:bg-slate-600 text-indigo-700 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
);

const SaveIndicator = ({ saveStatus, t }) => {
  if (saveStatus.state === 'saving') return <span className={helpClass}>{t('common.saving')}</span>;
  if (saveStatus.state === 'saved') return <span className="text-sm text-green-600 dark:text-green-400">{t('common.saved')} ✓</span>;
  return null;
};

// Firebase error codes from re-login and deletion, mapped to friendly messages
const deleteErrorKey = (code) => {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'settings.account.errors.wrongPassword';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'settings.account.errors.popupClosed';
    case 'auth/user-mismatch':
      return 'settings.account.errors.userMismatch';
    case 'auth/too-many-requests':
      return 'settings.account.errors.tooManyRequests';
    default:
      return 'settings.account.errors.generic';
  }
};

const downloadJson = (data, filename) =>
  saveFile(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename);

const Settings = () => {
  const { user, updateName, resetPassword, reauthenticate, deleteAccount } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useTranslation();
  const { settings, answers, results, saveStatus, updateSettings } = useUserData();
  const report = useReportDownload();
  const navigate = useNavigate();

  const [name, setName] = useState(user.displayName || '');
  const [nameNotice, setNameNotice] = useState('');
  const [resetNotice, setResetNotice] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const hasPassword = user.providers?.includes('password');
  const deleteWord = t('settings.account.deleteWord');

  // Jump to #profile etc. when arriving from the header menu
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView?.();
  }, []);

  const saveName = async (e) => {
    e.preventDefault();
    await updateName(name.trim());
    setNameNotice(t('settings.profile.nameSaved'));
  };

  const changeUnits = (changes) => updateSettings({ units: { ...settings.units, ...changes } }).catch(() => {});

  const changeTheme = (next) => {
    setTheme(next);
    updateSettings({ theme: next }).catch(() => {});
  };

  const changeLanguage = (code) => {
    setLanguage(code);
    updateSettings({ language: code }).catch(() => {});
  };

  const sendReset = async () => {
    await resetPassword(user.email);
    setResetNotice(t('settings.account.resetSent', { email: user.email }));
  };

  const exportData = async () => {
    // Every logged day ('0000-00-00' to '9999-99-99' covers all date keys)
    const [food, activity] = await Promise.all([
      loadFoodRange(user.uid, '0000-00-00', '9999-99-99').catch(() => ({})),
      loadActivityRange(user.uid, '0000-00-00', '9999-99-99').catch(() => ({})),
    ]);
    downloadJson(
      {
        exportedAt: new Date().toISOString(),
        app: 'HealthNet',
        profile: { displayName: user.displayName, email: user.email },
        settings,
        questionnaire: answers,
        results,
        foodLog: food,
        activity,
      },
      `healthnet-data-${todayStamp()}.json`
    );
  };

  const confirmDelete = async (e) => {
    e.preventDefault();
    setDeleteError('');
    setDeleting(true);
    try {
      await reauthenticate(hasPassword ? password : undefined);
    } catch (error) {
      setDeleteError(t(deleteErrorKey(error.code), { code: error.code }));
      setDeleting(false);
      return;
    }
    // End any wearable connection so the server forgets its token (nothing to do when there isn't one)
    await disconnectGoogle().catch(() => {});
    // Delete saved health data first; if that fails, keep the account so nothing is orphaned
    try {
      await deleteUserData(user.uid);
    } catch {
      setDeleteError(t('settings.account.errors.dataNotDeleted'));
      setDeleting(false);
      return;
    }
    try {
      await deleteAccount();
      navigate('/', { replace: true });
    } catch (error) {
      setDeleteError(t(deleteErrorKey(error.code), { code: error.code }));
      setDeleting(false);
    }
  };

  const unitsExample = t('settings.preferences.unitsExample', {
    height: formatMeasurement('height', 170, settings.units),
    weight: formatMeasurement('weight', 70, settings.units),
    glucose: formatMeasurement('glucose', 100, settings.units),
    temperature: formatMeasurement('temperature', 37, settings.units),
  });

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t('settings.title')}</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">{t('settings.subtitle')}</p>
      </div>

      <DataStatusBanner />

      {/* Profile */}
      <section id="profile" className={cardClass}>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">{t('settings.profile.title')}</h2>
        <form onSubmit={saveName} className="space-y-4">
          <div>
            <label htmlFor="display-name" className={labelClass}>{t('settings.profile.displayName')}</label>
            <div className="flex gap-3">
              <input
                id="display-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameNotice('');
                }}
                autoComplete="name"
                required
                className={inputClass}
              />
              <button
                type="submit"
                disabled={!name.trim() || name.trim() === (user.displayName || '')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {t('common.save')}
              </button>
            </div>
            <p className={`mt-1 ${helpClass}`}>{nameNotice || t('settings.profile.displayNameHelp')}</p>
          </div>
        </form>
        <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500 dark:text-gray-400">{t('settings.profile.email')}</dt>
            <dd className="text-gray-800 dark:text-gray-100 break-all">{user.email}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">{t('settings.profile.signInMethod')}</dt>
            <dd className="text-gray-800 dark:text-gray-100">
              {hasPassword ? t('settings.profile.methodPassword') : t('settings.profile.methodGoogle')}
            </dd>
          </div>
        </dl>
      </section>

      {/* Preferences */}
      <section id="preferences" className={cardClass}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{t('settings.preferences.title')}</h2>
          <SaveIndicator saveStatus={saveStatus} t={t} />
        </div>
        <p className={`${helpClass} mb-6`}>{t('settings.preferences.autosave')}</p>

        <div className="space-y-6">
          <div className="space-y-4">
            <SegmentedControl
              label={t('settings.preferences.measurements')}
              value={settings.units.system}
              onChange={(system) => changeUnits({ system })}
              options={[
                { value: 'metric', label: t('settings.preferences.metric') },
                { value: 'imperial', label: t('settings.preferences.imperial') },
              ]}
            />
            <SegmentedControl
              label={t('settings.preferences.labValues')}
              value={settings.units.lab}
              onChange={(lab) => changeUnits({ lab })}
              options={[
                { value: 'mg/dL', label: 'mg/dL' },
                { value: 'mmol/L', label: 'mmol/L' },
              ]}
            />
            <SegmentedControl
              label={t('settings.preferences.temperature')}
              value={settings.units.temperature}
              onChange={(temperature) => changeUnits({ temperature })}
              options={[
                { value: 'C', label: '°C' },
                { value: 'F', label: '°F' },
              ]}
            />
            <p className={helpClass}>{unitsExample}</p>
          </div>

          <SegmentedControl
            label={t('settings.preferences.theme')}
            value={theme}
            onChange={changeTheme}
            options={[
              { value: 'system', label: t('settings.preferences.themeSystem') },
              { value: 'light', label: t('settings.preferences.themeLight') },
              { value: 'dark', label: t('settings.preferences.themeDark') },
            ]}
          />

          <div>
            <label htmlFor="language" className={labelClass}>{t('settings.preferences.language')}</label>
            <select
              id="language"
              value={language}
              onChange={(e) => changeLanguage(e.target.value)}
              className={`${inputClass} sm:w-64`}
            >
              {LANGUAGES.map((option) => (
                <option key={option.code} value={option.code}>{option.label}</option>
              ))}
            </select>
            <p className={`mt-1 ${helpClass}`}>{t('settings.preferences.languageHelp')}</p>
          </div>

          <fieldset>
            <legend className={labelClass}>{t('settings.preferences.diabetesModel')}</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { value: 'findrisc', label: t('settings.preferences.findrisc'), help: t('settings.preferences.findriscHelp') },
                { value: 'ml', label: t('settings.preferences.mlModel'), help: t('settings.preferences.mlModelHelp') },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                    settings.diabetesModel === option.value
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
                      : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="diabetes-model"
                    value={option.value}
                    checked={settings.diabetesModel === option.value}
                    onChange={() => updateSettings({ diabetesModel: option.value }).catch(() => {})}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium text-gray-800 dark:text-gray-100">{option.label}</span>
                    <span className={helpClass}>{option.help}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <EnhancedReadingSetting />
        </div>
      </section>

      {/* Devices */}
      <section id="devices" className={cardClass}>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{t('devices.title')}</h2>
        <p className={`${helpClass} mt-1 mb-4`}>{t('devices.subtitle')}</p>
        <DevicesSetting />
      </section>

      {/* Your data */}
      <section id="data" className={cardClass}>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">{t('settings.data.title')}</h2>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-medium text-gray-800 dark:text-gray-100">{t('settings.data.pdf')}</p>
              <p className={helpClass}>{t('settings.data.pdfHelp')}</p>
            </div>
            <button
              type="button"
              onClick={report.download}
              disabled={report.working || !report.ready}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-wait"
            >
              {report.working ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
              {report.working ? t('report.preparing') : 'PDF'}
            </button>
          </div>
          {report.error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {t(report.error)}
            </p>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-medium text-gray-800 dark:text-gray-100">{t('settings.data.json')}</p>
              <p className={helpClass}>{t('settings.data.jsonHelp')}</p>
            </div>
            <button
              type="button"
              onClick={exportData}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              JSON
            </button>
          </div>
        </div>
      </section>

      {/* Account */}
      <section id="account" className={cardClass}>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">{t('settings.account.title')}</h2>

        <div className="pb-6 border-b border-gray-200 dark:border-slate-700">
          <p className="font-medium text-gray-800 dark:text-gray-100">{t('settings.account.password')}</p>
          {hasPassword ? (
            <div className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className={helpClass}>{resetNotice || t('settings.account.resetHelp')}</p>
              <button
                type="button"
                onClick={sendReset}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                {t('settings.account.resetButton')}
              </button>
            </div>
          ) : (
            <p className={`mt-1 ${helpClass}`}>{t('settings.account.googleManaged')}</p>
          )}
        </div>

        <div className="pt-6">
          <p className="font-medium text-red-700 dark:text-red-400">{t('settings.account.deleteTitle')}</p>
          {!deleteOpen ? (
            <div className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className={helpClass}>{t('settings.account.deleteHelp')}</p>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg font-medium hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {t('settings.account.deleteButton')}
              </button>
            </div>
          ) : (
            <form onSubmit={confirmDelete} className="mt-3 space-y-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4">
              <p className="text-sm text-red-800 dark:text-red-300">{t('settings.account.deleteWarning')}</p>
              <div>
                <label htmlFor="delete-confirm" className={labelClass}>
                  {t('settings.account.deleteTypeLabel', { word: deleteWord })}
                </label>
                <input
                  id="delete-confirm"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                  className={inputClass}
                />
              </div>
              {hasPassword ? (
                <div>
                  <label htmlFor="delete-password" className={labelClass}>{t('settings.account.deletePassword')}</label>
                  <input
                    id="delete-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className={inputClass}
                  />
                </div>
              ) : (
                <p className={helpClass}>{t('settings.account.deleteGoogleNote')}</p>
              )}
              {deleteError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{deleteError}</p>}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteOpen(false);
                    setConfirmText('');
                    setPassword('');
                    setDeleteError('');
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-slate-800 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={deleting || confirmText !== deleteWord || (hasPassword && !password)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleting ? t('settings.account.deleting') : t('settings.account.deleteConfirm')}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
};

export default Settings;
