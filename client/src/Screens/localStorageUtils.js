// localStorageUtils.js

import { AES, enc } from 'crypto-js';

const secretKey = 'your-secret-key';

export const encryptData = (data) => {
  try {
    const jsonString = JSON.stringify(data);
    const encryptedData = AES.encrypt(jsonString, secretKey).toString();
    localStorage.setItem('encryptedData', encryptedData);
  } catch (error) {
    console.error('Error encrypting data:', error);
  }
};

export const decryptData = () => {
  try {
    const encryptedData = localStorage.getItem('encryptedData');

    if (!encryptedData) {
      return null;
    }

    const decryptedData = AES.decrypt(encryptedData, secretKey).toString(enc.Utf8);
    const data = JSON.parse(decryptedData);
    return data;
  } catch (error) {
    console.error('Error decrypting data:', error);
    return null;
  }
};
