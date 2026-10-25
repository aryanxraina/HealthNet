import React, { useEffect, useRef, useState } from 'react';
import { Barcode, Camera, ChevronLeft, ImageIcon, PenLine, Search } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { lookupBarcode, searchFoods } from '../../api/food';
import { customEntry, entryFrom } from '../../food/nutrition';
import { DialogFrame, FooterButtons, Problem, Reading } from '../import/DialogFrame';
import { useEnhancedReading } from '../import/EnhancedReading';
import MealPhoto from './MealPhoto';

// "Add food" for one meal: search the USDA database, look up a barcode in Open Food Facts, or
// type a food in. A chosen food gets a portion, and onAdd receives the finished log entries.
// With Enhanced reading on, a meal photo can also be estimated by the cloud reader (with consent).

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-600 dark:bg-slate-900 dark:text-gray-100';
const labelClass = 'text-xs font-medium text-gray-600 dark:text-gray-300';

const TABS = [
  { id: 'search', icon: Search },
  { id: 'barcode', icon: Barcode },
  { id: 'custom', icon: PenLine },
];

const canScan = () => typeof window !== 'undefined' && 'BarcodeDetector' in window && Boolean(navigator.mediaDevices?.getUserMedia);

// Live camera scanning with the browser's BarcodeDetector (Chrome, Edge and Android browsers)
const BarcodeScanner = ({ onDetected, onError }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    let stream;
    let timer;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        const scan = async () => {
          if (stopped) return;
          const [code] = await detector.detect(videoRef.current).catch(() => []);
          if (code?.rawValue) onDetected(code.rawValue);
          else timer = setTimeout(scan, 300);
        };
        scan();
      } catch {
        onError();
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onDetected, onError]);

  return <video ref={videoRef} className="aspect-video w-full rounded-xl bg-black object-cover" muted playsInline />;
};

const per100Text = (food, t) =>
  t('food.add.per100', { kcal: Math.round(food.per100g.kcal ?? 0), protein: food.per100g.protein ?? '–', carbs: food.per100g.carbs ?? '–', fat: food.per100g.fat ?? '–' });

