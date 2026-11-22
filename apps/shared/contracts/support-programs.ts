export type SupportProgramArea = { region: string; municipality?: string; district?: string };

export type SupportProgramCoverage = {
  included: "nationwide" | SupportProgramArea[];
  excluded: SupportProgramArea[];
};

export interface SupportProgram {
  id: string;
  title: string;
  agency: string;
  publishedAt: string | null;
  tags: string[];
  applicationPeriod: string | null;
  opensOn: string | null;
  closesOn: string | null;
  sourceUrl: string;
  calendarCoverage?: SupportProgramCoverage | null;
}

export interface SupportProgramsResponse {
  programs: SupportProgram[];
}

export const supportProgramsSource = "https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do";
