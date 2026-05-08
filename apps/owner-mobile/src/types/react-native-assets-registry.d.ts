declare module "@react-native/assets-registry/registry" {
  export type PackagerAsset = {
    __packager_asset: boolean;
    fileSystemLocation: string;
    httpServerLocation: string;
    width?: number;
    height?: number;
    scales: number[];
    hash: string;
    name: string;
    type: string;
  };

  export function registerAsset(asset: PackagerAsset): number;
  export function getAssetByID(assetId: number): PackagerAsset;
}
