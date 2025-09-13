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
dom.additionalPropsToggle.addEventListener('change', () => editor.validateAndParseJson());

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

// Schema Feedback Listener
dom.schemaFeedback.addEventListener('click', (e) => {
    const target = e.target.closest('[data-line]');
    if (target) {
        const lineNumber = parseInt(target.dataset.line, 10);
        if (!isNaN(lineNumber)) {
            editor.highlightLine(lineNumber);
        }
    }
});

if (dom.schemaFeedbackResizer) {
    dom.schemaFeedbackResizer.addEventListener('mousedown', initFeedbackResize);
}

dom.copySchemaErrorsBtn.addEventListener('click', () => {
    const errorNodes = dom.schemaFeedbackMessageEl.querySelectorAll('.schema-error-line');
    let errorText = dom.schemaFeedbackTitle.textContent + '\n\n';
    errorNodes.forEach(node => {
        errorText += node.textContent.trim() + '\n';
    });

    if (!errorText.trim()) return;

    navigator.clipboard.writeText(errorText.trim()).then(() => {
        const originalIcon = dom.copySchemaErrorsBtn.innerHTML;
        const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 1rem; height: 1rem;"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>`;
        dom.copySchemaErrorsBtn.innerHTML = checkIcon;
        dom.copySchemaErrorsBtn.disabled = true;

        setTimeout(() => {
            dom.copySchemaErrorsBtn.innerHTML = originalIcon;
            dom.copySchemaErrorsBtn.disabled = false;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy errors: ', err);
    });
});

// --- Tree View Listeners ---

function _handleTreeNodeHighlight(targetElement) {
    if (!targetElement) return;
    const currentlyHighlighted = dom.treeView.querySelector('.tree-node-highlighted');
    if (currentlyHighlighted) {
        currentlyHighlighted.classList.remove('tree-node-highlighted');
    }
    targetElement.classList.add('tree-node-highlighted');
}

function _handleTreePathDisplay(targetElement) {
    if (targetElement && targetElement.dataset.jsonPath) {
        dom.treePathDisplay.textContent = targetElement.dataset.jsonPath;
        dom.treePathDisplay.hidden = false;
    }
}

function _handleTreeEditorSync(targetElement) {
    if (targetElement) {
        const lineNumber = parseInt(targetElement.dataset.line, 10);
        editor.highlightLine(lineNumber);
    }
}

dom.treeView.addEventListener('click', (e) => {
    const summaryTarget = e.target.closest('summary');
    if (summaryTarget && !e.target.classList.contains('tree-toggle-icon')) {
        e.preventDefault();
    }

    const targetToHighlight = summaryTarget || e.target.closest('.tree-leaf');
    _handleTreeNodeHighlight(targetToHighlight);
    _handleTreePathDisplay(targetToHighlight);

    const lineTarget = e.target.closest('[data-line]');
    _handleTreeEditorSync(lineTarget);
});

if (dom.toggleTreeBtn) {
    dom.toggleTreeBtn.addEventListener('click', treeView.toggleAllTreeNodes);
}
dom.treeSearchBtn.addEventListener('click', treeView.performTreeSearch);
dom.treeSearchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); treeView.performTreeSearch(); } });
dom.treeSearchInput.addEventListener('input', () => { if (dom.treeSearchInput.value.trim() === '') treeView.clearSearchHighlights(); });

dom.treePathDisplay.addEventListener('click', () => {
    const path = dom.treePathDisplay.textContent;
    if (!path || dom.treePathDisplay.classList.contains('copied')) return;

    navigator.clipboard.writeText(path).then(() => {
        const originalPath = dom.treePathDisplay.textContent;
        dom.treePathDisplay.textContent = '✓ Copied to clipboard!';
        dom.treePathDisplay.classList.add('copied');
        setTimeout(() => {
            dom.treePathDisplay.textContent = originalPath;
            dom.treePathDisplay.classList.remove('copied');
        }, 1500);
    }).catch(err => {
        console.error('Failed to copy path: ', err);
        const originalPath = dom.treePathDisplay.textContent;
        dom.treePathDisplay.textContent = 'Copy failed!';
        setTimeout(() => {
            dom.treePathDisplay.textContent = originalPath;
        }, 1500);
    });
});


