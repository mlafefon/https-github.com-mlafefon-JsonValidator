

import * as dom from './dom.js';
import { state } from './state.js';
import * as editor from './editor.js';
import * as treeView from './treeView.js';
import * as schemaEditor from './schemaEditor.js';

// --- EVENT LISTENERS ---

// Editor Listeners
dom.jsonInput.addEventListener('input', () => {
    editor.updateLineNumbers();
    clearTimeout(state.validationTimeout);
    state.validationTimeout = setTimeout(editor.validateAndParseJson, 500);
});
dom.jsonInput.addEventListener('paste', () => {
    const wasEmpty = dom.jsonInput.value.trim() === '';
    setTimeout(() => {
        if (wasEmpty) {
            dom.jsonInput.focus();
            dom.jsonInput.setSelectionRange(0, 0);
            dom.jsonInput.scrollTop = 0;
            dom.jsonInput.scrollLeft = 0;
            editor.handleScroll();
        }
    }, 0);
});
dom.jsonInput.addEventListener('scroll', editor.handleScroll);
dom.beautifyBtn.addEventListener('click', editor.beautifyJson);
dom.minifyBtn.addEventListener('click', editor.minifyJson);
dom.schemaValidatorSelect.addEventListener('change', editor.validateAndParseJson);

// File Loading
dom.loadFileBtn.addEventListener('click', () => dom.fileInput.click());
dom.fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        dom.jsonInput.value = e.target.result;
        dom.jsonInput.focus();
        dom.jsonInput.setSelectionRange(0, 0);
        dom.jsonInput.scrollTop = 0;
        dom.jsonInput.scrollLeft = 0;
        editor.updateLineNumbers();
        editor.validateAndParseJson();
        editor.handleScroll();
    };
    reader.onerror = () => editor.updateStatusBar(ValidationStatus.ERROR, `שגיאה בקריאת הקובץ: ${reader.error.message}`);
    reader.readAsText(file);
    event.target.value = '';
});

// Error Display Listener
dom.errorDisplay.addEventListener('click', () => {
    if (state.currentErrorLineNumber === null) return;
    dom.jsonInput.focus();
    const lines = dom.jsonInput.value.split('\n');
    const position = lines.slice(0, state.currentErrorLineNumber - 1).reduce((acc, line) => acc + line.length + 1, 0);
    dom.jsonInput.setSelectionRange(position, position);
    const lineHeight = parseFloat(getComputedStyle(dom.jsonInput).lineHeight);
    const targetScroll = (state.currentErrorLineNumber - 1) * lineHeight;
    dom.jsonInput.scrollTo({ top: targetScroll, behavior: 'smooth' });
});

// Tree View Listeners
dom.treeView.addEventListener('click', (e) => {
    // 1. Prevent summary from toggling unless the icon is clicked
    const summaryTarget = e.target.closest('summary');
    if (summaryTarget && !e.target.classList.contains('tree-toggle-icon')) {
        e.preventDefault();
    }

    // 2. Handle background highlighting
    const currentlyHighlighted = dom.treeView.querySelector('.tree-node-highlighted');
    if (currentlyHighlighted) {
        currentlyHighlighted.classList.remove('tree-node-highlighted');
    }

    const leafTarget = e.target.closest('.tree-leaf');
    const targetToHighlight = summaryTarget || leafTarget;

    if (targetToHighlight) {
        // Add highlight to the current target
        targetToHighlight.classList.add('tree-node-highlighted');
    }

    // 3. Handle editor line highlighting (existing functionality)
    const lineTarget = e.target.closest('[data-line]');
    if (lineTarget) {
        const lineNumber = parseInt(lineTarget.dataset.line, 10);
        editor.highlightLine(lineNumber);
    }
});
if (dom.toggleTreeBtn) {
    dom.toggleTreeBtn.addEventListener('click', treeView.toggleAllTreeNodes);
}
dom.treeSearchBtn.addEventListener('click', treeView.performTreeSearch);
dom.treeSearchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); treeView.performTreeSearch(); } });
dom.treeSearchInput.addEventListener('input', () => { if (dom.treeSearchInput.value.trim() === '') treeView.clearSearchHighlights(); });


