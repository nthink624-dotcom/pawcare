import type {
  PriceGuideV2,
  PriceGuideV2Row,
  PriceGuideV2Surcharge,
} from "@/types/price-guide-photo-import";

export type PriceGuideStructuredGroup = {
  key: string;
  label: string;
  sourceLabel: string;
  breeds: string[];
  weights: string[];
  weightNotes: Record<string, string | null>;
  services: string[];
  rowIndexes: number[];
  rows: PriceGuideV2Row[];
};

export type PriceGuideStructuredProjection = {
  groups: PriceGuideStructuredGroup[];
  unplacedRowIndexes: number[];
};

export type PriceGuideStructuredConsistencyIssue = {
  code:
    | "DUPLICATE_AXIS"
    | "DUPLICATE_CELL"
    | "DUPLICATE_SURCHARGE"
    | "CONFLICTING_SURCHARGE"
    | "EMPTY_AXIS"
    | "INVALID_AXIS"
    | "UNPLACED_CELL"
    | "UNPLACED_SURCHARGE";
  path: string;
};

export type PriceGuideStructuredRecovery = {
  document: PriceGuideV2;
  issues: PriceGuideStructuredConsistencyIssue[];
};

export type PriceGuideOrderedWeightBand = {
  label: string;
  minimum: number | null;
  maximum: number | null;
  minimumInclusive: boolean | null;
  maximumInclusive: boolean | null;
  contradictsAxis: boolean;
};

function distinct(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizedAxisKey(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[‐‑‒–—―−]/gu, "-")
    .replace(/[～〜]/gu, "~")
    .replace(/㎏/gu, "kg")
    .replace(/\s+/gu, "")
    .trim();
}

function normalizedWeightUnitKey(value: string | null | undefined) {
  return normalizedAxisKey(value).replace(/(?:킬로그램|키로그램|킬로|키로)/gu, "kg");
}

function inspectWeightBandLabel(
  value: string | null | undefined,
  minKg: number | null,
  maxKg: number | null,
) {
  const originalKey = normalizedWeightUnitKey(value);
  if (!originalKey) return {
    key: "",
    contradictsNumericBounds: false,
    minimum: null,
    maximum: null,
    minimumInclusive: null,
    maximumInclusive: null,
  };
  if (!originalKey.includes("kg")) {
    return {
      key: `label:${originalKey}`,
      contradictsNumericBounds: false,
      minimum: null,
      maximum: null,
      minimumInclusive: null,
      maximumInclusive: null,
    };
  }

  const range = /^(\d+(?:\.\d+)?)(?:kg)?[~-](\d+(?:\.\d+)?)kg$/u.exec(originalKey);
  if (range) {
    const lower = Number(range[1]);
    const upper = Number(range[2]);
    const contradictsNumericBounds = lower > upper
      || (minKg !== null && minKg !== lower)
      || (maxKg !== null && maxKg !== upper);
    return {
      key: contradictsNumericBounds ? `label:${originalKey}` : `range:${lower}:${upper}`,
      contradictsNumericBounds,
      minimum: lower,
      maximum: upper,
      minimumInclusive: null,
      maximumInclusive: null,
    };
  }

  const boundary = /^(\d+(?:\.\d+)?)kg(이하|미만|이상|초과)$/u.exec(originalKey);
  if (boundary) {
    const threshold = Number(boundary[1]);
    const comparator = boundary[2];
    const contradictsNumericBound = comparator === "이하" || comparator === "미만"
      ? maxKg !== null && maxKg !== threshold
      : minKg !== null && minKg !== threshold;
    return {
      key: contradictsNumericBound ? `label:${originalKey}` : `boundary:${comparator}:${threshold}`,
      contradictsNumericBounds: contradictsNumericBound,
      minimum: comparator === "이상" || comparator === "초과" ? threshold : null,
      maximum: comparator === "이하" || comparator === "미만" ? threshold : null,
      minimumInclusive: comparator === "이상" ? true : comparator === "초과" ? false : null,
      maximumInclusive: comparator === "이하" ? true : comparator === "미만" ? false : null,
    };
  }

  return {
    key: `label:${originalKey}`,
    contradictsNumericBounds: false,
    minimum: null,
    maximum: null,
    minimumInclusive: null,
    maximumInclusive: null,
  };
}

