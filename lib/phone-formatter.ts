import { getCountryByCode } from "./country-codes"

/**
 * Formats phone numbers based on country code
 */
export function formatPhoneNumber(phone: string, countryCode = "SA"): string {
  const country = getCountryByCode(countryCode)
  if (!country) {
    // Fallback to Saudi Arabia if country not found
    return formatPhoneNumber(phone, "SA")
  }

  // Remove all spaces, dashes, and parentheses
  let cleaned = phone.replace(/[\s\-()]/g, "")

  // Remove leading + if present
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1)
  }

  // Remove leading 00
  if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2)
  }

  const dialCodeWithoutPlus = country.dialCode.substring(1)

  // If already has country code, return with +
  if (cleaned.startsWith(dialCodeWithoutPlus)) {
    return "+" + cleaned
  }

  // Handle leading 0
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1)
  }

  // Add country code
  return country.dialCode + cleaned
}

/**
 * Validates if a phone number is in correct WhatsApp format with country-specific rules
 */
export function isValidWhatsAppNumber(phone: string): boolean {
  // WhatsApp numbers should start with +
  if (!phone.startsWith("+")) {
    return false
  }

  // Remove the + and get the full number
  const numberWithoutPlus = phone.substring(1)

  // Saudi Arabia (+966)
  if (numberWithoutPlus.startsWith("966")) {
    const localPart = numberWithoutPlus.substring(3) // Remove country code

    // Valid formats:
    // 1. 9 digits starting with 5 (e.g., 512345678)
    // 2. 10 digits starting with 05 (e.g., 0512345678)

    if (localPart.length === 9 && localPart.startsWith("5")) {
      return /^\d{9}$/.test(localPart)
    }

    if (localPart.length === 10 && localPart.startsWith("05")) {
      return /^\d{10}$/.test(localPart)
    }

    return false
  }

  // Egypt (+20)
  if (numberWithoutPlus.startsWith("20")) {
    const localPart = numberWithoutPlus.substring(2) // Remove country code

    // Valid format: exactly 10 digits
    if (localPart.length === 10) {
      return /^\d{10}$/.test(localPart)
    }

    return false
  }

  // For other countries, use generic validation (10-15 digits total)
  const regex = /^\d{10,15}$/
  return regex.test(numberWithoutPlus)
}

/**
 * Formats multiple phone numbers from text input
 */
export function formatPhoneNumbersFromText(text: string, countryCode = "SA"): string[] {
  // Split by newlines, commas, or semicolons
  const numbers = text
    .split(/[\n,;]+/)
    .map((n) => n.trim())
    .filter((n) => n.length > 0)

  return numbers.map((n) => formatPhoneNumber(n, countryCode)).filter(isValidWhatsAppNumber)
}

/**
 * @deprecated Use formatPhoneNumber(phone, "SA") instead
 */
export function formatSaudiPhoneNumber(phone: string): string {
  return formatPhoneNumber(phone, "SA")
}
