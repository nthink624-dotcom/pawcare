"use client";

export const KAKAO_POSTCODE_SCRIPT_URL =
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

export type KakaoPostcodeData = {
  zonecode: string;
  address: string;
  addressType: "R" | "J";
  userSelectedType: "R" | "J";
  roadAddress: string;
  jibunAddress: string;
  buildingName: string;
  apartment: "Y" | "N";
  bname: string;
  sido: string;
  sigungu: string;
};

type KakaoPostcodeSize = {
  width: number;
  height: number;
};

type KakaoPostcodeOptions = {
  oncomplete: (data: KakaoPostcodeData) => void;
  onresize?: (size: KakaoPostcodeSize) => void;
  onclose?: (state: "FORCE_CLOSE" | "COMPLETE_CLOSE") => void;
  width?: string | number;
  height?: string | number;
  animation?: boolean;
  shorthand?: boolean;
  maxSuggestItems?: number;
  pleaseReadGuide?: number;
};

type KakaoPostcodeEmbedOptions = {
  q?: string;
  autoClose?: boolean;
};

type KakaoPostcodeInstance = {
  embed: (element: HTMLElement, options?: KakaoPostcodeEmbedOptions) => void;
  open: (options?: { q?: string; autoClose?: boolean }) => void;
};

export type KakaoPostcodeSelection = {
  zonecode: string;
  address: string;
  roadAddress: string;
  jibunAddress: string;
  buildingName: string;
};

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: KakaoPostcodeOptions) => KakaoPostcodeInstance;
    };
  }
}

let postcodeScriptPromise: Promise<void> | null = null;

export function buildKakaoPostcodeAddress(data: KakaoPostcodeData) {
  const baseRoadAddress = data.roadAddress || data.address;
  const baseJibunAddress = data.jibunAddress || data.address;
  const isRoadAddress = data.userSelectedType === "R";

  let extraAddress = "";
  if (isRoadAddress) {
    if (data.bname && /[동로가]$/u.test(data.bname)) {
      extraAddress += data.bname;
    }

    if (data.buildingName && data.apartment === "Y") {
      extraAddress += extraAddress ? `, ${data.buildingName}` : data.buildingName;
    }
  }

  const selectedAddress = isRoadAddress ? baseRoadAddress : baseJibunAddress;
  const address = isRoadAddress && extraAddress ? `${selectedAddress} (${extraAddress})` : selectedAddress;

  return {
    zonecode: data.zonecode,
    address,
    roadAddress: baseRoadAddress,
    jibunAddress: baseJibunAddress,
    buildingName: data.buildingName,
  };
}

export async function loadKakaoPostcodeScript() {
  if (typeof window === "undefined") {
    throw new Error("브라우저에서만 주소 검색을 불러올 수 있습니다.");
  }

  if (window.daum?.Postcode) {
    return;
  }

  if (!postcodeScriptPromise) {
    postcodeScriptPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[src="${KAKAO_POSTCODE_SCRIPT_URL}"]`,
      );

      const handleLoad = () => {
        if (window.daum?.Postcode) {
          resolve();
          return;
        }
        reject(new Error("카카오 우편번호 서비스를 불러오지 못했습니다."));
      };

      const handleError = () => {
        reject(new Error("카카오 우편번호 스크립트 로딩에 실패했습니다."));
      };

      if (existingScript) {
        if (window.daum?.Postcode) {
          resolve();
          return;
        }
        existingScript.addEventListener("load", handleLoad, { once: true });
        existingScript.addEventListener("error", handleError, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = KAKAO_POSTCODE_SCRIPT_URL;
      script.async = true;
      script.onload = handleLoad;
      script.onerror = handleError;
      document.head.appendChild(script);
    }).catch((error) => {
      postcodeScriptPromise = null;
      throw error;
    });
  }

  return postcodeScriptPromise;
}
