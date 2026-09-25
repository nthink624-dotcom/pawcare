export type DataImportSource = "teepee" | "generic";
export type DataImportAction = "create" | "merge" | "skip";

export type DataImportPreviewCustomer = {
  rowNumber: number;
  sheetName: string;
  guardianName: string;
  phone: string;
  petName: string;
  breed: string;
  weightKg: number | null;
  action: DataImportAction;
  issues: string[];
  visitCount: number;
};

export type DataImportPreviewVisit = {
  rowNumber: number;
  sheetName: string;
  guardianName: string;
  phone: string;
  petName: string;
  visitDate: string;
  serviceName: string;
  actualMinutes: number | null;
  amount: number;
  action: DataImportAction;
  issues: string[];
};

export type DataImportPreviewPriceGuide = {
  rowNumber: number;
  sheetName: string;
  groupName: string;
  breedNames: string[];
  weightBand: string;
  serviceName: string;
  price: number;
  durationMinutes: number | null;
  action: DataImportAction;
  issues: string[];
};

export type DataImportPreview = {
  source: DataImportSource;
  fileName: string;
  fileSha256: string;
  summary: {
    totalRows: number;
    customerRows: number;
    visitRows: number;
    priceGuideRows: number;
    guardiansToCreate: number;
    guardiansToMerge: number;
    petsToCreate: number;
    petsToMerge: number;
    visitsToImport: number;
    priceGuideRowsToImport: number;
    skippedRows: number;
    issueRows: number;
  };
  customers: DataImportPreviewCustomer[];
  visits: DataImportPreviewVisit[];
  priceGuide: DataImportPreviewPriceGuide[];
  warnings: string[];
};

export type DataImportCommitResult = {
  batchId: string;
  alreadyImported: boolean;
  summary: {
    importedGuardians: number;
    mergedGuardians: number;
    importedPets: number;
    mergedPets: number;
    importedVisits: number;
    importedPriceGuideRows: number;
    skippedRows: number;
  };
};
