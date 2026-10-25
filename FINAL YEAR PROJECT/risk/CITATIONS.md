# Risk engine sources

Every score in HealthNet comes from a published model. HealthNet does not refit or "fine-tune" any of them: changing a validated equation without new outcome data would make it less trustworthy, not more. All results are educational estimates, not a diagnosis.

## Cardiovascular disease

### WHO CVD risk charts (2019): `who_cvd.py`
- **What it estimates:** 10-year risk of a fatal or non-fatal heart attack or stroke, for ages 40–80 without existing cardiovascular disease.
- **Paper:** Kaptoge S, Pennells L, De Bacquer D, et al. *World Health Organization cardiovascular disease risk charts: revised models to estimate risk in 21 global regions.* Lancet Glob Health 2019;7:e1332-45. doi:10.1016/S2214-109X(19)30318-3. Open access under CC BY 4.0.
- **Coefficients and recalibration parameters:** from the authors' Stata implementation `whocvdrisk` (S Kaptoge, L Pennells, University of Cambridge), at <https://github.com/skkceu/stata>. The files used are `whocvdrisk_erfc_score_v03.ado` and `whocvdrisk_t10_calparms_gbd_sens0.dta`, which holds the GBD 2017 region parameters. The extracted values are in `data/who_cvd.json`.
- **Method:**
  - The laboratory model (with cholesterol and diabetes) is used when total cholesterol is known; otherwise the non-laboratory model (BMI) is used.
  - Risk is recalibrated to the person's GBD region on the complementary log-log scale, as in the published charts.
- **Country mapping:** countries are mapped to GBD regions using the authors' data file. Territories without their own estimates use the region they lie in geographically; these are listed in `data/build_risk_data.py`, which regenerates both JSON files.
- **Tests:** 98 region-recalibrated reference cases from WHORiskCalculator 1.1.0 (MIT licence, <https://github.com/andredot/who_cvd_calculator>), an independent re-implementation of the Stata code. They are in `tests/fixtures/who_stata_reference.csv`.

### AHA PREVENT equations: `prevent.py`
- **What it estimates:** 10-year (and, up to age 59, 30-year) risk of total cardiovascular disease, atherosclerotic CVD, heart failure, coronary heart disease and stroke, for ages 30–79.
- **Paper:** Khan SS, Matsushita K, Sang Y, et al. *Development and validation of the American Heart Association's Predicting Risk of cardiovascular disease EVENTs (PREVENT) equations.* Circulation 2024;149:430-449. A 2026 erratum swapped the HbA1c terms, and this implementation includes that correction.
- **Coefficients:** from the `preventr` R package v0.12.1 by Martin Mayer (MIT licence, <https://github.com/martingmayer/preventr>). The extracted values are in `data/prevent.json`.
- **Variants:** the base model, or the HbA1c model when HbA1c is known. The UACR and social deprivation (US ZIP code) variants aren't used.
- **eGFR:** when only creatinine is known, eGFR is estimated with the race-free CKD-EPI 2021 equation (Inker LA et al. N Engl J Med 2021;385:1737-49).
- **Tests:** the reference cases in preventr's own test suite.

### Display bands for 10-year CVD risk
WHO and PREVENT results both use the WHO chart bands: <5%, 5–<10%, 10–<20%, 20–<30% and ≥30%.

## Blood pressure

### Framingham hypertension risk score: `framingham_htn.py`
- **What it estimates:** risk of developing high blood pressure within 1, 2 and 4 years, for adults aged 20–80 with blood pressure under 140/90, no blood-pressure treatment and no diabetes.
- **Paper:** Parikh NI, Pencina MJ, Wang TJ, et al. *A risk score for predicting near-term incidence of hypertension: the Framingham Heart Study.* Ann Intern Med 2008;148:102-110.
- **Coefficients:** the full-precision values used by the Framingham Heart Study's online calculator: <https://www.framinghamheartstudy.org/fhs-risk-functions/hypertension/>.
- **Display bands:** HealthNet shows the 4-year risk in bands of <10%, 10–<20% and ≥20%. The paper defines no categories, so these are display bands only. The result also shows the calculator's "optimal" comparison: same age and sex, BMI 22.5 and blood pressure 110.5/70.5.

## Diabetes

### FINDRISC: `findrisc.py`
- **Paper:** Lindström J, Tuomilehto J. *The diabetes risk score: a practical tool to predict type 2 diabetes risk.* Diabetes Care 2003;26:725-731.
- **Scoring:** points and the five risk bands as on the published questionnaire.
- **Licence note:** the questionnaire is distributed by the Finnish Diabetes Association. Check its terms before commercial use.

### Experimental model: `ml_diabetes.py`
- **What it is:** HealthNet's logistic regression, trained on the Pima Indians Diabetes dataset: 768 women of Pima heritage aged 21 or over (Smith JW et al., 1988).
- **How it was chosen:** `train_diabetes_model.py` compares logistic regression, a random forest and gradient boosting with 5×5 cross-validation on the training split only, with imputation inside each fold. It keeps the model with the lowest Brier score.
- **Results:**
  - Logistic regression won: cross-validated ROC-AUC 0.84, Brier 0.15 and accuracy 78%.
  - On the held-out 20%: ROC-AUC 0.81 and accuracy 71%.
- **Why it's labelled experimental:**
  - It is offered only to women aged 21 or over.
  - It uses fasting glucose where the dataset used a 2-hour glucose test.
  - Skin thickness and insulin are filled with typical values.
  - "Diabetes pedigree" is estimated from the family-history answer.

## Screeners: `screeners.py`
- **PHQ-4:** Kroenke K, Spitzer RL, Williams JBW, Löwe B. Psychosomatics 2009;50:613-621.
  - A subscale score of 3 or more counts as a positive screen.
  - The PHQ instruments are free to use (Pfizer).
- **STOP-Bang:** Chung F, Abdullah HR, Liao P. Chest 2016;149:631-638.
  - Scoring includes the high-risk refinement (2 or more STOP answers plus male sex, BMI over 35 or neck over 40 cm).
  - **Licence note:** the questionnaire is copyrighted by the University Health Network. It's free for non-commercial clinical and academic use; ask UHN about commercial licensing.
- **AUDIT-C:** Bush K, Kivlahan DR, McDonell MB, et al. Arch Intern Med 1998;158:1789-1795.
  - Positive at 4 or more points for men and 3 or more for women.
- **BMI:** WHO adult categories.
- **Waist-to-height ratio:** NICE guideline NG246 (2023). Bands are under 0.5, 0.5 to under 0.6, and 0.6 or more.

## MIT licence notices
- `preventr`: Copyright (c) 2024 preventr authors.
- WHORiskCalculator (used for test fixtures): Copyright (c) 2026 WHORiskCalculator authors.

Both are used under the MIT licence: *Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.*