/**
 * Resolves only boundary ownership that is proven by adjacent, ordered labels.
 * A bare range keeps unknown inclusivity at an unanchored edge; callers must
 * fail closed for an exact boundary instead of guessing which band owns it.
 */
export function resolvePriceGuideOrderedWeightBands(
  bands: ReadonlyArray<{ label: string; minKg: number | null; maxKg: number | null }>,
): PriceGuideOrderedWeightBand[] {
  const resolved = bands.map((band) => {
    const inspected = inspectWeightBandLabel(band.label, band.minKg, band.maxKg);
    return {
      label: band.label,
      minimum: inspected.minimum,
      maximum: inspected.maximum,
      minimumInclusive: inspected.minimumInclusive,
      maximumInclusive: inspected.maximumInclusive,
      contradictsAxis: inspected.contradictsNumericBounds,
    } satisfies PriceGuideOrderedWeightBand;
  });

  for (let index = 0; index < resolved.length - 1; index += 1) {
    const left = resolved[index];
    const right = resolved[index + 1];
    if (
      left.maximum !== null
      && right.minimum === null
      && right.maximum !== null
    ) {
      if (left.maximum >= right.maximum) {
        left.contradictsAxis = true;
        right.contradictsAxis = true;
      } else {
        right.minimum = left.maximum;
        right.minimumInclusive = left.maximumInclusive === null ? null : !left.maximumInclusive;
      }
      continue;
    }
    if (
      left.maximum === null
      && left.minimum !== null
      && right.minimum !== null
    ) {
      if (left.minimum >= right.minimum) {
        left.contradictsAxis = true;
        right.contradictsAxis = true;
      } else {
        left.maximum = right.minimum;
        left.maximumInclusive = right.minimumInclusive === null ? null : !right.minimumInclusive;
      }
      continue;
    }
    if (left.maximum === null || right.minimum === null) continue;
    if (left.maximum !== right.minimum) {
      left.contradictsAxis = true;
      right.contradictsAxis = true;
      continue;
    }
    if (left.maximumInclusive !== null && right.minimumInclusive !== null) {
      if (left.maximumInclusive === right.minimumInclusive) {
        left.contradictsAxis = true;
        right.contradictsAxis = true;
      }
      continue;
    }
    if (left.maximumInclusive !== null) {
      right.minimumInclusive = !left.maximumInclusive;
    } else if (right.minimumInclusive !== null) {
      left.maximumInclusive = !right.minimumInclusive;
    }
  }

  return resolved;
}

function normalizedWeightBandKey(
  value: string | null | undefined,
  minKg: number | null,
  maxKg: number | null,
) {
  return inspectWeightBandLabel(value, minKg, maxKg).key;
}

function normalizedSurchargeConditionKey(value: string | null | undefined) {
  return normalizedAxisKey(value);
}

function explicitKrwAmount(value: string | null | undefined) {
  const matches = [...(value ?? "").matchAll(/(\d{1,3}(?:,\d{3})+|\d+)\s*원/gu)];
  if (matches.length !== 1) return null;
  const amount = Number(matches[0][1].replace(/,/gu, ""));
  return Number.isSafeInteger(amount) ? amount : null;
}

function isGroupBoundPerKgRuleDuplicate(
  surcharge: PriceGuideV2Surcharge,
  tableGroups: NonNullable<PriceGuideV2["tableGroups"]>,
) {
  if (surcharge.condition === null || surcharge.amountKrw === null || surcharge.percent !== null) return false;
  const surchargeKey = normalizedWeightUnitKey(`${surcharge.condition} ${surcharge.note ?? ""}`);
  if (!/(?:1)?kg당/u.test(surchargeKey)) return false;

  return tableGroups.some((group) => group.weightBands.some((band) => {
    const noteKey = normalizedWeightUnitKey(band.note);
    const bandKey = normalizedWeightUnitKey(band.label);
    return Boolean(
      noteKey
      && /(?:1)?kg당/u.test(noteKey)
      && explicitKrwAmount(band.note) === surcharge.amountKrw
      && bandKey
      && surchargeKey.includes(bandKey),
    );
  }));
}

function cleanBreedToken(value: string) {
  return value.replace(/[.。]+$/g, "").replace(/\s*등\s*$/u, "").trim();
}

