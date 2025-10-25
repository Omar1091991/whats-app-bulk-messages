export interface CountryCode {
  code: string
  name: string
  nameAr: string
  flag: string
  dialCode: string
  format: string
  placeholder: string
}

export const COUNTRY_CODES: CountryCode[] = [
  {
    code: "SA",
    name: "Saudi Arabia",
    nameAr: "السعودية",
    flag: "🇸🇦",
    dialCode: "+966",
    format: "5XXXXXXXX",
    placeholder: "5xxxxxxxx أو 05xxxxxxxx",
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    nameAr: "الإمارات",
    flag: "🇦🇪",
    dialCode: "+971",
    format: "5XXXXXXXX",
    placeholder: "5xxxxxxxx أو 05xxxxxxxx",
  },
  {
    code: "EG",
    name: "Egypt",
    nameAr: "مصر",
    flag: "🇪🇬",
    dialCode: "+20",
    format: "1XXXXXXXXX",
    placeholder: "1xxxxxxxxx أو 01xxxxxxxxx",
  },
  {
    code: "KW",
    name: "Kuwait",
    nameAr: "الكويت",
    flag: "🇰🇼",
    dialCode: "+965",
    format: "XXXXXXXX",
    placeholder: "xxxxxxxx",
  },
  {
    code: "QA",
    name: "Qatar",
    nameAr: "قطر",
    flag: "🇶🇦",
    dialCode: "+974",
    format: "XXXXXXXX",
    placeholder: "xxxxxxxx",
  },
  {
    code: "BH",
    name: "Bahrain",
    nameAr: "البحرين",
    flag: "🇧🇭",
    dialCode: "+973",
    format: "XXXXXXXX",
    placeholder: "xxxxxxxx",
  },
  {
    code: "OM",
    name: "Oman",
    nameAr: "عمان",
    flag: "🇴🇲",
    dialCode: "+968",
    format: "XXXXXXXX",
    placeholder: "xxxxxxxx",
  },
  {
    code: "JO",
    name: "Jordan",
    nameAr: "الأردن",
    flag: "🇯🇴",
    dialCode: "+962",
    format: "7XXXXXXXX",
    placeholder: "7xxxxxxxx",
  },
  {
    code: "LB",
    name: "Lebanon",
    nameAr: "لبنان",
    flag: "🇱🇧",
    dialCode: "+961",
    format: "XXXXXXXX",
    placeholder: "xxxxxxxx",
  },
  {
    code: "IQ",
    name: "Iraq",
    nameAr: "العراق",
    flag: "🇮🇶",
    dialCode: "+964",
    format: "7XXXXXXXXX",
    placeholder: "7xxxxxxxxx",
  },
  {
    code: "YE",
    name: "Yemen",
    nameAr: "اليمن",
    flag: "🇾🇪",
    dialCode: "+967",
    format: "7XXXXXXXX",
    placeholder: "7xxxxxxxx",
  },
  {
    code: "SY",
    name: "Syria",
    nameAr: "سوريا",
    flag: "🇸🇾",
    dialCode: "+963",
    format: "9XXXXXXXX",
    placeholder: "9xxxxxxxx",
  },
  {
    code: "PS",
    name: "Palestine",
    nameAr: "فلسطين",
    flag: "🇵🇸",
    dialCode: "+970",
    format: "5XXXXXXXX",
    placeholder: "5xxxxxxxx",
  },
  {
    code: "MA",
    name: "Morocco",
    nameAr: "المغرب",
    flag: "🇲🇦",
    dialCode: "+212",
    format: "6XXXXXXXX",
    placeholder: "6xxxxxxxx",
  },
  {
    code: "DZ",
    name: "Algeria",
    nameAr: "الجزائر",
    flag: "🇩🇿",
    dialCode: "+213",
    format: "5XXXXXXXX",
    placeholder: "5xxxxxxxx",
  },
  {
    code: "TN",
    name: "Tunisia",
    nameAr: "تونس",
    flag: "🇹🇳",
    dialCode: "+216",
    format: "XXXXXXXX",
    placeholder: "xxxxxxxx",
  },
  {
    code: "LY",
    name: "Libya",
    nameAr: "ليبيا",
    flag: "🇱🇾",
    dialCode: "+218",
    format: "9XXXXXXXX",
    placeholder: "9xxxxxxxx",
  },
  {
    code: "SD",
    name: "Sudan",
    nameAr: "السودان",
    flag: "🇸🇩",
    dialCode: "+249",
    format: "9XXXXXXXX",
    placeholder: "9xxxxxxxx",
  },
  {
    code: "US",
    name: "United States",
    nameAr: "الولايات المتحدة",
    flag: "🇺🇸",
    dialCode: "+1",
    format: "XXXXXXXXXX",
    placeholder: "xxxxxxxxxx",
  },
  {
    code: "GB",
    name: "United Kingdom",
    nameAr: "المملكة المتحدة",
    flag: "🇬🇧",
    dialCode: "+44",
    format: "7XXXXXXXXX",
    placeholder: "7xxxxxxxxx",
  },
]

export function getCountryByCode(code: string): CountryCode | undefined {
  return COUNTRY_CODES.find((c) => c.code === code)
}

export function getCountryByDialCode(dialCode: string): CountryCode | undefined {
  return COUNTRY_CODES.find((c) => c.dialCode === dialCode)
}