// --- SCHEMA EDITOR EVENT LISTENERS ---
dom.manageSchemasBtn.addEventListener('click', schemaEditor.openSchemaEditor);
dom.closeModalBtn.addEventListener('click', schemaEditor.attemptToCloseSchemaEditor);
dom.schemaEditorModal.addEventListener('click', (e) => { if (e.target === dom.schemaEditorModal) schemaEditor.attemptToCloseSchemaEditor(); });
dom.uploadSchemaBtn.addEventListener('click', () => dom.schemaFileInput.click());
dom.schemaFileInput.addEventListener('change', schemaEditor.handleSchemaFileUpload);
dom.createNewSchemaBtn.addEventListener('click', schemaEditor.handleCreateNewSchema);
dom.saveSchemaBtn.addEventListener('click', schemaEditor.saveSchema);
dom.downloadSchemaBtn.addEventListener('click', schemaEditor.downloadSchemaFile);
dom.addSchemaFieldBtn.addEventListener('click', () => schemaEditor.openAddFieldModal(dom.fieldsContainer));
dom.visualBuilderContainer.addEventListener('click', schemaEditor.handleVisualBuilderClicks);
dom.visualBuilderContainer.addEventListener('change', schemaEditor.handleVisualBuilderChanges);
dom.visualBuilderContainer.addEventListener('input', schemaEditor.handleVisualBuilderInputs);
dom.schemaTitleInput.addEventListener('input', schemaEditor.handleSchemaTitleInput);
dom.schemaDescriptionInput.addEventListener('input', schemaEditor.triggerUIUpdate);
dom.schemaFieldSearchBtn.addEventListener('click', schemaEditor.performFieldSearch);
dom.schemaFieldSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        schemaEditor.performFieldSearch();
    }
});
dom.schemaFieldSearchInput.addEventListener('input', () => {
    if (dom.schemaFieldSearchInput.value.trim() === '') {
        schemaEditor.clearFieldSearchHighlights();
    }
});
dom.deleteSchemaBtn.addEventListener('click', schemaEditor.openDeleteConfirmationModal);

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

// --- CONFIRM DELETE SCHEMA MODAL LISTENERS ---
dom.confirmDeleteSchemaCancelBtn.addEventListener('click', () => {
    dom.confirmDeleteSchemaModal.hidden = true;
});
dom.confirmDeleteSchemaConfirmBtn.addEventListener('click', () => {
    schemaEditor.deleteCurrentSchema();
});


