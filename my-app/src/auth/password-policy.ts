export const ACCOUNT_PASSWORD_MIN_LENGTH = 10;

export function isValidAccountPassword(password: string) {
  return (
    password.length >= ACCOUNT_PASSWORD_MIN_LENGTH && /\d/.test(password)
  );
}