/** Reads only explicit parenthetical or stacked breed examples from a pricing-group heading. */
export function parsePriceGuideGroupHeading(value: string | null) {
  const original = value?.trim() ?? "";
  const parenthetical = /^(.+?)\s*[（(]([^()（）]+)[）)]\s*$/u.exec(original);
  const stacked = /^(.+?)[ \t]*(?:[:：]|(?:\r?\n)+)[ \t]*([\s\S]+)$/u.exec(original);
  const match = parenthetical ?? stacked;
  if (
    !match
    || !/[,，·ㆍ/]|\s등(?:\s|[.。]|$)/u.test(match[2])
  ) {
    return { sourceLabel: original, breeds: [] as string[] };
  }
  const breeds = distinct(
    match[2].split(/[,，·ㆍ/]/u).map(cleanBreedToken).filter((breed) => breed && breed !== "등"),
  );
  return { sourceLabel: match[1].trim(), breeds };
}

/** The photographed pricing-group label is canonical in both storage and presentation. */
export function priceGuideDisplayGroupLabel(sourceLabel: string) {
  return sourceLabel;
}

export function priceGuideWeightBandLabel(row: PriceGuideV2Row) {
  const sourceLabel = row.weightBandLabel?.trim();
  if (sourceLabel) return sourceLabel;
  if (row.minKg !== null && row.maxKg !== null) return `${row.minKg}~${row.maxKg}kg`;
  if (row.maxKg !== null) return `${row.maxKg}kg 이하`;
  if (row.minKg !== null) return `${row.minKg}kg 이상`;
  if (row.sizeClass === "all") return "전체 체급";
  return null;
}

/** Separates only explicit breeds from a combined heading; it fills no missing values. */
export function normalizeImportedPriceGuideStructure(document: PriceGuideV2): PriceGuideV2 {
  const tableGroups = document.tableGroups?.map((group) => {
    const heading = parsePriceGuideGroupHeading(group.sourceLabel);
    return {
      ...group,
      sourceLabel: heading.sourceLabel || group.sourceLabel,
      breedNames: distinct([...group.breedNames, ...heading.breeds]),
    };
  });
  const rows = document.rows.map((row) => {
    const heading = parsePriceGuideGroupHeading(row.breedGroup);
    const sourceLabel = heading.sourceLabel;
    const serviceName = row.serviceName?.trim() ?? "";
    const weightLabel = priceGuideWeightBandLabel(row);
    const matchingGroups = sourceLabel && serviceName && weightLabel
      ? (tableGroups ?? []).filter((group) => (
        normalizedAxisKey(group.sourceLabel) === normalizedAxisKey(sourceLabel)
        && group.serviceNames.some((candidate) => normalizedAxisKey(candidate) === normalizedAxisKey(serviceName))
        && group.weightBands.some((band) => (
          normalizedWeightBandKey(band.label, band.minKg, band.maxKg)
          === normalizedWeightBandKey(weightLabel, row.minKg, row.maxKg)
        ))
      ))
      : [];
    const matchingGroup = matchingGroups.length === 1 ? matchingGroups[0] : null;
    if (!heading.sourceLabel && !matchingGroup) return row;
    return {
      ...row,
      ...(sourceLabel ? { breedGroup: sourceLabel } : {}),
      ...(matchingGroup && row.species === "unknown" ? { species: matchingGroup.species } : {}),
      ...(matchingGroup && row.sizeClass === "unknown" ? { sizeClass: matchingGroup.sizeClass } : {}),
      breedNames: distinct([
        ...row.breedNames,
        ...heading.breeds,
        ...(matchingGroup?.breedNames ?? []),
      ]),
    };
  });
  return {
    ...document,
    ...(tableGroups ? { tableGroups } : {}),
    rows,
  };
}