// --- APP-WIDE ---
function initFeedbackResize(e) {
    if (e.button !== 0) return;
    e.preventDefault();

    const startY = e.clientY;
    const startHeight = dom.schemaFeedback.offsetHeight;
    const editorPane = dom.schemaFeedback.closest('.editor-pane');

    const computedStyle = getComputedStyle(dom.schemaFeedback);
    const minHeight = parseInt(computedStyle.minHeight, 10) || 48;
    const maxHeight = editorPane ? editorPane.offsetHeight - 150 : 500;

    const doResize = (moveEvent) => {
        const dy = moveEvent.clientY - startY;
        let newHeight = startHeight - dy;

        if (newHeight < minHeight) newHeight = minHeight;
        if (newHeight > maxHeight) newHeight = maxHeight;
        
        dom.schemaFeedback.style.height = `${newHeight}px`;
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

function initSchemaEditorResize(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    
    const mainArea = dom.schemaEditorModal.querySelector('.schema-editor-main-area');
    const leftPane = mainArea.querySelector('#schema-raw-editor-container'); // This is the right-side pane in RTL
    const rightPane = mainArea.querySelector('.visual-builder-column:last-child'); // This is the left-side pane in RTL

    // --- Dynamic Minimum Width Calculation ---
    const getChildrensTotalWidth = (element) => {
        if (!element) return 300; // Fallback
        const style = window.getComputedStyle(element);
        const gap = parseFloat(style.gap) || 0;
        let totalWidth = 0;
        Array.from(element.children).forEach((child, index) => {
            const childStyle = window.getComputedStyle(child);
            // Use scrollWidth for elements that might have internal content larger than their offsetWidth
            const childWidth = Math.max(child.offsetWidth, child.scrollWidth);
            totalWidth += childWidth + parseFloat(childStyle.marginLeft) + parseFloat(childStyle.marginRight);
            if (index > 0) {
                totalWidth += gap;
            }
        });
        return totalWidth;
    };

    const leftHeader = leftPane.querySelector('.tab-bar');
    const rightHeader = rightPane.querySelector('.builder-header');

    // Add padding for a better look
    const minLeftWidth = getChildrensTotalWidth(leftHeader) + 50; 
    const minRightWidth = getChildrensTotalWidth(rightHeader) + 50;

    const startX = e.clientX;
    const startLeftWidth = leftPane.offsetWidth;
    const startRightWidth = rightPane.offsetWidth;
    const totalWidth = startLeftWidth + startRightWidth;

    const doResize = (moveEvent) => {
        // For RTL, dragging right (increasing clientX) should shrink the right-most pane (leftPane)
        const dx = moveEvent.clientX - startX;
        let newLeftWidth = startLeftWidth - dx;
        
        // Apply constraints to prevent panes from becoming too small and causing content wrap/jumps
        if (newLeftWidth < minLeftWidth) {
            newLeftWidth = minLeftWidth;
        }
        
        if (totalWidth - newLeftWidth < minRightWidth) {
            newLeftWidth = totalWidth - minRightWidth;
        }
        
        const newLeftFraction = newLeftWidth / totalWidth;
        const newRightFraction = 1 - newLeftFraction;
        
        mainArea.style.gridTemplateColumns = `${newLeftFraction}fr 5px ${newRightFraction}fr`;
    };

    const stopResize = () => {
        window.removeEventListener('mousemove', doResize);
        window.removeEventListener('mouseup', stopResize);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResize);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
}


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
    messageBox.textContent = 'vibe by: Galanti Amir';
    overlay.appendChild(messageBox);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => overlay.remove());
}
if (dom.resizer) dom.resizer.addEventListener('mousedown', initResize);
if (dom.schemaEditorResizer) dom.schemaEditorResizer.addEventListener('mousedown', initSchemaEditorResize);
dom.titleEl.addEventListener('click', (e) => { if (e.ctrlKey) showEasterEgg(); });


// --- INITIALIZATION ---
async function loadAppVersion() {
    try {
        const response = await fetch('./metadata.json');
        if (!response.ok) {
            throw new Error('Could not load app metadata');
        }
        const metadata = await response.json();
        if (metadata.version && dom.appVersion) {
            dom.appVersion.textContent = `גרסה ${metadata.version}`;
        }
    } catch (error) {
        console.error('Error loading app version:', error);
        if (dom.appVersion) {
            dom.appVersion.hidden = true;
        }
    }
}

loadAppVersion();
editor.updateLineNumbers();
editor.validateAndParseJson();
schemaEditor.initializeSchemaValidator();
schemaEditor.initializeSchemaEditorEventListeners();
schemaEditor.initializeCustomDropdowns();

const resizeObserver = new ResizeObserver(() => {
    const scrollbarHeight = dom.jsonInput.offsetHeight - dom.jsonInput.clientHeight;
    dom.lineNumbers.style.paddingBottom = `calc(1rem + ${scrollbarHeight}px)`;
    editor.handleScroll();
});
resizeObserver.observe(dom.jsonInput);