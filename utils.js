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

export function initFeedbackResize(e) {
    if (e.button !== 0) return;
    e.preventDefault();

    const resizer = e.target;
    const feedbackElement = resizer.parentElement;
    if (!feedbackElement) return;

    const startY = e.clientY;
    const startHeight = feedbackElement.offsetHeight;
    const containerPane = feedbackElement.closest('.editor-pane') || feedbackElement.closest('#schema-raw-editor-container');

    const computedStyle = getComputedStyle(feedbackElement);
    const minHeight = parseInt(computedStyle.minHeight, 10) || 48;
    const maxHeight = containerPane ? containerPane.offsetHeight - 150 : 500;

    const doResize = (moveEvent) => {
        const dy = moveEvent.clientY - startY;
        let newHeight = startHeight - dy;

        if (newHeight < minHeight) newHeight = minHeight;
        if (newHeight > maxHeight) newHeight = maxHeight;
        
        feedbackElement.style.height = `${newHeight}px`;
    };

    const stopResize = () => {
        window.removeEventListener('mousemove', doResize);
        window.removeEventListener('mouseup', stopResize);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResize);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
}