/** Clears uncertain provider values while retaining the source table axes and review provenance. */
export function preparePriceGuidePhotoDraftForReview(document: PriceGuideV2): PriceGuideV2 {
  const pendingFields = new Map<string, Set<string>>();
  document.aiReview.forEach((review) => {
    if (review.userConfirmed || review.userCorrected) return;
    const fields = pendingFields.get(review.targetId) ?? new Set<string>();
    fields.add(review.field);
    pendingFields.set(review.targetId, fields);
  });

  return normalizeImportedPriceGuideStructure({
    ...document,
    overallNote: pendingFields.get("overallNote")?.has("overallNote") ? null : document.overallNote,
    rows: document.rows.map((row, rowIndex) => {
      const fields = pendingFields.get(`rows:${rowIndex}`) ?? new Set<string>();
      const clearPrice = fields.has("priceMinKrw") || fields.has("priceMaxKrw");
      return {
        ...row,
        serviceName: fields.has("serviceName") ? null : row.serviceName,
        species: fields.has("species") ? "unknown" as const : row.species,
        breedNames: fields.has("breedNames") ? [] : row.breedNames,
        breedGroup: fields.has("breedGroup") ? null : row.breedGroup,
        sizeClass: fields.has("sizeClass") ? "unknown" as const : row.sizeClass,
        minKg: fields.has("minKg") ? null : row.minKg,
        maxKg: fields.has("maxKg") ? null : row.maxKg,
        ...(fields.has("weightBandLabel") ? { weightBandLabel: null } : {}),
        priceKind: clearPrice ? "unknown" as const : row.priceKind,
        priceMinKrw: clearPrice ? null : row.priceMinKrw,
        priceMaxKrw: clearPrice ? null : row.priceMaxKrw,
        durationMinutes: fields.has("durationMinutes") ? null : row.durationMinutes,
        note: fields.has("note") ? null : row.note,
      };
    }),
    surcharges: document.surcharges.map((surcharge, surchargeIndex) => {
      const fields = pendingFields.get(`surcharges:${surchargeIndex}`) ?? new Set<string>();
      return {
        ...surcharge,
        condition: fields.has("condition") ? null : surcharge.condition,
        amountKrw: fields.has("amountKrw") ? null : surcharge.amountKrw,
        percent: fields.has("percent") ? null : surcharge.percent,
        note: fields.has("note") ? null : surcharge.note,
      };
    }),
  });
}

/**
 * Checks that every extracted priced row maps to exactly one source table cell.
 * Missing intersections remain blank; this function never creates axes or values.
 */
export function findPriceGuideStructuredConsistencyIssues(
  document: Pick<PriceGuideV2, "rows"> & Partial<Pick<PriceGuideV2, "tableGroups">>,
): PriceGuideStructuredConsistencyIssue[] {
  if (!document.tableGroups?.length) return [];
  const issues: PriceGuideStructuredConsistencyIssue[] = [];
  const cellKeys = new Set<string>();

  document.tableGroups.forEach((group, groupIndex) => {
    if (group.serviceNames.length === 0 || group.weightBands.length === 0) {
      issues.push({ code: "EMPTY_AXIS", path: `tableGroups:${groupIndex}` });
    }
    resolvePriceGuideOrderedWeightBands(group.weightBands).forEach((band, weightIndex) => {
      if (band.contradictsAxis) {
        issues.push({ code: "INVALID_AXIS", path: `tableGroups:${groupIndex}.weightBands:${weightIndex}` });
      }
    });
    if (new Set(group.serviceNames.map(normalizedAxisKey)).size !== group.serviceNames.length) {
      issues.push({ code: "DUPLICATE_AXIS", path: `tableGroups:${groupIndex}.serviceNames` });
    }
    if (new Set(group.weightBands.map((band) => (
      normalizedWeightBandKey(band.label, band.minKg, band.maxKg)
    ))).size !== group.weightBands.length) {
      issues.push({ code: "DUPLICATE_AXIS", path: `tableGroups:${groupIndex}.weightBands` });
    }
    const isBareNumericAxis = (value: string) => /^\d+(?:\.\d+)?$/u.test(normalizedAxisKey(value));
    if (
      group.serviceNames.length > 0
      && group.weightBands.length > 0
      && group.serviceNames.every(isBareNumericAxis)
      && group.weightBands.every((band) => isBareNumericAxis(band.label))
    ) {
      issues.push({ code: "INVALID_AXIS", path: `tableGroups:${groupIndex}.numericGrid` });
    }
  });

  document.rows.forEach((row, rowIndex) => {
    const sourceLabel = parsePriceGuideGroupHeading(row.breedGroup).sourceLabel;
    const serviceName = row.serviceName?.trim() ?? "";
    const weightLabel = priceGuideWeightBandLabel(row);
    if (
      row.weightBandLabel?.trim()
      && inspectWeightBandLabel(row.weightBandLabel, row.minKg, row.maxKg).contradictsNumericBounds
    ) {
      issues.push({ code: "INVALID_AXIS", path: `rows:${rowIndex}.weightBandLabel` });
      return;
    }
    const coordinates = document.tableGroups!.flatMap((group, groupIndex) => {
      const speciesMatches = group.species === "unknown" || row.species === "unknown" || group.species === row.species;
      if (!speciesMatches || normalizedAxisKey(parsePriceGuideGroupHeading(group.sourceLabel).sourceLabel) !== normalizedAxisKey(sourceLabel)) return [];
      const serviceIndexes = group.serviceNames.flatMap((candidate, serviceIndex) => (
        normalizedAxisKey(candidate) === normalizedAxisKey(serviceName) ? [serviceIndex] : []
      ));
      const weightIndexes = group.weightBands.flatMap((band, weightIndex) => (
        normalizedWeightBandKey(band.label, band.minKg, band.maxKg)
          === normalizedWeightBandKey(weightLabel, row.minKg, row.maxKg)
          ? [weightIndex]
          : []
      ));
      return serviceIndexes.length === 1 && weightIndexes.length === 1
        ? [{ groupIndex, serviceIndex: serviceIndexes[0], weightIndex: weightIndexes[0] }]
        : [];
    });
    if (!sourceLabel || !serviceName || !weightLabel || coordinates.length !== 1) {
      issues.push({ code: "UNPLACED_CELL", path: `rows:${rowIndex}` });
      return;
    }
    const [coordinate] = coordinates;
    const cellKey = `${coordinate.groupIndex}:${coordinate.weightIndex}:${coordinate.serviceIndex}`;
    if (cellKeys.has(cellKey)) {
      issues.push({ code: "DUPLICATE_CELL", path: `rows:${rowIndex}` });
      return;
    }
    cellKeys.add(cellKey);
  });

  return issues;
}

