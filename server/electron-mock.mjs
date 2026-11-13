export const app = {
  getLocaleCountryCode: () => "US",
  isPackaged: false,
  getLocale: () => "en-US",
  getPath: (name) => "./.data",
};

export const safeStorage = {
  isEncryptionAvailable: () => false,
  encryptString: (s) => Buffer.from(s),
  decryptString: (b) => b.toString(),
};

export const BrowserWindow = class {};
export const session = {};
