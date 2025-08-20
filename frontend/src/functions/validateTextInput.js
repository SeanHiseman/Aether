function ValidateTextInput(textInput, minLength = 0, maxLength = 999999999999999) {
    if (typeof textInput !== 'string') {
        return { valid: false, error: 'Must be a string.' };
    }
    if (textInput.length < minLength) {
        return { valid: false, error: `Must be at least ${minLength} characters.` };
    }
    if (textInput.length > maxLength) {
        return { valid: false, error: `Must be no more than ${maxLength} characters.` };
    }
    const characterRegex = /^[\p{L}\p{N}_\s-]+$/u;
    if (!characterRegex.test(textInput)) {
        return { valid: false, error: 'Contains invalid characters.' };
    }
    return { valid: true, error: null };
}

export { ValidateTextInput };