function comparableCellValue(row: PriceGuideV2Row) {
  return JSON.stringify([
    row.priceKind,
    row.priceMinKrw,
    row.priceMaxKrw,
    row.durationMinutes,
    row.note,
  ]);
}

/**
 * Reconciles provider rows onto source-declared table axes without inventing a
 * coordinate. Harmless spacing/full-width differences are canonicalized only
 * when they resolve to one cell. Unplaced or conflicting cells are removed so
 * the corresponding table intersection stays blank and the rest of the photo
 * remains editable.
 */
export function reconcilePriceGuideStructuredDraft(document: PriceGuideV2): PriceGuideStructuredRecovery {
  const normalized = normalizeImportedPriceGuideStructure(document);
  if (!normalized.tableGroups?.length) return { document: normalized, issues: [] };

  type Candidate = {
    row: PriceGuideV2Row;
    sourceRowIndex: number;
    groupIndex: number;
    weightIndex: number;
    serviceIndex: number;
  };

  const issues: PriceGuideStructuredConsistencyIssue[] = [];
  const cells = new Map<string, Candidate[]>();

  normalized.rows.forEach((row, sourceRowIndex) => {
    const rowGroupKey = normalizedAxisKey(parsePriceGuideGroupHeading(row.breedGroup).sourceLabel);
    const rowServiceKey = normalizedAxisKey(row.serviceName);
    const rowWeightLabel = priceGuideWeightBandLabel(row);
    const rowWeightKey = normalizedWeightBandKey(rowWeightLabel, row.minKg, row.maxKg);
    const hasExplicitWeightLabel = Boolean(row.weightBandLabel?.trim());
    const candidates = normalized.tableGroups!.flatMap((group, groupIndex) => {
      const speciesMatches = group.species === "unknown" || row.species === "unknown" || group.species === row.species;
      if (!speciesMatches || normalizedAxisKey(parsePriceGuideGroupHeading(group.sourceLabel).sourceLabel) !== rowGroupKey) return [];

      const matchingServices = group.serviceNames.flatMap((serviceName, serviceIndex) => (
        normalizedAxisKey(serviceName) === rowServiceKey ? [{ serviceName, serviceIndex }] : []
      ));
      const matchingWeights = group.weightBands.flatMap((weightBand, weightIndex) => {
        const labelMatches = normalizedWeightBandKey(weightBand.label, weightBand.minKg, weightBand.maxKg) === rowWeightKey;
        const numericMatches = row.minKg === weightBand.minKg && row.maxKg === weightBand.maxKg;
        return labelMatches || (!hasExplicitWeightLabel && rowWeightKey && numericMatches) ? [{ weightBand, weightIndex }] : [];
      });
      if (matchingServices.length !== 1 || matchingWeights.length !== 1) return [];
      return [{
        group,
        groupIndex,
        serviceName: matchingServices[0].serviceName,
        serviceIndex: matchingServices[0].serviceIndex,
        weightBand: matchingWeights[0].weightBand,
        weightIndex: matchingWeights[0].weightIndex,
      }];
    });

    if (!rowGroupKey || !rowServiceKey || !rowWeightKey || candidates.length !== 1) {
      issues.push({ code: "UNPLACED_CELL", path: `rows:${sourceRowIndex}` });
      return;
    }

    const [coordinate] = candidates;
    const canonicalRow: PriceGuideV2Row = {
      ...row,
      serviceName: coordinate.serviceName,
      species: row.species === "unknown" ? coordinate.group.species : row.species,
      breedNames: distinct([...coordinate.group.breedNames, ...row.breedNames]),
      breedGroup: parsePriceGuideGroupHeading(coordinate.group.sourceLabel).sourceLabel,
      sizeClass: row.sizeClass === "unknown" ? coordinate.group.sizeClass : row.sizeClass,
      minKg: coordinate.weightBand.minKg,
      maxKg: coordinate.weightBand.maxKg,
      weightBandLabel: coordinate.weightBand.label,
    };
    const cellKey = `${coordinate.groupIndex}:${coordinate.weightIndex}:${coordinate.serviceIndex}`;
    const bucket = cells.get(cellKey) ?? [];
    bucket.push({
      row: canonicalRow,
      sourceRowIndex,
      groupIndex: coordinate.groupIndex,
      weightIndex: coordinate.weightIndex,
      serviceIndex: coordinate.serviceIndex,
    });
    cells.set(cellKey, bucket);
  });

  const recoveredRows: PriceGuideV2Row[] = [];
  const nextIndexBySourceIndex = new Map<number, number>();
  cells.forEach((candidates) => {
    const distinctValues = new Set(candidates.map(({ row }) => comparableCellValue(row)));
    if (distinctValues.size !== 1) {
      candidates.forEach(({ sourceRowIndex }) => {
        issues.push({ code: "DUPLICATE_CELL", path: `rows:${sourceRowIndex}` });
      });
      return;
    }
    const nextRowIndex = recoveredRows.length;
    recoveredRows.push(candidates[0].row);
    candidates.forEach(({ sourceRowIndex }) => nextIndexBySourceIndex.set(sourceRowIndex, nextRowIndex));
  });

  const surchargeBuckets = new Map<string, Array<{ surcharge: PriceGuideV2Surcharge; sourceIndex: number }>>();
  normalized.surcharges.forEach((surcharge, sourceIndex) => {
    const conditionKey = normalizedSurchargeConditionKey(surcharge.condition);
    const hasAmount = surcharge.amountKrw !== null;
    const hasPercent = surcharge.percent !== null;
    if (!conditionKey || hasAmount === hasPercent || isGroupBoundPerKgRuleDuplicate(surcharge, normalized.tableGroups!)) {
      issues.push({ code: "UNPLACED_SURCHARGE", path: `surcharges:${sourceIndex}` });
      return;
    }
    const bucket = surchargeBuckets.get(conditionKey) ?? [];
    bucket.push({ surcharge, sourceIndex });
    surchargeBuckets.set(conditionKey, bucket);
  });

  const recoveredSurcharges: PriceGuideV2Surcharge[] = [];
  const nextSurchargeIndexBySourceIndex = new Map<number, number>();
  surchargeBuckets.forEach((candidates) => {
    const values = new Set(candidates.map(({ surcharge }) => JSON.stringify([
      surcharge.amountKrw,
      surcharge.percent,
    ])));
    if (values.size !== 1) {
      candidates.forEach(({ sourceIndex }) => {
        issues.push({ code: "CONFLICTING_SURCHARGE", path: `surcharges:${sourceIndex}` });
      });
      return;
    }
    const nextIndex = recoveredSurcharges.length;
    recoveredSurcharges.push(candidates[0].surcharge);
    candidates.forEach(({ sourceIndex }, candidateIndex) => {
      nextSurchargeIndexBySourceIndex.set(sourceIndex, nextIndex);
      if (candidateIndex > 0) {
        issues.push({ code: "DUPLICATE_SURCHARGE", path: `surcharges:${sourceIndex}` });
      }
    });
  });

  const reviewKeys = new Set<string>();
  const aiReview = normalized.aiReview.flatMap((review) => {
    const rowTarget = /^rows:(\d+)$/.exec(review.targetId);
    const surchargeTarget = /^surcharges:(\d+)$/.exec(review.targetId);
    const nextReview = rowTarget
      ? (() => {
          const nextRowIndex = nextIndexBySourceIndex.get(Number(rowTarget[1]));
          return nextRowIndex === undefined ? null : { ...review, targetId: `rows:${nextRowIndex}` };
        })()
      : surchargeTarget
        ? (() => {
            const nextSurchargeIndex = nextSurchargeIndexBySourceIndex.get(Number(surchargeTarget[1]));
            return nextSurchargeIndex === undefined ? null : { ...review, targetId: `surcharges:${nextSurchargeIndex}` };
          })()
        : review;
    if (!nextReview) return [];
    const key = JSON.stringify([
      nextReview.targetId,
      nextReview.field,
      nextReview.confidence,
      nextReview.userConfirmed,
      nextReview.userCorrected,
    ]);
    if (reviewKeys.has(key)) return [];
    reviewKeys.add(key);
    return [nextReview];
  });

  return {
    document: { ...normalized, rows: recoveredRows, surcharges: recoveredSurcharges, aiReview },
    issues,
  };
}

