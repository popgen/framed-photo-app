declare module "expo-asset" {
  export class Asset {
    static fromModule(moduleId: number): Asset;
    downloadAsync(): Promise<void>;
    localUri: string | null;
    uri: string;
  }
}

declare module "*.png" {
  const value: number;
  export default value;
}

declare module "heic2any" {
  export default function heic2any(options: {
    blob: Blob;
    toType?: string;
    quality?: number;
  }): Promise<Blob | Blob[]>;
}