// --- SCHEMA EDITOR EVENT LISTENERS ---
dom.manageSchemasBtn.addEventListener('click', schemaEditor.openSchemaEditor);
dom.closeModalBtn.addEventListener('click', schemaEditor.attemptToCloseSchemaEditor);
dom.schemaEditorModal.addEventListener('click', (e) => { if (e.target === dom.schemaEditorModal) schemaEditor.attemptToCloseSchemaEditor(); });
dom.uploadSchemaBtn.addEventListener('click', () => dom.schemaFileInput.click());
dom.schemaFileInput.addEventListener('change', schemaEditor.handleSchemaFileUpload);
dom.createNewSchemaBtn.addEventListener('click', schemaEditor.handleCreateNewSchema);
dom.schemaEditSelect.addEventListener('change', schemaEditor.loadSchemaForEditing);
dom.saveSchemaBtn.addEventListener('click', schemaEditor.saveSchema);
dom.downloadSchemaBtn.addEventListener('click', schemaEditor.downloadSchemaFile);
dom.schemaContentTextarea.addEventListener('input', schemaEditor.updateVisualBuilderFromRaw);
dom.addSchemaFieldBtn.addEventListener('click', () => schemaEditor.openAddFieldModal(dom.fieldsContainer));
dom.visualBuilderContainer.addEventListener('click', schemaEditor.handleVisualBuilderClicks);
dom.visualBuilderContainer.addEventListener('change', schemaEditor.handleVisualBuilderChanges);
dom.visualBuilderContainer.addEventListener('input', schemaEditor.handleVisualBuilderInputs);
dom.schemaTitleInput.addEventListener('input', schemaEditor.handleSchemaTitleInput);
dom.schemaDescriptionInput.addEventListener('input', schemaEditor.triggerUIUpdate);

// --- ADD FIELD MODAL LISTENERS ---
dom.addFieldForm.addEventListener('submit', schemaEditor.handleAddFieldFromModal);
dom.closeAddFieldModalBtn.addEventListener('click', schemaEditor.closeAddFieldModal);
dom.cancelAddFieldBtn.addEventListener('click', schemaEditor.closeAddFieldModal);
dom.addFieldModal.addEventListener('click', (e) => { if (e.target === dom.addFieldModal) schemaEditor.closeAddFieldModal(); });
dom.newFieldNameInput.addEventListener('input', schemaEditor.handleNewFieldNameInput);

// --- CONFIRM CLOSE MODAL LISTENERS ---
dom.confirmCloseXBtn.addEventListener('click', () => {
    dom.confirmCloseModal.hidden = true;
});
dom.confirmDiscardBtn.addEventListener('click', () => {
    dom.confirmCloseModal.hidden = true;
    schemaEditor.closeSchemaEditor();
});
dom.confirmSaveCloseBtn.addEventListener('click', () => {
    if (schemaEditor.saveSchema()) {
        dom.confirmCloseModal.hidden = true;
        schemaEditor.closeSchemaEditor();
    }
});


// --- APP-WIDE ---
function initResize(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startEditorWidth = dom.editorPane.offsetWidth;
    const startTreeWidth = dom.treePane.offsetWidth;
    const doResize = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const totalWidth = startEditorWidth + startTreeWidth;
        const minWidth = 200;
        let newEditorWidth = startEditorWidth - dx;
        if (newEditorWidth < minWidth) newEditorWidth = minWidth;
        if (totalWidth - newEditorWidth < minWidth) newEditorWidth = totalWidth - minWidth;
        const newEditorFraction = newEditorWidth / totalWidth;
        const newTreeFraction = 1 - newEditorFraction;
        dom.mainContent.style.gridTemplateColumns = `${newEditorFraction}fr 5px ${newTreeFraction}fr`;
    };
    const stopResize = () => {
        window.removeEventListener('mousemove', doResize);
        window.removeEventListener('mouseup', stopResize);
    };
    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResize);
}

function showEasterEgg() {
    if (document.querySelector('.easter-egg-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'easter-egg-overlay';
    const messageBox = document.createElement('div');
    messageBox.className = 'easter-egg-box';
    messageBox.textContent = 'made by: Galanti Amir';
    overlay.appendChild(messageBox);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => overlay.remove());
}
if (dom.resizer) dom.resizer.addEventListener('mousedown', initResize);
dom.titleEl.addEventListener('click', (e) => { if (e.ctrlKey) showEasterEgg(); });


// --- INITIALIZATION ---
editor.updateLineNumbers();
editor.validateAndParseJson();
schemaEditor.initializeSchemaValidator();
const resizeObserver = new ResizeObserver(() => {
    const scrollbarHeight = dom.jsonInput.offsetHeight - dom.jsonInput.clientHeight;
    dom.lineNumbers.style.paddingBottom = `calc(1rem + ${scrollbarHeight}px)`;
    editor.handleScroll();
});
resizeObserver.observe(dom.jsonInput);