// Wording shared by the Dashboard risk cards and the PDF report card

// Extra lines under the headline number, specific to each score
export const detailLines = (scoreId, score, t) => {
  const d = score.details;
  switch (scoreId) {
    case 'whoCvd':
      return [t(`dashboard.risk.variants.${d.variant}`), t('dashboard.risk.whoRegion')];
    case 'prevent':
      return [
        t('dashboard.risk.preventDetails', { ascvd: d.tenYear.ascvd, hf: d.tenYear.heartFailure }),
        d.thirtyYear && t('dashboard.risk.preventThirty', { value: d.thirtyYear.totalCvd }),
        t(`dashboard.risk.variants.${d.variant}`),
      ];
    case 'framinghamHtn':
      return [
        t('dashboard.risk.framinghamDetails', { one: d.oneYear, two: d.twoYear }),
        t('dashboard.risk.framinghamOptimal', { value: d.optimalFourYear }),
      ];
    case 'findrisc':
      return [t('dashboard.risk.findriscRisk', { risk: d.tenYearRisk })];
    case 'phq4':
      return [t('dashboard.risk.phqDetails', { anxiety: d.anxiety, depression: d.depression })];
    case 'bodyComposition':
      return [
        d.waistToHeight !== undefined &&
          t('dashboard.risk.waistToHeight', {
            ratio: d.waistToHeight,
            category: t(`dashboard.risk.waistCategories.${d.waistToHeightCategory}`),
          }),
      ];
    default:
      return [];
  }
};

// "blood pressure, total cholesterol and 2 more", without repeating labels shared by several fields
export const missingLabel = (missing, t) => {
  const labels = [...new Set(missing.map((field) => t(`dashboard.risk.fields.${field}`)))];
  const shown = labels.slice(0, 2).join(', ');
  return labels.length > 2
    ? t('dashboard.risk.unlockMore', { fields: shown, count: labels.length - 2 })
    : t('dashboard.risk.unlock', { fields: shown });
};

export const reasonText = (score, t) => {
  const params = { ...score.reasonParams };
  if (params.field) params.field = t(`dashboard.risk.rangeFields.${params.field}`);
  return t(`dashboard.risk.reasons.${score.reason}`, params);
};
