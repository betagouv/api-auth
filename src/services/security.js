import bcrypt from 'bcryptjs';
import { parse as parseUrl } from 'url';
import { nanoid, customAlphabet } from 'nanoid/async';
import { isEmpty, isString } from 'lodash';

const nanoidPin = customAlphabet('0123456789', 10);

// TODO compare to https://github.com/anandundavia/manage-users/blob/master/src/api/utils/security.js
export const hashPassword = async plainPassword => {
  return new Promise((resolve, reject) => {
    bcrypt.hash(plainPassword, 10, function(err, hash) {
      if (err) {
        return reject(err);
      }

      return resolve(hash);
    });
  });
};

export const validatePassword = async (plainPassword, storedHash) => {
  return await bcrypt.compare(plainPassword || '', storedHash);
};

// TODO use https://www.npmjs.com/package/owasp-password-strength-test instead
// TODO call https://haveibeenpwned.com/Passwords
export const isPasswordSecure = plainPassword => {
  return plainPassword && plainPassword.length >= 10;
};

/*
 * specifications of this function can be found at
 * https://www.owasp.org/index.php/Input_Validation_Cheat_Sheet#Email_Address_Validation
 */
export const isEmailValid = email => {
  if (!isString(email) || isEmpty(email)) {
    return false;
  }

  const parts = email.split('@');

  // Check for presence of at least one @ symbol in the address
  if (parts.length < 2) {
    return false;
  }

  // Ensure the domain is no longer than 255 bytes
  const domain = parts.pop();
  if (Buffer.from(domain).length > 255) {
    return false;
  }

  // Ensure the local-part (left of the rightmost @ character) is no longer than 64 bytes
  const localPart = parts.join('');
  if (Buffer.from(localPart).length > 64) {
    return false;
  }

  return true;
};

export const generatePinToken = async () => {
  return await nanoidPin();
};

export const generateToken = async () => {
  return await nanoid();
};

export const isSiretValid = siret => {
  if (!isString(siret) || isEmpty(siret)) {
    return false;
  }

  const siretNoSpaces = siret.replace(/\s/g, '');

  return !!siretNoSpaces.match(/^\d{14}$/);
};

export const isUrlTrusted = url => {
  if (!isString(url) || isEmpty(url)) {
    return false;
  }

  const parsedUrl = parseUrl(url);

  return !!parsedUrl.hostname
    ? parsedUrl.hostname.match(/^([a-zA-Z-_0-9]*\.)?api.gouv.fr$/) !== null
    : parsedUrl.pathname.match(/^(\/[a-zA-Z-_0-9]*)+$/) !== null;
};