const PortionPicker = ({ food, meal, onAdd }) => {
  const { t } = useTranslation();
  const options = [...food.servings, { label: 'grams', grams: 1 }];
  const [choice, setChoice] = useState(0);
  const [amount, setAmount] = useState(food.servings.length > 0 ? '1' : '100');
  const option = options[choice];
  const isGrams = option.label === 'grams';
  const quantity = Number(amount) || 0;
  const grams = option.grams * quantity;
  const preview = entryFrom(food, grams);
  const amountLabel = isGrams ? `${quantity} g` : `${quantity} × ${option.label}`;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (grams > 0) onAdd(entryFrom(food, grams, amountLabel));
      }}
    >
      <div>
        <p className="font-semibold text-gray-900 dark:text-gray-100">{food.name}</p>
        {food.brand && <p className="text-sm text-gray-500 dark:text-gray-400">{food.brand}</p>}
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{per100Text(food, t)}</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className={labelClass}>
          {t('food.add.amount')}
          <input className={`${inputClass} mt-1`} type="number" min="0" step="any" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <label className={`${labelClass} col-span-2`}>
          {t('food.add.portion')}
          <select
            className={`${inputClass} mt-1`}
            value={choice}
            onChange={(event) => {
              const next = Number(event.target.value);
              setChoice(next);
              setAmount(options[next].label === 'grams' ? '100' : '1');
            }}
          >
            {options.map((item, index) => (
              <option key={item.label} value={index}>
                {item.label === 'grams' ? t('food.add.grams') : `${item.label} (${item.grams} g)`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-slate-800/60 dark:text-gray-200">
        {t('food.add.preview', { kcal: preview.kcal, protein: preview.protein ?? 0, carbs: preview.carbs ?? 0, fat: preview.fat ?? 0 })}
      </p>
      <button
        type="submit"
        disabled={grams <= 0}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
      >
        {t('food.add.addTo', { meal: t(`food.meals.${meal}`) })}
      </button>
    </form>
  );
};

const CustomFood = ({ meal, onAdd }) => {
  const { t } = useTranslation();
  const [values, setValues] = useState({ name: '', amountLabel: '', kcal: '', protein: '', carbs: '', fat: '' });
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));
  const valid = values.name.trim() && values.kcal !== '' && Number(values.kcal) >= 0;

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onAdd(customEntry(values));
      }}
    >
      <p className="text-sm text-gray-600 dark:text-gray-300">{t('food.add.customHelp')}</p>
      <label className={`${labelClass} block`}>
        {t('food.add.name')}
        <input className={`${inputClass} mt-1`} value={values.name} onChange={set('name')} placeholder={t('food.add.namePlaceholder')} />
      </label>
      <label className={`${labelClass} block`}>
        {t('food.add.portionDescription')}
        <input className={`${inputClass} mt-1`} value={values.amountLabel} onChange={set('amountLabel')} placeholder={t('food.add.portionPlaceholder')} />
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {['kcal', 'protein', 'carbs', 'fat'].map((field) => (
          <label key={field} className={labelClass}>
            {t(`food.nutrients.${field}`)}
            <input className={`${inputClass} mt-1`} type="number" min="0" step="any" inputMode="decimal" value={values[field]} onChange={set(field)} />
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={!valid}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
      >
        {t('food.add.addTo', { meal: t(`food.meals.${meal}`) })}
      </button>
    </form>
  );
};

const AddFoodDialog = ({ meal, initialTab = 'search', onClose, onAdd }) => {
  const { t } = useTranslation();
  const enhanced = useEnhancedReading();
  const tabs = enhanced.available ? [...TABS, { id: 'photo', icon: ImageIcon }] : TABS;
  const [tab, setTab] = useState(initialTab);
  const [text, setText] = useState('');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | loading | results | error | portion
  const [foods, setFoods] = useState([]);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [scanning, setScanning] = useState(false);
  const scanStopped = useRef(false);

  const fail = (failure) => {
    setError(failure.code || 'unknown');
    setPhase('error');
  };

  const runSearch = async (event) => {
    event.preventDefault();
    if (text.trim().length < 2) return;
    setPhase('loading');
    try {
      setFoods(await searchFoods(text.trim()));
      setPhase('results');
    } catch (failure) {
      fail(failure);
    }
  };

  const runLookup = async (barcode) => {
    setScanning(false);
    setPhase('loading');
    try {
      setSelected(await lookupBarcode(barcode));
      setPhase('portion');
    } catch (failure) {
      fail(failure);
    }
  };

  const choose = (food) => {
    setSelected(food);
    setPhase('portion');
  };

  const switchTab = (id) => {
    setTab(id);
    setPhase('idle');
    setScanning(false);
    setSelected(null);
  };

  const onDetected = React.useCallback((value) => {
    if (scanStopped.current) return;
    scanStopped.current = true;
    setCode(value);
    runLookup(value);
    // runLookup only uses state setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onScanError = React.useCallback(() => {
    setScanning(false);
    setError('camera');
    setPhase('error');
  }, []);

  return (
    <DialogFrame
      title={t('food.add.title', { meal: t(`food.meals.${meal}`) })}
      onClose={onClose}
      busy={false}
      focusKey={`${tab}-${phase}`}
      privacyNote={false}
      footer={
        <FooterButtons
          onBack={phase === 'portion' && tab === 'search' ? () => setPhase('results') : null}
          backLabel={
            <span className="inline-flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              {t('food.add.backToResults')}
            </span>
          }
          onCancel={onClose}
        />
      }
    >
      <div role="tablist" aria-label={t('food.add.ways')} className={`mb-4 grid gap-1 rounded-lg bg-gray-100 p-1 dark:bg-slate-800 ${tabs.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {tabs.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => switchTab(id)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium ${
              tab === id ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-600 dark:text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {t(`food.add.tabs.${id}`)}
          </button>
        ))}
      </div>

      {phase === 'portion' && selected ? (
        <PortionPicker food={selected} meal={meal} onAdd={(entry) => onAdd([entry])} />
      ) : (
        <>
          {tab === 'search' && (
            <form onSubmit={runSearch} className="flex gap-2">
              <input
                className={inputClass}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={t('food.add.searchPlaceholder')}
                aria-label={t('food.add.searchLabel')}
              />
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 dark:bg-indigo-500">
                {t('food.add.search')}
              </button>
            </form>
          )}
          {tab === 'barcode' && (
            <div className="space-y-3">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (/^\d{6,14}$/.test(code.trim())) runLookup(code.trim());
                }}
                className="flex gap-2"
              >
                <input
                  className={inputClass}
                  value={code}
                  inputMode="numeric"
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                  placeholder={t('food.add.barcodePlaceholder')}
                  aria-label={t('food.add.barcodeLabel')}
                />
                <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 dark:bg-indigo-500">
                  {t('food.add.lookUp')}
                </button>
              </form>
              {canScan() && !scanning && (
                <button
                  type="button"
                  onClick={() => {
                    scanStopped.current = false;
                    setScanning(true);
                    setPhase('idle');
                  }}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                >
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  {t('food.add.scan')}
                </button>
              )}
              {scanning && <BarcodeScanner onDetected={onDetected} onError={onScanError} />}
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('food.add.barcodeHelp')}</p>
            </div>
          )}
          {tab === 'custom' && <CustomFood meal={meal} onAdd={(entry) => onAdd([entry])} />}
          {tab === 'photo' && <MealPhoto meal={meal} providerName={enhanced.providerName} onAdd={onAdd} />}

          <div className="mt-4">
            {phase === 'loading' && <Reading message={t('food.add.loading')} />}
            {phase === 'error' && <Problem message={t(`food.errors.${error}`)} />}
            {phase === 'results' && tab === 'search' && (
              foods.length === 0 ? (
                <Problem message={t('food.add.noResults')} />
              ) : (
                <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-slate-800 dark:border-slate-700">
                  {foods.map((food) => (
                    <li key={food.id}>
                      <button type="button" onClick={() => choose(food)} className="w-full px-4 py-3 text-left hover:bg-indigo-50/60 dark:hover:bg-slate-800">
                        <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{food.name}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">{per100Text(food, t)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        </>
      )}
      {/* The photo tab sends the photo itself (with consent), so this note doesn't apply there */}
      {tab !== 'photo' && <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">{t('food.add.sources')}</p>}
    </DialogFrame>
  );
};

export default AddFoodDialog;
