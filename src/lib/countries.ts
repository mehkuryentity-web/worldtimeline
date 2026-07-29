export interface Country {
  code: string; // ISO-2, uppercase; "GLOBAL" for worldwide feed
  name: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: "GLOBAL", name: "Global", flag: "🌍" },
  // Alphabetical by name below — matches all 47 countries currently
  // present in news_archive. Newer/thinner-coverage countries will
  // populate more as ingestion continues.
  { code: "AL", name: "Albania", flag: "🇦🇱" },
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "AZ", name: "Azerbaijan", flag: "🇦🇿" },
  { code: "BT", name: "Bhutan", flag: "🇧🇹" },
  { code: "BW", name: "Botswana", flag: "🇧🇼" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "CY", name: "Cyprus", flag: "🇨🇾" },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿" },
  { code: "EG", name: "Egypt", flag: "🇪🇬" },
  { code: "ET", name: "Ethiopia", flag: "🇪🇹" },
  { code: "FI", name: "Finland", flag: "🇫🇮" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "GE", name: "Georgia", flag: "🇬🇪" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "GH", name: "Ghana", flag: "🇬🇭" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "IE", name: "Ireland", flag: "🇮🇪" },
  { code: "IL", name: "Israel", flag: "🇮🇱" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "JM", name: "Jamaica", flag: "🇯🇲" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "KW", name: "Kuwait", flag: "🇰🇼" },
  { code: "LV", name: "Latvia", flag: "🇱🇻" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "NA", name: "Namibia", flag: "🇳🇦" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "PH", name: "Philippines", flag: "🇵🇭" },
  { code: "RU", name: "Russia", flag: "🇷🇺" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "TR", name: "Turkey", flag: "🇹🇷" },
  { code: "UG", name: "Uganda", flag: "🇺🇬" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "UZ", name: "Uzbekistan", flag: "🇺🇿" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳" },
];

export function findCountry(code: string): Country {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];
}
