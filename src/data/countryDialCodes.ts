export interface CountryDialOption {
  code: string;
  name: string;
  dialCode: string;
  minDigits: number;
  maxDigits: number;
  stripLeadingZero?: boolean;
  example: string;
}

export const COUNTRY_DIAL_OPTIONS: CountryDialOption[] = [
  { code: 'BD', name: 'Bangladesh', dialCode: '+880', minDigits: 10, maxDigits: 10, stripLeadingZero: true, example: '1712345678' },
  { code: 'IN', name: 'India', dialCode: '+91', minDigits: 10, maxDigits: 10, stripLeadingZero: true, example: '9876543210' },
  { code: 'PK', name: 'Pakistan', dialCode: '+92', minDigits: 10, maxDigits: 10, stripLeadingZero: true, example: '3001234567' },
  { code: 'NP', name: 'Nepal', dialCode: '+977', minDigits: 10, maxDigits: 10, stripLeadingZero: true, example: '9841234567' },
  { code: 'LK', name: 'Sri Lanka', dialCode: '+94', minDigits: 9, maxDigits: 9, stripLeadingZero: true, example: '712345678' },
  { code: 'US', name: 'United States', dialCode: '+1', minDigits: 10, maxDigits: 10, example: '4155550199' },
  { code: 'CA', name: 'Canada', dialCode: '+1', minDigits: 10, maxDigits: 10, example: '4165550142' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', minDigits: 10, maxDigits: 10, stripLeadingZero: true, example: '7700900123' },
  { code: 'DE', name: 'Germany', dialCode: '+49', minDigits: 10, maxDigits: 11, stripLeadingZero: true, example: '15123456789' },
  { code: 'CH', name: 'Switzerland', dialCode: '+41', minDigits: 9, maxDigits: 9, stripLeadingZero: true, example: '791234567' },
  { code: 'AU', name: 'Australia', dialCode: '+61', minDigits: 9, maxDigits: 9, stripLeadingZero: true, example: '412345678' },
  { code: 'JP', name: 'Japan', dialCode: '+81', minDigits: 10, maxDigits: 10, stripLeadingZero: true, example: '9012345678' },
  { code: 'SG', name: 'Singapore', dialCode: '+65', minDigits: 8, maxDigits: 8, example: '81234567' },
  { code: 'KR', name: 'South Korea', dialCode: '+82', minDigits: 9, maxDigits: 10, stripLeadingZero: true, example: '1012345678' },
  { code: 'NL', name: 'Netherlands', dialCode: '+31', minDigits: 9, maxDigits: 9, stripLeadingZero: true, example: '612345678' },
  { code: 'SE', name: 'Sweden', dialCode: '+46', minDigits: 9, maxDigits: 9, stripLeadingZero: true, example: '701234567' },
  { code: 'FR', name: 'France', dialCode: '+33', minDigits: 9, maxDigits: 9, stripLeadingZero: true, example: '612345678' },
  { code: 'IT', name: 'Italy', dialCode: '+39', minDigits: 9, maxDigits: 10, example: '3471234567' },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', minDigits: 9, maxDigits: 10, stripLeadingZero: true, example: '123456789' },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', minDigits: 9, maxDigits: 9, stripLeadingZero: true, example: '501234567' },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', minDigits: 9, maxDigits: 9, stripLeadingZero: true, example: '501234567' },
  { code: 'CN', name: 'China', dialCode: '+86', minDigits: 11, maxDigits: 11, example: '13800138000' },
];

export function validateAndFormatPhone(
  countryCode: string,
  rawPhone: string,
): { valid: boolean; formatted: string; country: CountryDialOption; error?: string } {
  const country =
    COUNTRY_DIAL_OPTIONS.find((c) => c.code === countryCode) || COUNTRY_DIAL_OPTIONS[0];
  let digits = String(rawPhone || '').replace(/\D/g, '');

  const dialDigits = country.dialCode.replace('+', '');
  if (digits.startsWith(dialDigits) && digits.length > country.maxDigits) {
    digits = digits.slice(dialDigits.length);
  }
  if (country.stripLeadingZero && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (!digits) {
    return {
      valid: false,
      formatted: '',
      country,
      error: `Phone number is required for ${country.name} (${country.dialCode}).`,
    };
  }

  if (digits.length < country.minDigits || digits.length > country.maxDigits) {
    const rangeText =
      country.minDigits === country.maxDigits
        ? `${country.minDigits} digits`
        : `${country.minDigits}-${country.maxDigits} digits`;
    return {
      valid: false,
      formatted: '',
      country,
      error: `Enter a valid ${country.name} number (${rangeText} after ${country.dialCode}, e.g. ${country.example}).`,
    };
  }

  return {
    valid: true,
    formatted: `${country.dialCode}${digits}`,
    country,
  };
}