/**
 * Projects one canonical row per visible price cell into source-ordered table axes.
 * Incomplete coordinates stay outside the table instead of becoming fake placeholders.
 */
export function buildPriceGuideStructuredProjection(
  document: Pick<PriceGuideV2, "rows"> & Partial<Pick<PriceGuideV2, "tableGroups">>,
): PriceGuideStructuredProjection {
  const groups = new Map<string, PriceGuideStructuredGroup>();
  const unplacedRowIndexes: number[] = [];

  document.tableGroups?.forEach((tableGroup, groupIndex) => {
    const heading = parsePriceGuideGroupHeading(tableGroup.sourceLabel);
    const sourceLabel = heading.sourceLabel || tableGroup.sourceLabel;
    const bucketKey = `${tableGroup.species}:${sourceLabel}`;
    groups.set(bucketKey, {
      key: `tableGroups:${groupIndex}`,
      label: priceGuideDisplayGroupLabel(sourceLabel),
      sourceLabel,
      breeds: distinct([...tableGroup.breedNames, ...heading.breeds]),
      weights: distinct(tableGroup.weightBands.map((band) => band.label)),
      weightNotes: Object.fromEntries(tableGroup.weightBands.map((band) => [band.label, band.note])),
      // The photographed axes are authoritative, including completely unreadable
      // columns whose intersections must stay visible as blank cells.
      services: distinct(tableGroup.serviceNames),
      rowIndexes: [],
      rows: [],
    });
  });

  document.rows.forEach((row, rowIndex) => {
    const heading = parsePriceGuideGroupHeading(row.breedGroup);
    const sourceLabel = heading.sourceLabel;
    const service = row.serviceName?.trim() ?? "";
    const weight = priceGuideWeightBandLabel(row);
    if (!sourceLabel || !service || !weight) {
      unplacedRowIndexes.push(rowIndex);
      return;
    }

    const bucketKey = `${row.species}:${sourceLabel}`;
    const group = groups.get(bucketKey) ?? {
      key: `rows:${rowIndex}`,
      label: priceGuideDisplayGroupLabel(sourceLabel),
      sourceLabel,
      breeds: [],
      weights: [],
      weightNotes: {},
      services: [],
      rowIndexes: [],
      rows: [],
    };
    group.rowIndexes.push(rowIndex);
    group.rows.push(row);
    group.breeds = distinct([...group.breeds, ...row.breedNames, ...heading.breeds]);
    if (!group.weights.includes(weight)) group.weights.push(weight);
    if (!group.services.includes(service)) group.services.push(service);
    groups.set(bucketKey, group);
  });

  return { groups: [...groups.values()], unplacedRowIndexes };
}
