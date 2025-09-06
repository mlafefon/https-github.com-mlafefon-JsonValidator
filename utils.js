export function sanitizeInput(event, invalidCharsRegex) {
    const input = event.target;
    if (!input || typeof input.value === 'undefined' || typeof input.selectionStart !== 'number') return;

    const originalValue = input.value;
    const sanitizedValue = originalValue.replace(invalidCharsRegex, '');

    if (originalValue !== sanitizedValue) {
        const selectionStart = input.selectionStart;
        const originalPrefix = originalValue.substring(0, selectionStart);
        const removedInPrefix = (originalPrefix.match(invalidCharsRegex) || []).length;
        input.value = sanitizedValue;
        const newCursorPos = selectionStart - removedInPrefix;
        input.setSelectionRange(newCursorPos, newCursorPos);
    }
}
