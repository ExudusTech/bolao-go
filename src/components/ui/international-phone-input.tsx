import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Country {
  code: string;
  name: string;
  dialCode: string;
  format: string;
  maxLength: number;
}

const COUNTRIES: Country[] = [
  { code: "BR", name: "Brasil", dialCode: "+55", format: "(XX) XXXXX-XXXX", maxLength: 11 },
  { code: "US", name: "EUA", dialCode: "+1", format: "(XXX) XXX-XXXX", maxLength: 10 },
  { code: "PT", name: "Portugal", dialCode: "+351", format: "XXX XXX XXX", maxLength: 9 },
  { code: "ES", name: "Espanha", dialCode: "+34", format: "XXX XX XX XX", maxLength: 9 },
];

interface InternationalPhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: string;
  onChange?: (value: string) => void;
}

function formatBrazilianPhone(digits: string): string {
  const limited = digits.slice(0, 11);
  if (limited.length === 0) return '';
  if (limited.length <= 2) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
  if (limited.length <= 10) {
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 6)}-${limited.slice(6)}`;
  }
  return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
}

function formatUSPhone(digits: string): string {
  const limited = digits.slice(0, 10);
  if (limited.length === 0) return '';
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}

function formatPortugalPhone(digits: string): string {
  const limited = digits.slice(0, 9);
  if (limited.length === 0) return '';
  if (limited.length <= 3) return limited;
  if (limited.length <= 6) return `${limited.slice(0, 3)} ${limited.slice(3)}`;
  return `${limited.slice(0, 3)} ${limited.slice(3, 6)} ${limited.slice(6)}`;
}

function formatSpainPhone(digits: string): string {
  const limited = digits.slice(0, 9);
  if (limited.length === 0) return '';
  if (limited.length <= 3) return limited;
  if (limited.length <= 5) return `${limited.slice(0, 3)} ${limited.slice(3)}`;
  if (limited.length <= 7) return `${limited.slice(0, 3)} ${limited.slice(3, 5)} ${limited.slice(5)}`;
  return `${limited.slice(0, 3)} ${limited.slice(3, 5)} ${limited.slice(5, 7)} ${limited.slice(7)}`;
}

function formatPhoneByCountry(digits: string, countryCode: string): string {
  switch (countryCode) {
    case "BR":
      return formatBrazilianPhone(digits);
    case "US":
      return formatUSPhone(digits);
    case "PT":
      return formatPortugalPhone(digits);
    case "ES":
      return formatSpainPhone(digits);
    default:
      return digits;
  }
}

function getMaxLength(countryCode: string): number {
  const country = COUNTRIES.find(c => c.code === countryCode);
  return country?.maxLength || 15;
}

function parseStoredValue(value: string): { countryCode: string; digits: string } {
  // Format stored as: countryCode:digits (e.g., "BR:11999999999")
  const parts = value.split(':');
  if (parts.length === 2 && COUNTRIES.some(c => c.code === parts[0])) {
    return { countryCode: parts[0], digits: parts[1].replace(/\D/g, '') };
  }
  // Fallback: assume Brazil and use as digits
  return { countryCode: 'BR', digits: value.replace(/\D/g, '') };
}

const InternationalPhoneInput = React.forwardRef<HTMLInputElement, InternationalPhoneInputProps>(
  ({ className, value, onChange, disabled, ...props }, ref) => {
    const parsed = parseStoredValue(value || '');
    const [countryCode, setCountryCode] = React.useState(parsed.countryCode);
    const [displayValue, setDisplayValue] = React.useState(() => 
      formatPhoneByCountry(parsed.digits, parsed.countryCode)
    );

    // Sync display value when external value changes
    React.useEffect(() => {
      if (value !== undefined) {
        const newParsed = parseStoredValue(value);
        if (newParsed.countryCode !== countryCode) {
          setCountryCode(newParsed.countryCode);
        }
        const formatted = formatPhoneByCountry(newParsed.digits, newParsed.countryCode);
        if (formatted !== displayValue) {
          setDisplayValue(formatted);
        }
      }
    }, [value]);

    const handleCountryChange = (newCountryCode: string) => {
      setCountryCode(newCountryCode);
      const digits = displayValue.replace(/\D/g, '');
      const maxLen = getMaxLength(newCountryCode);
      const limitedDigits = digits.slice(0, maxLen);
      const formatted = formatPhoneByCountry(limitedDigits, newCountryCode);
      setDisplayValue(formatted);
      onChange?.(`${newCountryCode}:${limitedDigits}`);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const digits = inputValue.replace(/\D/g, '');
      const maxLen = getMaxLength(countryCode);
      const limitedDigits = digits.slice(0, maxLen);
      const formatted = formatPhoneByCountry(limitedDigits, countryCode);
      
      setDisplayValue(formatted);
      onChange?.(`${countryCode}:${limitedDigits}`);
    };

    const selectedCountry = COUNTRIES.find(c => c.code === countryCode);

    return (
      <div className={cn("flex gap-2", className)}>
        <Select value={countryCode} onValueChange={handleCountryChange} disabled={disabled}>
          <SelectTrigger className="w-[100px] shrink-0">
            <SelectValue>
              <span className="flex items-center gap-1">
                <span className="text-xs">{selectedCountry?.dialCode}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                <span className="flex items-center gap-2">
                  <span className="text-sm">{country.dialCode}</span>
                  <span className="text-xs text-muted-foreground">{country.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          ref={ref}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          className="flex-1"
          value={displayValue}
          onChange={handleChange}
          placeholder={selectedCountry?.format || "Número de telefone"}
          disabled={disabled}
          {...props}
        />
      </div>
    );
  }
);

InternationalPhoneInput.displayName = "InternationalPhoneInput";

export { InternationalPhoneInput, COUNTRIES };
