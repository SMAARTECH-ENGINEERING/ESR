import { AES, enc } from "crypto-js";

const secretKey = "esr-secret-key";

export const encryptData = (data) => {
  try {
    const jsonString = JSON.stringify(data);

    const encryptedData = AES.encrypt(
      jsonString,
      secretKey
    ).toString();

    localStorage.setItem("encryptedData", encryptedData);
  } catch (error) {
    console.error("Encrypt Error:", error);
  }
};

export const decryptData = () => {
  try {
    const encryptedData =
      localStorage.getItem("encryptedData");

    if (!encryptedData) return null;

    const decryptedData = AES.decrypt(
      encryptedData,
      secretKey
    ).toString(enc.Utf8);

    return JSON.parse(decryptedData);
  } catch (error) {
    console.error("Decrypt Error:", error);
    return null;
  }
};