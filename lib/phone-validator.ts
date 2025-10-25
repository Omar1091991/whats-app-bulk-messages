import { formatPhoneNumber, isValidWhatsAppNumber } from "./phone-formatter"

export interface PhoneValidationResult {
  validNumbers: string[]
  invalidNumbers: Array<{ number: string; reason: string }>
  duplicates: string[]
  statistics: {
    total: number
    valid: number
    invalid: number
    duplicates: number
  }
}

/**
 * Validates and filters phone numbers with detailed results
 */
export function validateAndFilterPhoneNumbers(text: string, countryCode = "SA"): PhoneValidationResult {
  // Split by newlines, commas, or semicolons
  const rawNumbers = text
    .split(/[\n,;]+/)
    .map((n) => n.trim())
    .filter((n) => n.length > 0)

  const validNumbers: string[] = []
  const invalidNumbers: Array<{ number: string; reason: string }> = []
  const seenNumbers = new Set<string>()
  const duplicates: string[] = []

  for (const rawNumber of rawNumbers) {
    // Check if empty after trim
    if (!rawNumber) continue

    // Check if contains only valid characters (digits, +, -, spaces, parentheses)
    if (!/^[\d\s\-+()]+$/.test(rawNumber)) {
      invalidNumbers.push({
        number: rawNumber,
        reason: "يحتوي على أحرف غير صالحة",
      })
      continue
    }

    // Try to format the number
    let formattedNumber: string
    try {
      formattedNumber = formatPhoneNumber(rawNumber, countryCode)
    } catch (error) {
      invalidNumbers.push({
        number: rawNumber,
        reason: "فشل في تنسيق الرقم",
      })
      continue
    }

    // Validate WhatsApp format
    if (!isValidWhatsAppNumber(formattedNumber)) {
      const digitsOnly = formattedNumber.replace(/\D/g, "")

      if (formattedNumber.startsWith("+966")) {
        const localPart = digitsOnly.substring(3)
        if (localPart.length < 9) {
          invalidNumbers.push({
            number: rawNumber,
            reason: "رقم سعودي قصير جداً (يجب أن يكون 9 أرقام تبدأ بـ 5 أو 10 أرقام تبدأ بـ 05)",
          })
        } else if (localPart.length > 10) {
          invalidNumbers.push({
            number: rawNumber,
            reason: "رقم سعودي طويل جداً (يجب أن يكون 9 أو 10 أرقام فقط)",
          })
        } else if (localPart.length === 9 && !localPart.startsWith("5")) {
          invalidNumbers.push({
            number: rawNumber,
            reason: "رقم سعودي يجب أن يبدأ بـ 5 (مثال: 512345678)",
          })
        } else if (localPart.length === 10 && !localPart.startsWith("05")) {
          invalidNumbers.push({
            number: rawNumber,
            reason: "رقم سعودي من 10 أرقام يجب أن يبدأ بـ 05 (مثال: 0512345678)",
          })
        } else {
          invalidNumbers.push({
            number: rawNumber,
            reason: "صيغة رقم سعودي غير صالحة",
          })
        }
      } else if (formattedNumber.startsWith("+20")) {
        const localPart = digitsOnly.substring(2)
        if (localPart.length < 10) {
          invalidNumbers.push({
            number: rawNumber,
            reason: "رقم مصري قصير جداً (يجب أن يكون 10 أرقام)",
          })
        } else if (localPart.length > 10) {
          invalidNumbers.push({
            number: rawNumber,
            reason: "رقم مصري طويل جداً (يجب أن يكون 10 أرقام فقط)",
          })
        } else {
          invalidNumbers.push({
            number: rawNumber,
            reason: "صيغة رقم مصري غير صالحة",
          })
        }
      } else {
        // Generic error for other countries
        if (digitsOnly.length < 10) {
          invalidNumbers.push({
            number: rawNumber,
            reason: "الرقم قصير جداً (أقل من 10 أرقام)",
          })
        } else if (digitsOnly.length > 15) {
          invalidNumbers.push({
            number: rawNumber,
            reason: "الرقم طويل جداً (أكثر من 15 رقم)",
          })
        } else {
          invalidNumbers.push({
            number: rawNumber,
            reason: "صيغة غير صالحة",
          })
        }
      }
      continue
    }

    // Check for duplicates
    if (seenNumbers.has(formattedNumber)) {
      duplicates.push(formattedNumber)
      continue
    }

    // Valid and unique number
    seenNumbers.add(formattedNumber)
    validNumbers.push(formattedNumber)
  }

  return {
    validNumbers,
    invalidNumbers,
    duplicates,
    statistics: {
      total: rawNumbers.length,
      valid: validNumbers.length,
      invalid: invalidNumbers.length,
      duplicates: duplicates.length,
    },
  }
}
