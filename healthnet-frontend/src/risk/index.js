// HealthNet's on-device risk engine: a line-by-line port of the Python reference engine in
// "FINAL YEAR PROJECT/risk", so scores are calculated in the browser and the health profile
// never leaves the device. risk/export_frontend.py copies the data files and writes the parity
// fixture that engine.test.js checks this port against.
//
// Every score is an educational estimate, not a diagnosis. Sources and licences: risk/CITATIONS.md.
import * as findrisc from './findrisc';
import * as framinghamHtn from './framinghamHtn';
import * as mlDiabetes from './mlDiabetes';
import * as prevent from './prevent';
import { validateProfile } from './profile';
import * as screeners from './screeners';
import * as whoCvd from './whoCvd';

// Same version as the Python engine it was ported from (risk/__init__.py)
export const VERSION = '1.0.0';

export const DISCLAIMER =
  'These are educational estimates from published risk models, not a diagnosis. ' +
  'Talk to a doctor or nurse about your results before making health decisions.';

export const CALCULATORS = {
  bodyComposition: screeners.bodyComposition,
  whoCvd: whoCvd.assess,
  prevent: prevent.assess,
  framinghamHtn: framinghamHtn.assess,
  findrisc: findrisc.assess,
  mlDiabetes: mlDiabetes.assess,
  phq4: screeners.phq4,
  stopBang: screeners.stopBang,
  auditC: screeners.auditC,
};

// Every score for one profile, keyed by score id. Throws RiskInputError for an invalid profile.
export const assess = (input) => {
  const profile = validateProfile(input);
  return {
    engineVersion: VERSION,
    scores: Object.fromEntries(Object.entries(CALCULATORS).map(([id, calculate]) => [id, calculate(profile)])),
    disclaimer: DISCLAIMER,
  };
};

export { RiskInputError } from './profile';
