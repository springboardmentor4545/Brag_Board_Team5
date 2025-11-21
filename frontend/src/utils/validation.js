const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const isValidEmail = (value = '') => emailRegex.test(String(value).trim());

export const isStrongPassword = (value = '') => passwordRegex.test(String(value).trim());

export const PASSWORD_REQUIREMENTS = 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.';
