const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";

const requireCrypto = () => {
  const cryptoInstance = (globalThis as { crypto?: Crypto }).crypto;

  if (!cryptoInstance) {
    throw new Error("Crypto API is not available in this environment");
  }

  return cryptoInstance;
};

const createRandomString = (length: number) => {
  if (length <= 0) {
    return "";
  }

  let result = "";
  const bytes = new Uint8Array(length);
  const cryptoInstance = requireCrypto();
  cryptoInstance.getRandomValues(bytes);

  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];

    if (byte === undefined) {
      continue;
    }

    const value = byte % alphabet.length;
    result += alphabet[value];
  }

  return result;
};

export const generateJobId = () => {
  const cryptoInstance = requireCrypto();
  const randomUUID = cryptoInstance.randomUUID?.bind(cryptoInstance);

  if (randomUUID) {
    return randomUUID();
  }

  return createRandomString(32);
};

export const generateLeaseToken = () => {
  return createRandomString(32);
};
