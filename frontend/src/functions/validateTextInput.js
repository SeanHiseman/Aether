function ValidateTextInput(textInput, minLength = 0, maxLength = 9999999, characterCheck = true, ) {
    if (typeof textInput !== 'string') {
        return { valid: false, error: 'Must be a string.' };
    }
    if (textInput.length < minLength) {
        return { valid: false, error: `At least ${minLength} characters.` };
    }
    if (textInput.length > maxLength) {
        return { valid: false, error: `No more than ${maxLength} characters.` };
    }
    if (characterCheck && textInput.length > 0) {
        const characterRegex = /^[\p{L}\p{N}_\s-]+$/u;
        if (!characterRegex.test(textInput)) {
            return { valid: false, error: 'Contains invalid characters.' };
        }
    }
    return { valid: true, error: null };
}

export { ValidateTextInput };