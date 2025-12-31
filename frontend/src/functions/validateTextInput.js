function ValidateTextInput(textInput, minLength = 0, maxLength = 9999999, characterCheck = true, ) {
    if (typeof textInput !== 'string') {
        return { valid: false, error: 'Must be a string.' };
    }
    const normalisedInput = textInput.trim().normalize('NFKC');

    if (normalisedInput.length > 0 && normalisedInput.length < minLength) {
        return { valid: false, error: `At least ${minLength} characters.` };
    }
    if (normalisedInput.length > maxLength) {
        return { valid: false, error: `No more than ${maxLength} characters.` };
    }
    if (characterCheck && normalisedInput.length > 0) {
        const characterRegex = /^[\p{L}\p{N}_-]+$/u;
        if (!characterRegex.test(normalisedInput)) {
            return { valid: false, error: 'Contains invalid characters.' };
        }
    }
    return { valid: true, error: null };
}

export { ValidateTextInput };