import * as dom from './dom.js';
import { state } from './state.js';
import * as constants from './constants.js';
import { sanitizeInput, initFeedbackResize } from './utils.js';
import { validateAndParseJson, validateJsonAgainstSchema } from './editor.js';

let currentExampleHighlight = { gutter: null, background: null, line: null };

function beautifyActiveTextarea() {
    const isSchemaTabActive = dom.schemaContentPane.classList.contains('active');
    const activeTextarea = isSchemaTabActive ? dom.schemaContentTextarea : dom.exampleJsonTextarea;
    
    const text = activeTextarea.value;
    if (!text.trim()) return;

    try {
        const parsed = JSON.parse(text);
        activeTextarea.value = JSON.stringify(parsed, null, 2);
        
        if (isSchemaTabActive) {
            updateLineNumbersForTextarea(dom.schemaContentTextarea, dom.schemaContentLineNumbers);
            updateVisualBuilderFromRaw();
            clearTimeout(state.exampleJsonValidationTimeout);
            state.exampleJsonValidationTimeout = setTimeout(validateExampleJson, 500);
        } else {
            updateLineNumbersForTextarea(dom.exampleJsonTextarea, dom.exampleJsonLineNumbers);
            validateExampleJson();
        }
    } catch (e) {
        // Silently fail if JSON is invalid. The validators will show an error anyway.
        console.warn("Beautify failed: invalid JSON.", e.message);
    }
}

// --- PARSER LOGIC FOR EXAMPLE JSON ---
function createLocationAwareParser() {
    const locationsMap = new Map();
    let uidCounter = 0;

    const getLineNumber = (text, index) => {
        return text.substring(0, index).split('\n').length;
    };

    const parse = (jsonString) => {
        locationsMap.clear();
        uidCounter = 0;

        if (!jsonString.trim()) {
            return { parsed: undefined, locationsMap };
        }
        
        const modifiedJsonString = jsonString.replace(/"((?:[^"\\]|\\.)*)"(\s*:)/g, (match, key, colonAndSpace, offset) => {
            const uid = ++uidCounter;
            const uniqueKey = `${key}${constants.UID_SEPARATOR}${uid}`;
            locationsMap.set(uniqueKey, { originalKey: key, line: getLineNumber(jsonString, offset) });
            return `"${uniqueKey}"${colonAndSpace}`;
        });

        const parsed = JSON.parse(modifiedJsonString);
        return { parsed, locationsMap };
    };
    
    return { parse };
}

const exampleLocationParser = createLocationAwareParser();

function buildPathToLineMap(parsedObjectWithUids, locationsMap) {
    const pathToLineMap = new Map();
    pathToLineMap.set('root', 1);

    function traverse(obj, currentPath) {
        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                const itemPath = `${currentPath}/${index}`;
                const parentLine = pathToLineMap.get(currentPath);
                if (parentLine) {
                    pathToLineMap.set(itemPath, parentLine);
                }
                 if (typeof item === 'object' && item !== null) {
                    traverse(item, itemPath);
                }
            });
        } else if (typeof obj === 'object' && obj !== null) {
            for (const keyWithUid in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, keyWithUid)) {
                    const locationInfo = locationsMap.get(keyWithUid);
                    if (locationInfo) {
                        const itemPath = `${currentPath}/${locationInfo.originalKey}`;
                        pathToLineMap.set(itemPath, locationInfo.line);

                        if (typeof obj[keyWithUid] === 'object' && obj[keyWithUid] !== null) {
                            traverse(obj[keyWithUid], itemPath);
                        }
                    }
                }
            }
        }
    }

    traverse(parsedObjectWithUids, 'root');
    return pathToLineMap;
}

function updateLineNumbersForTextarea(textarea, lineNumbersContainer) {
    if (!textarea || !lineNumbersContainer) return;
    const text = textarea.value;
    const lineCount = text.split('\n').length || 1;
    lineNumbersContainer.innerHTML = Array.from({ length: lineCount }, (_, i) => `<div>${i + 1}</div>`).join('');
    
    const scrollbarHeight = textarea.offsetHeight - textarea.clientHeight;
    lineNumbersContainer.style.paddingBottom = `calc(var(--space-sm) + ${scrollbarHeight}px)`;
}

function handleTextareaScroll(textarea, lineNumbersContainer) {
    if (!textarea || !lineNumbersContainer) return;
    lineNumbersContainer.scrollTop = textarea.scrollTop;
}

function highlightExampleJsonLine(lineNumber) {
    if (currentExampleHighlight.gutter) currentExampleHighlight.gutter.classList.remove('line-number-highlight');
    if (currentExampleHighlight.background) currentExampleHighlight.background.remove();

    if (lineNumber === null || lineNumber === undefined) {
        currentExampleHighlight = { gutter: null, background: null, line: null };
        return;
    }

    const editorContainer = dom.exampleJsonPane.querySelector('.schema-editor-textarea-container');
    if (!editorContainer) return;
    
    const gutterLine = dom.exampleJsonLineNumbers.querySelector(`div:nth-child(${lineNumber})`);
    if (gutterLine) {
        gutterLine.classList.add('line-number-highlight');
        currentExampleHighlight.gutter = gutterLine;
    }

    const textarea = dom.exampleJsonTextarea;
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight);
    const paddingTop = parseFloat(getComputedStyle(textarea).paddingTop);
    
    const highlightBg = document.createElement('div');
    highlightBg.className = 'line-highlight';
    highlightBg.style.height = `${lineHeight}px`;
    highlightBg.style.top = `${paddingTop + (lineNumber - 1) * lineHeight - textarea.scrollTop}px`;
    
    editorContainer.insertBefore(highlightBg, textarea);
    currentExampleHighlight.background = highlightBg;
    currentExampleHighlight.line = lineNumber;

    const targetScroll = (lineNumber - 1) * lineHeight;
    const viewTop = textarea.scrollTop;
    const viewBottom = viewTop + textarea.clientHeight - lineHeight;
    if (targetScroll < viewTop || targetScroll > viewBottom) {
        textarea.scrollTo({ top: targetScroll - (textarea.clientHeight / 3), behavior: 'smooth' });
    }
}

function handleExampleJsonScroll() {
    handleTextareaScroll(dom.exampleJsonTextarea, dom.exampleJsonLineNumbers);
    
    if (currentExampleHighlight.background && currentExampleHighlight.line !== null) {
        const textarea = dom.exampleJsonTextarea;
        const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight);
        const paddingTop = parseFloat(getComputedStyle(textarea).paddingTop);
        currentExampleHighlight.background.style.top = `${paddingTop + (currentExampleHighlight.line - 1) * lineHeight - textarea.scrollTop}px`;
    }
}

function hasUnsavedChanges() {
    if (dom.schemaEditorModal.hidden || dom.schemaEditorFormContainer.hidden) {
        return false;
    }
    const contentModified = dom.schemaContentTextarea.value !== state.initialSchemaStateOnLoad;
    const isNewUnsavedSchema = !state.isEditingExistingSchema;

    return contentModified || isNewUnsavedSchema;
}

export function attemptToCloseSchemaEditor() {
    if (hasUnsavedChanges()) {
        dom.confirmCloseModal.hidden = false;
    } else {
        closeSchemaEditor();
    }
}

function generateKeyFromTitle(title) {
    if (!title) return '';
    return title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(' ')
        .filter(Boolean)
        .map((word, index) => index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

function updateDropdownButtonState(button, selectedKey, placeholder) {
    if (!button) return;
    const textSpan = button.querySelector('span');
    button.classList.remove('user-schema-selected', 'default-schema-selected');
    
    if (selectedKey && state.schemaData && state.schemaData[selectedKey]) {
        const schema = state.schemaData[selectedKey];
        textSpan.textContent = schema.title || selectedKey;
        button.dataset.value = selectedKey;

        if (state.defaultSchemaKeys.has(selectedKey)) {
            button.classList.add('default-schema-selected');
        } else {
            button.classList.add('user-schema-selected');
        }
    } else {
        textSpan.textContent = placeholder;
        button.dataset.value = '';
    }

    if (button === dom.schemaValidatorSelectBtn) {
        const hasSchema = !!selectedKey;
        const toggleContainer = dom.additionalPropsToggle.closest('.form-group-toggle');
        
        dom.additionalPropsToggle.disabled = !hasSchema;
        if (!hasSchema) {
            dom.additionalPropsToggle.checked = false;
        }

        if (toggleContainer) {
            toggleContainer.style.opacity = hasSchema ? '1' : '0.5';
            toggleContainer.style.pointerEvents = hasSchema ? 'auto' : 'none';
            toggleContainer.title = hasSchema 
                ? "הצג שדות שאינם כלולים בסכימה" 
                : "בחר סכמה כדי להפעיל אפשרות זו";
        }
    }
}

function populateCustomDropdowns() {
    const dropdowns = [
        { options: dom.schemaValidatorOptions, button: dom.schemaValidatorSelectBtn, placeholder: 'בחר סכמה' },
        { options: dom.schemaEditOptions, button: dom.schemaEditSelectBtn, placeholder: 'בחר סכמה לעריכה...' }
    ];
    
    const allKeys = state.schemaData ? Object.keys(state.schemaData).sort() : [];
    const userSchemaKeys = allKeys.filter(key => !state.defaultSchemaKeys.has(key));
    const defaultSchemaKeys = allKeys.filter(key => state.defaultSchemaKeys.has(key));

    dropdowns.forEach(({ options, button, placeholder }) => {
        const currentVal = button.dataset.value;
        options.innerHTML = '';

        const isValidator = button === dom.schemaValidatorSelectBtn;

        // Add reset option for the validator dropdown.
        if (isValidator) {
            const resetItem = document.createElement('div');
            resetItem.className = 'custom-dropdown-item';
            resetItem.textContent = 'ללא אימות';
            resetItem.dataset.value = '';
            resetItem.setAttribute('role', 'menuitemradio');
            options.appendChild(resetItem);
        }
        
        if (allKeys.length === 0) {
            if (!isValidator) { // Only disable the edit dropdown if there are no schemas
                updateDropdownButtonState(button, '', 'אין סכמות');
                button.disabled = true;
                return;
            }
        }

        button.disabled = false;

        const createItem = (key, isDefault) => {
            const item = document.createElement('div');
            item.className = 'custom-dropdown-item';
            item.textContent = state.schemaData[key].title || key;
            item.dataset.value = key;
            item.classList.add(isDefault ? 'default-schema-option' : 'user-schema-option');
            item.setAttribute('role', 'menuitemradio');
            return item;
        };
        
        const groupedDefaultSchemas = defaultSchemaKeys.reduce((acc, key) => {
            const groupName = state.defaultSchemaGroupMap.get(key) || 'Default Schemas';
            if (!acc[groupName]) acc[groupName] = [];
            acc[groupName].push(key);
            return acc;
        }, {});
        
        Object.keys(groupedDefaultSchemas).sort().forEach(groupName => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'custom-dropdown-group';
            groupDiv.setAttribute('role', 'menuitem');
            groupDiv.setAttribute('aria-haspopup', 'true');
            
            const groupText = document.createElement('span');
            groupText.textContent = groupName;
            
            const arrow = document.createElement('span');
            arrow.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width:1.25em; height:1.25em;"><path fill-rule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd" /></svg>`;
            
            const submenu = document.createElement('div');
            submenu.className = 'submenu-options';
            submenu.setAttribute('role', 'menu');

            groupedDefaultSchemas[groupName].forEach(key => {
                submenu.appendChild(createItem(key, true));
            });
            
            groupDiv.appendChild(groupText);
            groupDiv.appendChild(arrow);
            groupDiv.appendChild(submenu);
            options.appendChild(groupDiv);
        });

        if (userSchemaKeys.length > 0) {
            const separator = document.createElement('div');
            separator.className = 'custom-dropdown-separator';
            separator.textContent = 'סכמות שלי';
            options.appendChild(separator);
            userSchemaKeys.forEach(key => options.appendChild(createItem(key, false)));
        }
        
        updateDropdownButtonState(button, currentVal, placeholder);
    });
}

function initializeCustomDropdown(dropdownContainer, button, options, onSelect) {
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        const isExpanded = button.getAttribute('aria-expanded') === 'true';
        options.hidden = isExpanded;
        button.setAttribute('aria-expanded', !isExpanded);
    });

    options.addEventListener('click', (e) => {
        const item = e.target.closest('.custom-dropdown-item');
        if (item && item.dataset.value !== undefined) {
            const value = item.dataset.value;
            if (onSelect) {
                onSelect(value);
            }
            options.hidden = true;
            button.setAttribute('aria-expanded', 'false');
        }
    });

    document.addEventListener('click', (e) => {
        if (!dropdownContainer.contains(e.target)) {
            options.hidden = true;
            button.setAttribute('aria-expanded', 'false');
        }
    });
}

export function initializeCustomDropdowns() {
    initializeCustomDropdown(
        dom.schemaValidatorDropdown,
        dom.schemaValidatorSelectBtn,
        dom.schemaValidatorOptions,
        (value) => {
            updateDropdownButtonState(dom.schemaValidatorSelectBtn, value, 'בחר סכמה');
            validateAndParseJson();
        }
    );
    
    initializeCustomDropdown(
        dom.schemaEditDropdown,
        dom.schemaEditSelectBtn,
        dom.schemaEditOptions,
        (value) => {
            updateDropdownButtonState(dom.schemaEditSelectBtn, value, 'בחר סכמה לעריכה...');
            loadSchemaForEditing(value);
        }
    );
}


function displaySchemaEditorFeedback(type, message) {
    dom.schemaEditorFeedback.hidden = false;
    dom.schemaEditorFeedback.className = `feedback-display feedback-${type}`;
    dom.schemaEditorFeedbackIcon.innerHTML = type === 'success' ? constants.ICONS.SUCCESS : constants.ICONS.ERROR;
    dom.schemaEditorFeedbackMessage.textContent = message;

    setTimeout(() => {
        if (!dom.schemaEditorModal.hidden) {
             dom.schemaEditorFeedback.hidden = true;
        }
    }, 5000);
}

function displayExampleJsonFeedback(errors, pathToLineMap = null) {
    const feedbackEl = dom.exampleJsonFeedback;
    const iconEl = dom.exampleJsonFeedbackIcon;
    const messageEl = dom.exampleJsonFeedbackMessage;

    highlightExampleJsonLine(null);

    if (!errors) {
        feedbackEl.hidden = true;
        return;
    }

    feedbackEl.hidden = false;
    feedbackEl.className = 'feedback-display';

    if (errors.length === 0) {
        feedbackEl.classList.add('feedback-success');
        iconEl.innerHTML = constants.ICONS.SUCCESS;
        messageEl.innerHTML = 'ה-JSON לדוגמה תואם לסכמה הנוכחית!';
    } else {
        feedbackEl.classList.add('feedback-error');
        iconEl.innerHTML = constants.ICONS.ERROR;

        const errorItemsHTML = errors.slice(0, 5).map(error => {
            const line = pathToLineMap ? pathToLineMap.get(error.path) : null;
            const cssClass = line ? 'schema-error-line clickable' : 'schema-error-line';
            const typeClass = error.type ? `schema-error-type-${error.type}` : '';
            const dataAttr = line ? `data-line="${line}"` : '';
            const sanitizedMessage = error.message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return `<div class="${cssClass} ${typeClass}" ${dataAttr}>- ${sanitizedMessage}</div>`;
        }).join('');
        
        const moreErrors = errors.length > 5 ? `<div class="schema-error-line">...ועוד ${errors.length - 5} שגיאות.</div>` : '';
        const title = `<strong>נמצאו ${errors.length} שגיאות:</strong>`;

        messageEl.style.whiteSpace = 'normal';
        messageEl.innerHTML = `${title}${errorItemsHTML}${moreErrors}`;
    }
}

function validateExampleJson() {
    const schemaText = dom.schemaContentTextarea.value;
    const exampleText = dom.exampleJsonTextarea.value;

    if (!schemaText.trim() || !exampleText.trim()) {
        displayExampleJsonFeedback(null);
        return;
    }

    let schema, exampleJson, pathToLineMap;

    try {
        schema = JSON.parse(schemaText);
    } catch (e) {
        displayExampleJsonFeedback([{ message: `סכמה לא תקינה: ${e.message}` }]);
        return;
    }

    try {
        const { parsed: parsedWithUids, locationsMap } = exampleLocationParser.parse(exampleText);
        pathToLineMap = buildPathToLineMap(parsedWithUids, locationsMap);
        exampleJson = JSON.parse(exampleText);
    } catch (e) {
        displayExampleJsonFeedback([{ message: `JSON לדוגמה לא תקין: ${e.message}` }]);
        return;
    }

    const errors = validateJsonAgainstSchema(exampleJson, schema);
    displayExampleJsonFeedback(errors, pathToLineMap);
}


export function triggerUIUpdate() {
    clearTimeout(state.schemaBuilderTimeout);
    state.schemaBuilderTimeout = setTimeout(() => {
        buildSchemaFromUI();
        validateExampleJson();
    }, 300);
}

function renderFieldDetails(fieldRow, type, initialData = {}) {
    const validationsContainer = fieldRow.querySelector('.field-validations');
    const childrenContainer = fieldRow.querySelector('.field-children-container');
    const actionsContainer = fieldRow.querySelector('.field-actions');
    const fieldId = fieldRow.dataset.fieldId;

    validationsContainer.innerHTML = '';
    let validationHTML = '';

    const createInputHTML = (rule, inputType, value, extraAttrs = '') => {
        const desc = constants.VALIDATION_DESCRIPTIONS[rule];
        if (!desc) return '';

        let tooltip = desc.title;
        if (rule === 'enum' && typeof desc.title === 'object') {
            tooltip = (type === 'number' || type === 'integer') ? desc.title.number : desc.title.string;
        }

        const valueAttr = value !== undefined && value !== null ? `value="${String(value).replace(/"/g, '&quot;')}"` : '';
        return `
            <div class="form-group">
                <input 
                    type="${inputType}" 
                    class="schema-form-input validation-input" 
                    data-rule="${rule}" 
                    ${valueAttr}
                    placeholder="${desc.placeholder}" 
                    title="${tooltip}"
                    ${extraAttrs}
                >
            </div>
        `;
    };

    if (type === 'number' || type === 'integer') {
        ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf'].forEach(rule => {
            validationHTML += createInputHTML(rule, 'number', initialData[rule] ?? '');
        });
        validationHTML += createInputHTML('enum', 'text', (initialData.enum ?? []).join(', '));
    } else if (type === 'string') {
        ['minLength', 'maxLength'].forEach(rule => {
             validationHTML += createInputHTML(rule, 'number', initialData[rule] ?? '', 'min="0"');
        });
        validationHTML += createInputHTML('pattern', 'text', initialData.pattern ?? '', 'dir="ltr"');
        validationHTML += createInputHTML('enum', 'text', (initialData.enum ?? []).join(', '));
    } else if (type === 'array') {
        const itemSchema = initialData.items || {};
        const itemType = itemSchema.type || 'string';
        
        ['minItems', 'maxItems'].forEach(rule => {
            validationHTML += createInputHTML(rule, 'number', initialData[rule] ?? '', 'min="0"');
        });

        const uniqueDesc = constants.VALIDATION_DESCRIPTIONS.uniqueItems;
        validationHTML += `
            <div class="form-group form-group-toggle full-width" title="${uniqueDesc.title}">
                 <label class="toggle-switch">
                    <input type="checkbox" id="unique-items-${fieldId}" class="validation-input" data-rule="uniqueItems" ${initialData.uniqueItems ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
                <label for="unique-items-${fieldId}" class="toggle-label">${uniqueDesc.label}</label>
            </div>
            <div class="array-item-type-container full-width">
                 <h4 class="array-item-type-title">סוג הפריטים במערך</h4>
                 <div class="field-type-select-wrapper">
                    <select class="array-item-type-select" aria-label="Array item type">
                        <option value="string" ${itemType === 'string' ? 'selected' : ''}>Text</option>
                        <option value="number" ${itemType === 'number' ? 'selected' : ''}>Number</option>
                        <option value="integer" ${itemType === 'integer' ? 'selected' : ''}>Integer</option>
                        <option value="boolean" ${itemType === 'boolean' ? 'selected' : ''}>Yes/No</option>
                        <option value="object" ${itemType === 'object' ? 'selected' : ''}>Object</option>
                    </select>
                </div>
            </div>
        `;
    }

    validationsContainer.innerHTML = validationHTML;
    
    const isContainerType = type === 'object' || (type === 'array' && (initialData.items?.type || 'string') === 'object');
    childrenContainer.hidden = !isContainerType;
    actionsContainer.hidden = !isContainerType;
    
    if (isContainerType) {
        if (!actionsContainer.querySelector('button')) {
            const addButton = document.createElement('button');
            addButton.type = 'button';
            addButton.className = 'action-button add-field-button-nested';
            addButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 1rem; height: 1rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg><span>${type === 'object' ? 'הוסף שדה' : 'הוסף שדה'}</span>`;
            actionsContainer.appendChild(addButton);
        }
        if (childrenContainer.children.length === 0 && !childrenContainer.querySelector('.field-placeholder')) {
             const placeholder = document.createElement('div');
             placeholder.className = 'field-placeholder';
             placeholder.textContent = type === 'object' ? 'אין שדות מוגדרים' : 'אין שדות מוגדרים';
             childrenContainer.appendChild(placeholder);
        }
    }
}

function activateInlineEdit(displayElement, propertyToUpdate) {
    const fieldRow = displayElement.closest('.schema-field-row');
    if (!fieldRow || fieldRow.querySelector('.inline-edit-input')) return;

    // Find both display elements to manage their visibility
    const nameDisplay = fieldRow.querySelector('.field-name-display');
    const descriptionDisplay = fieldRow.querySelector('.field-description-display');
    const siblingElement = (displayElement === nameDisplay) ? descriptionDisplay : nameDisplay;

    const isPlaceholder = displayElement.classList.contains('is-placeholder');
    const originalValue = isPlaceholder ? '' : displayElement.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-edit-input';
    input.value = originalValue;
    
    // Make the input take up maximum available space
    input.style.flexGrow = '1';
    input.style.width = '100%';

    displayElement.hidden = true;
    if (siblingElement) {
        siblingElement.hidden = true; // Hide the other element to give full width
    }

    displayElement.after(input);
    input.focus();
    input.select();

    const deactivate = (saveChanges) => {
        let newValue = input.value.trim();
        let isValid = true;

        if (saveChanges && propertyToUpdate === 'fieldName') {
            if (!newValue || /[^a-zA-Z0-9_-]/.test(newValue)) {
                isValid = false;
            } else {
                const parentContainer = fieldRow.parentElement;
                const siblings = parentContainer.querySelectorAll(':scope > .schema-field-row');
                for (const sibling of siblings) {
                    if (sibling !== fieldRow && sibling.dataset.fieldName === newValue) {
                        isValid = false;
                        break;
                    }
                }
            }
        }
        
        if (saveChanges && isValid) {
            fieldRow.dataset[propertyToUpdate] = newValue;
            if (propertyToUpdate === 'description') {
                if (newValue) {
                    displayElement.textContent = newValue;
                    displayElement.classList.remove('is-placeholder');
                } else {
                    displayElement.textContent = 'הוסף תיאור...';
                    displayElement.classList.add('is-placeholder');
                }
            } else {
                 displayElement.textContent = newValue;
            }
        } else {
            if (propertyToUpdate === 'description') {
                 if (originalValue) {
                    displayElement.textContent = originalValue;
                    displayElement.classList.remove('is-placeholder');
                } else {
                    displayElement.textContent = 'הוסף תיאור...';
                    displayElement.classList.add('is-placeholder');
                }
            } else {
                displayElement.textContent = originalValue;
            }
        }
        
        input.remove();
        displayElement.hidden = false;
        if (siblingElement) {
            siblingElement.hidden = false; // Restore visibility of the other element
        }

        if (saveChanges && isValid && originalValue !== newValue) {
            triggerUIUpdate();
        }
    };

    input.addEventListener('blur', () => deactivate(true));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            deactivate(true);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            deactivate(false);
        }
    });
}

function createFieldElement(fieldData, validationData = {}) {
    const fragment = dom.fieldTemplate.content.cloneNode(true);
    const fieldRow = fragment.querySelector('.schema-field-row');
    const fieldId = state.nextFieldId++;
    fieldRow.dataset.fieldId = fieldId;
    fieldRow.dataset.fieldName = fieldData.name;
    fieldRow.dataset.type = fieldData.type;
    fieldRow.dataset.required = fieldData.required;
    fieldRow.dataset.description = fieldData.description;

    fieldRow.querySelector('.field-name-display').textContent = fieldData.name;
    const descriptionEl = fieldRow.querySelector('.field-description-display');
    
    if (fieldData.description) {
        descriptionEl.textContent = fieldData.description;
        descriptionEl.classList.remove('is-placeholder');
    } else {
        descriptionEl.textContent = 'הוסף תיאור...';
        descriptionEl.classList.add('is-placeholder');
    }

    const typeSelect = fieldRow.querySelector('.field-type-select');
    typeSelect.value = fieldData.type;

    const requiredCheckbox = fieldRow.querySelector('.field-required-checkbox');
    const requiredLabel = fieldRow.querySelector('.field-required-control label');
    const uniqueId = `field-required-${fieldId}`;
    requiredCheckbox.id = uniqueId;
    requiredLabel.setAttribute('for', uniqueId);
    requiredCheckbox.checked = fieldData.required;
    
    renderFieldDetails(fieldRow, fieldData.type, validationData);

    return fieldRow;
}


function buildSchemaFromUI() {
    function buildProperties(container) {
        const properties = {};
        const required = [];
        
        const fieldRows = container.querySelectorAll(':scope > .schema-field-row');

        fieldRows.forEach(row => {
            const name = row.dataset.fieldName;
            if (!name) return;

            const property = {
                type: row.querySelector('.field-type-select').value,
                description: row.dataset.description,
            };

            if (row.dataset.required === 'true') {
                required.push(name);
            }

            if (!property.description) {
                delete property.description;
            }

            const validationInputs = row.querySelectorAll('.validation-input');
            validationInputs.forEach(input => {
                const rule = input.dataset.rule;
                if (input.type === 'checkbox') {
                    if (input.checked) {
                        property[rule] = true;
                    }
                    return;
                }
                
                let value = input.value.trim();
                if (value) {
                     if (rule === 'enum') {
                        const enumArray = value.split(',').map(v => v.trim()).filter(Boolean);
                        if (enumArray.length > 0) {
                            if (property.type === 'number' || property.type === 'integer') {
                                property[rule] = enumArray.map(v => parseFloat(v)).filter(v => !isNaN(v));
                            } else {
                                property[rule] = enumArray;
                            }
                        }
                    } else if (['minLength', 'maxLength', 'minItems', 'maxItems', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf'].includes(rule)) {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) property[rule] = numValue;
                    } else {
                        property[rule] = value;
                    }
                }
            });

            if (property.type === 'object') {
                const childrenContainer = row.querySelector('.field-children-container');
                if(!childrenContainer.hidden) {
                    const result = buildProperties(childrenContainer);
                    property.properties = result.properties;
                    if (result.required.length > 0) {
                        property.required = result.required;
                    }
                }
            } else if (property.type === 'array') {
                const itemTypeSelect = row.querySelector('.array-item-type-select');
                const itemType = itemTypeSelect ? itemTypeSelect.value : 'string';
                
                const items = { type: itemType };

                if (itemType === 'object') {
                    const childrenContainer = row.querySelector('.field-children-container');
                     if(!childrenContainer.hidden) {
                        const result = buildProperties(childrenContainer);
                        items.properties = result.properties;
                        if (result.required.length > 0) {
                            items.required = result.required;
                        }
                    }
                }
                property.items = items;
            }

            properties[name] = property;
        });

        return { properties, required };
    }

    const rootResult = buildProperties(dom.fieldsContainer);
    const schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": dom.schemaTitleInput.value.trim() || "Untitled Schema",
        "description": dom.schemaDescriptionInput.value.trim(),
        "type": "object",
        "properties": rootResult.properties,
    };
    if (rootResult.required.length > 0) {
        schema.required = rootResult.required;
    }
    if (!schema.description) {
        delete schema.description;
    }

    try {
        const currentContent = JSON.parse(dom.schemaContentTextarea.value);
        if (JSON.stringify(currentContent) === JSON.stringify(schema)) {
            return;
        }
    } catch(e) { /* ignore */}

    dom.schemaContentTextarea.value = JSON.stringify(schema, null, 2);
}

function populateUIFromSchema(schema) {
    function populate(container, properties, required = []) {
        Object.entries(properties).forEach(([name, prop]) => {
            const fieldData = {
                name,
                description: prop.description || '',
                type: prop.type,
                required: required.includes(name)
            };
            const fieldRow = createFieldElement(fieldData, prop);
            
            if (prop.type === 'object' && prop.properties) {
                const childrenContainer = fieldRow.querySelector('.field-children-container');
                populate(childrenContainer, prop.properties, prop.required);
            } else if (prop.type === 'array' && prop.items?.type === 'object' && prop.items.properties) {
                const childrenContainer = fieldRow.querySelector('.field-children-container');
                populate(childrenContainer, prop.items.properties, prop.items.required);
            }
            
            container.appendChild(fieldRow);
        });

        const placeholder = container.querySelector(':scope > .field-placeholder');
        if (placeholder && container.children.length > 1) {
            placeholder.remove();
        }
    }
    
    dom.fieldsContainer.innerHTML = '';
    dom.schemaTitleInput.value = schema?.title || '';
    dom.schemaDescriptionInput.value = schema?.description || '';
    
    if (schema?.type === 'object' && schema?.properties) {
        populate(dom.fieldsContainer, schema.properties, schema.required);
    }
}

export function updateVisualBuilderFromRaw() {
    clearTimeout(state.schemaBuilderTimeout);
    state.schemaBuilderTimeout = setTimeout(() => {
        try {
            const rawContent = dom.schemaContentTextarea.value.trim();
            if (!rawContent) {
                dom.fieldsContainer.innerHTML = '';
                dom.schemaTitleInput.value = '';
                dom.schemaDescriptionInput.value = '';
                dom.schemaComplexityWarning.hidden = true;
                return;
            };

            const schema = JSON.parse(rawContent);
            
            if (schema.type !== 'object' || Array.isArray(schema)) {
                 dom.schemaComplexityWarningIcon.innerHTML = constants.ICONS.IDLE;
                dom.schemaComplexityWarningMessage.textContent = "הבנאי הויזואלי תומך רק בסכמה מסוג 'object' ברמה העליונה.";
                dom.schemaComplexityWarning.hidden = false;
                dom.fieldsContainer.innerHTML = '';
                return;
            }

            dom.schemaComplexityWarning.hidden = true;
            populateUIFromSchema(schema);
        } catch (e) {
            dom.fieldsContainer.innerHTML = '';
            dom.schemaComplexityWarningIcon.innerHTML = constants.ICONS.ERROR;
            dom.schemaComplexityWarningMessage.textContent = `תוכן ה-JSON אינו תקין: ${e.message}`;
            dom.schemaComplexityWarning.hidden = false;
        }
    }, 500);
}

function clearSchemaEditorForm() {
    updateDropdownButtonState(dom.schemaEditSelectBtn, '', 'בחר סכמה לעריכה...');
    dom.schemaTitleInput.value = '';
    dom.schemaDescriptionInput.value = '';
    dom.schemaContentTextarea.value = '';
    dom.exampleJsonTextarea.value = '';
    dom.exampleJsonFeedback.hidden = true;
    state.initialSchemaStateOnLoad = '';
    state.isEditingExistingSchema = false;
    state.currentEditingSchemaKey = null;
    dom.schemaEditorFeedback.hidden = true;
    dom.schemaComplexityWarning.hidden = true;
    dom.fieldsContainer.innerHTML = '';
    dom.schemaFieldSearchInput.value = '';
    dom.deleteSchemaBtn.disabled = true;
    clearFieldSearchHighlights();
}

export function loadSchemaForEditing(key) {
    dom.schemaEditorFeedback.hidden = true;
    state.currentEditingSchemaKey = key;
    dom.schemaFieldSearchInput.value = '';
    clearFieldSearchHighlights();
    dom.exampleJsonTextarea.value = '';
    dom.exampleJsonFeedback.hidden = true;

    if (!key) {
        clearSchemaEditorForm();
        dom.schemaEditorFormContainer.hidden = true;
        dom.schemaEditorFooter.hidden = true;
        dom.deleteSchemaBtn.disabled = true;
        return;
    }

    dom.schemaEditorFormContainer.hidden = false;
    dom.schemaEditorFooter.hidden = false;

    const schema = state.schemaData[key];
    if (schema) {
        state.isEditingExistingSchema = true;
        const schemaString = JSON.stringify(schema, null, 2);
        dom.schemaContentTextarea.value = schemaString;
        state.initialSchemaStateOnLoad = schemaString;
        updateVisualBuilderFromRaw();
        dom.deleteSchemaBtn.disabled = state.defaultSchemaKeys.has(key);
    }
}

export function saveSchema() {
    const title = dom.schemaTitleInput.value.trim();
    if (!title) {
        displaySchemaEditorFeedback('error', 'כותרת הסכמה היא שדה חובה.');
        return false;
    }

    buildSchemaFromUI();
    const content = dom.schemaContentTextarea.value.trim();
    if (!content) {
        displaySchemaEditorFeedback('error', 'תוכן הסכמה לא יכול להיות ריק.');
        return false;
    }

    let parsedContent;
    try {
        parsedContent = JSON.parse(content);
    } catch (e) {
        displaySchemaEditorFeedback('error', `תוכן הסכמה אינו JSON תקין: ${e.message}`);
        return false;
    }

    let newKey = generateKeyFromTitle(title);
    const oldKey = state.currentEditingSchemaKey;
    const isEditingDefault = state.defaultSchemaKeys.has(oldKey);

    // If editing a default schema with an unchanged title, force a new key by creating a copy.
    if (isEditingDefault && newKey === oldKey) {
        const newTitle = `${title} Copy`;
        dom.schemaTitleInput.value = newTitle;
        parsedContent.title = newTitle;
        newKey = generateKeyFromTitle(newTitle);
    }
    
    // A conflict exists if the new key already belongs to another schema.
    if (state.schemaData[newKey] && newKey !== oldKey) {
        displaySchemaEditorFeedback('error', `סכמה עם הכותרת '${parsedContent.title}' כבר קיימת. בחר כותרת אחרת.`);
        return false;
    }
    
    // If renaming a user schema (not a default one), remove the old entry.
    if (state.isEditingExistingSchema && !isEditingDefault && oldKey && newKey !== oldKey) {
        delete state.schemaData[oldKey];
    }
    
    // Save the new or updated schema.
    state.schemaData[newKey] = parsedContent;

    try {
        localStorage.setItem(constants.LS_SCHEMA_KEY, JSON.stringify(state.schemaData));
        
        state.initialSchemaStateOnLoad = JSON.stringify(parsedContent, null, 2);
        dom.schemaContentTextarea.value = state.initialSchemaStateOnLoad;
        state.currentEditingSchemaKey = newKey;
        state.isEditingExistingSchema = true;

        populateCustomDropdowns();
        
        updateDropdownButtonState(dom.schemaEditSelectBtn, newKey, 'בחר סכמה לעריכה...');
        dom.deleteSchemaBtn.disabled = state.defaultSchemaKeys.has(newKey);
        
        const validatorButton = dom.schemaValidatorSelectBtn;
        const isNewSchema = oldKey === null;
        const isRenamedAndSelected = !isNewSchema && oldKey !== newKey && validatorButton.dataset.value === oldKey;

        if (isNewSchema || isRenamedAndSelected) {
            updateDropdownButtonState(validatorButton, newKey, 'בחר סכמה');
        }

        displaySchemaEditorFeedback('success', 'הסכמה נשמרה בהצלחה!');
        validateAndParseJson();
        return true;

    } catch (e) {
        console.error('Failed to save schemas to localStorage:', e);
        displaySchemaEditorFeedback('error', 'שגיאה בשמירה ל-LocalStorage. ייתכן שהאחסון מלא.');
        return false;
    }
}

export function downloadSchemaFile() {
    const content = dom.schemaContentTextarea.value.trim();
    if (!content) {
        displaySchemaEditorFeedback('error', 'אין תוכן לשמור.');
        return;
    }

    try {
        JSON.parse(content);
    } catch(e) {
        displaySchemaEditorFeedback('error', 'לא ניתן לשמור קובץ, תוכן הסכמה אינו JSON תקין.');
        return;
    }

    const title = dom.schemaTitleInput.value.trim();
    const filename = title
        ? title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '.json'
        : 'schema.json';

    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function switchTab(tabId) {
    const isSchemaTab = tabId === 'schema';
    const isExampleTab = tabId === 'example';

    dom.schemaContentTab.classList.toggle('active', isSchemaTab);
    dom.exampleJsonTab.classList.toggle('active', isExampleTab);

    dom.schemaContentPane.classList.toggle('active', isSchemaTab);
    dom.exampleJsonPane.classList.toggle('active', isExampleTab);

    dom.uploadExampleJsonBtn.hidden = !isExampleTab;
    dom.generateExampleJsonBtn.hidden = !isExampleTab;
}

export function openSchemaEditor() {
    const selectedSchemaKey = dom.schemaValidatorSelectBtn.dataset.value;
    dom.schemaEditorModal.hidden = false;
    dom.schemaFieldSearchInput.value = '';
    clearFieldSearchHighlights();
    populateCustomDropdowns();
    
    if (selectedSchemaKey && state.schemaData && state.schemaData[selectedSchemaKey]) {
        updateDropdownButtonState(dom.schemaEditSelectBtn, selectedSchemaKey, 'בחר סכמה לעריכה...');
        loadSchemaForEditing(selectedSchemaKey);
    } else {
        clearSchemaEditorForm();
        dom.schemaEditorFormContainer.hidden = true;
        dom.schemaEditorFooter.hidden = true;
    }

    updateLineNumbersForTextarea(dom.schemaContentTextarea, dom.schemaContentLineNumbers);
    updateLineNumbersForTextarea(dom.exampleJsonTextarea, dom.exampleJsonLineNumbers);
    handleTextareaScroll(dom.schemaContentTextarea, dom.schemaContentLineNumbers);
    handleTextareaScroll(dom.exampleJsonTextarea, dom.exampleJsonLineNumbers);
    switchTab('schema');
}

export function closeSchemaEditor() {
    dom.schemaEditorModal.hidden = true;
}

export function openAddFieldModal(parentContainer) {
    state.currentParentForNewField = parentContainer;
    dom.addFieldForm.reset();
    dom.newFieldNameInput.focus();
    dom.addFieldModal.hidden = false;
}

export function closeAddFieldModal() {
    dom.addFieldModal.hidden = true;
    state.currentParentForNewField = null;
}

export function handleAddFieldFromModal(event) {
    event.preventDefault();
    const fieldData = {
        name: dom.newFieldNameInput.value.trim(),
        description: dom.newFieldDescriptionInput.value.trim(),
        type: dom.addFieldForm.elements.fieldType.value,
        required: dom.newFieldRequiredCheckbox.checked
    };

    if (state.currentParentForNewField) {
        const placeholder = state.currentParentForNewField.querySelector(':scope > .field-placeholder');
        if (placeholder) placeholder.remove();

        const fieldEl = createFieldElement(fieldData);
        state.currentParentForNewField.appendChild(fieldEl);
    }
    
    triggerUIUpdate();
    closeAddFieldModal();
}

async function generateSchemaFromObject(data) {
    if (data === null) {
        return { type: 'string' };
    }
    if (Array.isArray(data)) {
        const schema = { type: 'array' };
        if (data.length > 0) {
            schema.items = await generateSchemaFromObject(data[0]);
        }
        return schema;
    }
    if (typeof data === 'object') {
        const schema = {
            type: 'object',
            properties: {},
        };
        const required = Object.keys(data);
        if (required.length > 0) {
            schema.required = required;
        }
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                schema.properties[key] = await generateSchemaFromObject(data[key]);
            }
        }
        return schema;
    }
    if (typeof data === 'number') {
        return { type: Number.isInteger(data) ? 'integer' : 'number' };
    }
    return { type: typeof data };
}

async function _inferSchemaFromFileData(data, filename) {
    const isSchema = data && typeof data === 'object' && !Array.isArray(data) && (data.hasOwnProperty('$schema') || data.hasOwnProperty('properties'));
    
    if (isSchema) {
        const schema = { ...data };
        if (!schema.title) {
            schema.title = filename.replace(/\.json$/i, '');
        }
        return schema;
    }

    if (data && typeof data === 'object' && !Array.isArray(data)) {
        displaySchemaEditorFeedback('success', 'קובץ JSON רגיל זוהה. מתבצעת המרה אוטומטית לסכמה.');
        const inferredSchema = await generateSchemaFromObject(data);
        const title = filename.replace(/\.json$/i, '');
        return {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": title,
            "description": `סכמה שנוצרה אוטומטית מהקובץ ${filename}`,
            "type": "object",
            "properties": inferredSchema.properties,
            ...(inferredSchema.required && inferredSchema.required.length > 0 && { required: inferredSchema.required }),
        };
    }
    
    throw new Error("לא ניתן להמיר את קובץ ה-JSON. יש להעלות אובייקט JSON.");
}

export function handleSchemaFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => displaySchemaEditorFeedback('error', `שגיאה בקריאת הקובץ: ${reader.error.message}`);
    reader.onload = async (e) => {
        try {
            const loadedJson = JSON.parse(e.target.result);
            const schemaToLoad = await _inferSchemaFromFileData(loadedJson, file.name);

            clearSchemaEditorForm();
            dom.schemaFieldSearchInput.value = '';
            clearFieldSearchHighlights();
            dom.schemaEditorFormContainer.hidden = false;
            dom.schemaEditorFooter.hidden = false;
            
            const schemaString = JSON.stringify(schemaToLoad, null, 2);
            dom.schemaContentTextarea.value = schemaString;
            state.initialSchemaStateOnLoad = schemaString;
            updateVisualBuilderFromRaw();
            state.isEditingExistingSchema = false;
            state.currentEditingSchemaKey = null;

        } catch (err) {
            displaySchemaEditorFeedback('error', `קובץ לא תקין. ${err.message}`);
        }
    };

    reader.readAsText(file);
    event.target.value = '';
}

export function handleCreateNewSchema() {
    clearSchemaEditorForm();
    dom.schemaEditorFormContainer.hidden = false;
    dom.schemaEditorFooter.hidden = false;
    const newSchemaTemplate = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "",
        "description": "",
        "type": "object",
        "properties": {},
    };
    const newSchemaString = JSON.stringify(newSchemaTemplate, null, 2);
    dom.schemaContentTextarea.value = newSchemaString;
    state.initialSchemaStateOnLoad = newSchemaString;
    dom.schemaFieldSearchInput.value = '';
    clearFieldSearchHighlights();
    updateVisualBuilderFromRaw();
    dom.deleteSchemaBtn.disabled = true;
    dom.schemaTitleInput.focus();
}

/**
 * Reads the 'schema' URL parameter and sets the initial selection for the validator.
 */
function processUrlSchemaSelection() {
    const urlParams = new URLSearchParams(window.location.search);
    const schemaTitle = urlParams.get('schema');

    if (schemaTitle && state.schemaData) {
        // Find the key for the schema with the matching title. Case-insensitive for robustness.
        const schemaKey = Object.keys(state.schemaData).find(key => 
            state.schemaData[key]?.title?.toLowerCase() === schemaTitle.toLowerCase()
        );
        
        if (schemaKey) {
            // Check if the schema is a default schema before selecting it via URL.
            if (state.defaultSchemaKeys.has(schemaKey)) {
                // Set the value on the button's dataset. The UI text will be updated by populateCustomDropdowns.
                dom.schemaValidatorSelectBtn.dataset.value = schemaKey;
            } else {
                console.warn(`Schema with title "${schemaTitle}" is a user schema and cannot be selected via URL parameter.`);
            }
        } else {
            console.warn(`Schema with title "${schemaTitle}" not found via URL parameter.`);
        }
    }
}

export async function initializeSchemaValidator() {
    try {
        const storedSchemas = localStorage.getItem(constants.LS_SCHEMA_KEY);
        // Always load default schemas first to populate the `defaultSchemaKeys` set
        console.log("Fetching default schemas from schema directory...");
        const indexResponse = await fetch('./schema/index.json');
        if (!indexResponse.ok) {
            throw new Error(`Could not fetch schema/index.json: ${indexResponse.statusText}`);
        }
        const schemaGroups = await indexResponse.json();
        const defaultSchemas = {};
        
        const schemaPromises = schemaGroups.flatMap(group => 
            (group.schemas || []).map(async (filename) => {
                try {
                    const schemaResponse = await fetch(`./schema/${filename}`);
                    if (!schemaResponse.ok) {
                         console.error(`Failed to fetch schema/${filename}`);
                        return null;
                    }
                    const schemaContent = await schemaResponse.json();
                    const schemaKey = filename.replace('.json', '');
                    state.defaultSchemaKeys.add(schemaKey);
                    state.defaultSchemaGroupMap.set(schemaKey, group.group || 'Default');
                    return { key: schemaKey, content: schemaContent };
                } catch (e) {
                    console.error(`Error processing schema file ${filename}:`, e);
                    return null;
                }
            })
        );

        const results = await Promise.all(schemaPromises);
        results.forEach(result => {
            if (result) {
                defaultSchemas[result.key] = result.content;
            }
        });
        
        // Start with default schemas, then merge/overwrite with user's stored schemas
        state.schemaData = { ...defaultSchemas };

        if (storedSchemas) {
            console.log("Found schemas in localStorage, merging them.");
            const userSchemas = JSON.parse(storedSchemas);
            state.schemaData = { ...state.schemaData, ...userSchemas };
        } else {
             // If no user schemas, we can pre-populate localStorage with defaults for next time
             localStorage.setItem(constants.LS_SCHEMA_KEY, JSON.stringify(defaultSchemas));
        }

    } catch (e) {
        console.error("Could not load or parse schema data:", e);
        state.schemaData = {}; // Fallback to empty
    }
    
    // Process URL param BEFORE populating dropdowns to set the initial state.
    processUrlSchemaSelection();

    populateCustomDropdowns();
}

export function handleVisualBuilderClicks(e) {
    const addBtn = e.target.closest('.add-field-button-nested');
    if (addBtn) {
        const parentRow = addBtn.closest('.schema-field-row');
        const childrenContainer = parentRow.querySelector('.field-children-container');
        openAddFieldModal(childrenContainer);
        return;
    }

    const deleteBtn = e.target.closest('.delete-field-btn');
    if (deleteBtn) {
        const fieldRow = deleteBtn.closest('.schema-field-row');
        if (fieldRow) {
            const parent = fieldRow.parentElement;
            fieldRow.remove();
            if (parent && parent.classList.contains('field-children-container') && parent.children.length === 0) {
                 const placeholder = document.createElement('div');
                 placeholder.className = 'field-placeholder';
                 placeholder.textContent = 'אין שדות מוגדרים';
                 parent.appendChild(placeholder);
            }
            triggerUIUpdate();
        }
        return;
    }

    const summary = e.target.closest('summary.field-summary');
    if (summary) {
        const nameDisplay = e.target.closest('.field-name-display');
        if (nameDisplay) {
            activateInlineEdit(nameDisplay, 'fieldName');
            e.preventDefault();
            return;
        }

        const descDisplay = e.target.closest('.field-description-display');
        if (descDisplay) {
            activateInlineEdit(descDisplay, 'description');
            e.preventDefault();
            return;
        }
        
        if (e.target.closest('.field-controls')) {
            const isInteractive = e.target.matches('input, select, label, button, option');
            if (!isInteractive) {
                e.preventDefault();
            }
            return;
        }
    }
}

export function handleVisualBuilderChanges(e) {
    const target = e.target;
    if (target.classList.contains('field-type-select')) {
        const fieldRow = target.closest('.schema-field-row');
        const newType = target.value;
        fieldRow.dataset.type = newType;
        renderFieldDetails(fieldRow, newType);
        triggerUIUpdate();
    } else if (target.classList.contains('array-item-type-select')) {
        const fieldRow = target.closest('.schema-field-row');
        const newItemType = target.value;
        const childrenContainer = fieldRow.querySelector('.field-children-container');
        const actionsContainer = fieldRow.querySelector('.field-actions');
        const isItemTypeObject = newItemType === 'object';
        
        childrenContainer.hidden = !isItemTypeObject;
        actionsContainer.hidden = !isItemTypeObject;

        if (isItemTypeObject) {
            if (!actionsContainer.querySelector('button')) {
                const addButton = document.createElement('button');
                addButton.type = 'button';
                addButton.className = 'action-button add-field-button-nested';
                addButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 1rem; height: 1rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg><span>הוסף שדה</span>';
                actionsContainer.appendChild(addButton);
            }
            if (childrenContainer.children.length === 0 && !childrenContainer.querySelector('.field-placeholder')) {
                 const placeholder = document.createElement('div');
                 placeholder.className = 'field-placeholder';
                 placeholder.textContent = 'אין שדות מוגדרים';
                 childrenContainer.appendChild(placeholder);
            }
        }
        triggerUIUpdate();
    } else if (target.classList.contains('field-required-checkbox')) {
        const fieldRow = target.closest('.schema-field-row');
        const newState = target.checked;
        fieldRow.dataset.required = newState;
        triggerUIUpdate();
    }
}

export function handleVisualBuilderInputs(e) {
    const target = e.target;
    if (target.matches('.validation-input')) {
        if (target.matches('[data-rule="pattern"]')) {
             sanitizeInput(e, /[^\x00-\x7F]/g);
        }
        triggerUIUpdate();
    }
}

export function handleSchemaTitleInput(e) {
    sanitizeInput(e, /[^a-zA-Z0-9\s]/g);
    triggerUIUpdate();
}

export function handleNewFieldNameInput(e) {
    sanitizeInput(e, /[^a-zA-Z0-9_-]/g)
}

export function clearFieldSearchHighlights() {
    dom.visualBuilderContainer.querySelectorAll('.field-search-highlight').forEach(el => {
        el.classList.remove('field-search-highlight');
    });
}

export function performFieldSearch() {
    clearFieldSearchHighlights();
    const searchTerm = dom.schemaFieldSearchInput.value.trim().toLowerCase();
    if (!searchTerm) return;

    const revealField = (element) => {
        let current = element;
        while (current && current !== dom.visualBuilderContainer) {
            if (current.tagName === 'DETAILS') {
                current.open = true;
            }
            current = current.parentElement;
        }
    };

    const fieldNameElements = dom.visualBuilderContainer.querySelectorAll('.field-name-display');
    let firstFoundElement = null;

    fieldNameElements.forEach(nameEl => {
        if (nameEl.textContent.toLowerCase().includes(searchTerm)) {
            const summary = nameEl.closest('.field-summary');
            if (summary) {
                summary.classList.add('field-search-highlight');
                revealField(summary);
                if (!firstFoundElement) {
                    firstFoundElement = summary;
                }
            }
        }
    });

    if (firstFoundElement) {
        firstFoundElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function handleExampleJsonUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const content = e.target.result;
            const parsed = JSON.parse(content);
            dom.exampleJsonTextarea.value = JSON.stringify(parsed, null, 2);

            switchTab('example');

            updateLineNumbersForTextarea(dom.exampleJsonTextarea, dom.exampleJsonLineNumbers);
            validateExampleJson();

            dom.exampleJsonTextarea.focus();
            dom.exampleJsonTextarea.setSelectionRange(0, 0);
            dom.exampleJsonTextarea.scrollTop = 0;
            handleTextareaScroll(dom.exampleJsonTextarea, dom.exampleJsonLineNumbers);
        } catch (err) {
            displayExampleJsonFeedback([{ message: `קובץ JSON לדוגמה לא תקין: ${err.message}` }]);
        }
    };
    reader.onerror = () => {
        displayExampleJsonFeedback([{ message: `שגיאה בקריאת הקובץ: ${reader.error.message}` }]);
    };
    reader.readAsText(file);
    event.target.value = '';
}

function generateSampleJsonFromSchema(schema, context = {}) {
    // 1. Handle edge cases for schema definitions
    if (!schema || (typeof schema !== 'object' && typeof schema !== 'boolean')) return null;
    if (schema === true) return "any_value";
    if (schema === false) return undefined;

    // Helper to get a value from an enum, respecting uniqueness context
    const getEnumValue = (typeCheck) => {
        if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
            let value;
            if (context.uniqueIndex !== undefined) {
                value = schema.enum[context.uniqueIndex % schema.enum.length];
            } else {
                value = schema.enum[0];
            }
            // Only return the enum value if it matches the expected type
            if (typeCheck(value)) {
                return value;
            }
        }
        return undefined; // No valid enum value found
    };
    
    // 2. Determine the type, defaulting if not specified
    const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
    
    // If type is not specified, try to infer from enum or default to string.
    if (!type) {
        if (schema.enum && schema.enum.length > 0) {
            const firstEnumValue = schema.enum[0];
            if (typeof firstEnumValue === 'object' && firstEnumValue !== null) {
                if (Array.isArray(firstEnumValue)) return generateSampleJsonFromSchema({ type: 'array', ...schema }, context);
                return generateSampleJsonFromSchema({ type: 'object', ...schema }, context);
            }
            return firstEnumValue;
        }
        return "example_string";
    }

    // 3. Generate sample based on type
    switch (type) {
        case 'object': {
            const enumValue = getEnumValue(v => typeof v === 'object' && v !== null && !Array.isArray(v));
            if (enumValue !== undefined) return enumValue;

            const obj = {};
            if (schema.properties) {
                const required = schema.required || [];
                // Generate all required properties
                for (const key of required) {
                    if (schema.properties[key]) {
                        obj[key] = generateSampleJsonFromSchema(schema.properties[key], {});
                    }
                }
                // Also add one optional property for demonstration
                const nonRequiredKey = Object.keys(schema.properties).find(k => !required.includes(k));
                if (nonRequiredKey) {
                     obj[nonRequiredKey] = generateSampleJsonFromSchema(schema.properties[nonRequiredKey], {});
                }
            }
            
            // Handle uniqueness for arrays of objects
            if (context.uniqueIndex !== undefined) {
                 if (Object.keys(obj).length > 0) {
                    const firstKey = Object.keys(obj)[0];
                    if (typeof obj[firstKey] === 'string') obj[firstKey] += `_${context.uniqueIndex}`;
                    else if (typeof obj[firstKey] === 'number') obj[firstKey] += context.uniqueIndex;
                 } else {
                     obj[`unique_prop_${context.uniqueIndex}`] = context.uniqueIndex;
                 }
            }
            return obj;
        }
        case 'array': {
            const enumValue = getEnumValue(v => Array.isArray(v));
            if (enumValue !== undefined) return enumValue;

            const arr = [];
            let itemCount = schema.minItems !== undefined ? schema.minItems : 1;
            itemCount = Math.min(itemCount, 3);
            if (schema.maxItems === 0) return [];
            
            if (schema.items) {
                for (let i = 0; i < itemCount; i++) {
                    const item = generateSampleJsonFromSchema(schema.items, { uniqueIndex: i });
                    if (item !== undefined) arr.push(item);
                }
            }
            return arr;
        }
        case 'string': {
            const enumValue = getEnumValue(v => typeof v === 'string');
            if (enumValue !== undefined) return enumValue;
            
            let example = "example";
            if (context.uniqueIndex !== undefined) example += `_${context.uniqueIndex}`;

            if (schema.minLength !== undefined) {
                if (example.length < schema.minLength) example = example.padEnd(schema.minLength, "_");
            }
            if (schema.maxLength !== undefined) {
                if (example.length > schema.maxLength) example = example.substring(0, schema.maxLength);
            }
            if (schema.minLength !== undefined && schema.maxLength !== undefined && schema.minLength > schema.maxLength) {
                return "[invalid schema: minLength > maxLength]";
            }
            return example;
        }
        case 'number':
        case 'integer': {
            const enumValue = getEnumValue(v => typeof v === 'number');
            if (enumValue !== undefined) return enumValue;
            
            const isInteger = type === 'integer';
            if ((schema.minimum > schema.maximum) || (schema.exclusiveMinimum >= schema.exclusiveMaximum)) {
                return isInteger ? 0 : 0.0;
            }

            let value;
            if (schema.minimum !== undefined) value = schema.minimum;
            else if (schema.exclusiveMinimum !== undefined) value = schema.exclusiveMinimum + (isInteger ? 1 : 0.01);
            else value = isInteger ? 100 : 42.5;

            if (schema.multipleOf > 0) {
                if (value % schema.multipleOf !== 0) {
                    value = Math.ceil(value / schema.multipleOf) * schema.multipleOf;
                }
            }

            if (schema.maximum !== undefined && value > schema.maximum) {
                value = schema.maximum;
                if (schema.multipleOf > 0) value = Math.floor(value / schema.multipleOf) * schema.multipleOf;
            }
            if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
                value = schema.exclusiveMaximum - (isInteger ? 1 : 0.01);
                if (schema.multipleOf > 0) value = Math.floor(value / schema.multipleOf) * schema.multipleOf;
            }
            
            if (schema.minimum !== undefined && value < schema.minimum) return schema.minimum;

            let finalValue = value;
            if (context.uniqueIndex !== undefined) {
                const increment = (schema.multipleOf || (isInteger ? 1 : 0.01));
                const uniqueVal = finalValue + context.uniqueIndex * increment;
                const max = schema.exclusiveMaximum ?? schema.maximum;
                if (max === undefined || uniqueVal < max) {
                    finalValue = uniqueVal;
                }
            }
            
            return isInteger ? Math.floor(finalValue) : finalValue;
        }
        case 'boolean': {
            const enumValue = getEnumValue(v => typeof v === 'boolean');
            if (enumValue !== undefined) return enumValue;

            if (context.uniqueIndex !== undefined) return context.uniqueIndex % 2 === 0;
            return true;
        }
        case 'null':
            return null;
        default:
            return `unsupported_type_${type}`;
    }
}


function handleGenerateExampleJson() {
    const schemaText = dom.schemaContentTextarea.value.trim();
    if (!schemaText) {
        displayExampleJsonFeedback([{ message: "תוכן הסכמה ריק. לא ניתן לייצר דוגמה." }]);
        switchTab('schema');
        return;
    }

    let schema;
    try {
        schema = JSON.parse(schemaText);
    } catch (e) {
        displayExampleJsonFeedback([{ message: `סכמה לא תקינה: ${e.message}` }]);
        switchTab('schema');
        return;
    }

    const exampleJson = generateSampleJsonFromSchema(schema);
    dom.exampleJsonTextarea.value = JSON.stringify(exampleJson, null, 2);
    switchTab('example');

    updateLineNumbersForTextarea(dom.exampleJsonTextarea, dom.exampleJsonLineNumbers);
    validateExampleJson();
    dom.exampleJsonTextarea.focus();
    dom.exampleJsonTextarea.scrollTop = 0;
}

export function openDeleteConfirmationModal() {
    const keyToDelete = state.currentEditingSchemaKey;
    if (!keyToDelete || state.defaultSchemaKeys.has(keyToDelete)) {
        displaySchemaEditorFeedback('error', 'לא ניתן למחוק סכמת ברירת מחדל.');
        return;
    }
    const schemaName = state.schemaData[keyToDelete]?.title || keyToDelete;
    dom.schemaToDeleteName.textContent = schemaName;
    dom.confirmDeleteSchemaModal.hidden = false;
}

export function deleteCurrentSchema() {
    const keyToDelete = state.currentEditingSchemaKey;
    if (!keyToDelete || state.defaultSchemaKeys.has(keyToDelete)) {
        dom.confirmDeleteSchemaModal.hidden = true;
        displaySchemaEditorFeedback('error', 'לא ניתן למחוק סכמת ברירת מחדל.');
        return;
    }
    try {
        delete state.schemaData[keyToDelete];
        localStorage.setItem(constants.LS_SCHEMA_KEY, JSON.stringify(state.schemaData));

        dom.confirmDeleteSchemaModal.hidden = true;
        clearSchemaEditorForm();
        dom.schemaEditorFormContainer.hidden = true;
        dom.schemaEditorFooter.hidden = true;

        populateCustomDropdowns();

        if (dom.schemaValidatorSelectBtn.dataset.value === keyToDelete) {
            updateDropdownButtonState(dom.schemaValidatorSelectBtn, '', 'בחר סכמה');
            validateAndParseJson();
        }
        displaySchemaEditorFeedback('success', `הסכמה '${keyToDelete}' נמחקה בהצלחה.`);
    } catch (e) {
        console.error('Failed to delete user schema:', e);
        dom.confirmDeleteSchemaModal.hidden = true;
        displaySchemaEditorFeedback('error', 'אירעה שגיאה במחיקת הסכמה.');
    }
}

function handleExampleFeedbackClick(e) {
    const target = e.target.closest('[data-line]');
    if (target) {
        const lineNumber = parseInt(target.dataset.line, 10);
        if (!isNaN(lineNumber)) {
            highlightExampleJsonLine(lineNumber);
        }
    }
}

export function initializeSchemaEditorEventListeners() {
    dom.schemaContentTab.addEventListener('click', () => switchTab('schema'));
    dom.exampleJsonTab.addEventListener('click', () => switchTab('example'));

    dom.uploadExampleJsonBtn.addEventListener('click', () => dom.exampleJsonFileInput.click());
    dom.exampleJsonFileInput.addEventListener('change', handleExampleJsonUpload);
    
    dom.generateExampleJsonBtn.addEventListener('click', handleGenerateExampleJson);
    dom.beautifySchemaBtn.addEventListener('click', beautifyActiveTextarea);
    dom.exampleJsonFeedback.addEventListener('click', handleExampleFeedbackClick);

    if (dom.exampleJsonFeedbackResizer) {
        dom.exampleJsonFeedbackResizer.addEventListener('mousedown', initFeedbackResize);
    }

    dom.exampleJsonTextarea.addEventListener('input', () => {
        updateLineNumbersForTextarea(dom.exampleJsonTextarea, dom.exampleJsonLineNumbers);
        clearTimeout(state.exampleJsonValidationTimeout);
        state.exampleJsonValidationTimeout = setTimeout(validateExampleJson, 500);
    });
    dom.exampleJsonTextarea.addEventListener('scroll', handleExampleJsonScroll);

    dom.schemaContentTextarea.addEventListener('input', () => {
        updateLineNumbersForTextarea(dom.schemaContentTextarea, dom.schemaContentLineNumbers);
        updateVisualBuilderFromRaw();
        clearTimeout(state.exampleJsonValidationTimeout);
        state.exampleJsonValidationTimeout = setTimeout(validateExampleJson, 500);
    });
    dom.schemaContentTextarea.addEventListener('scroll', () => {
        handleTextareaScroll(dom.schemaContentTextarea, dom.schemaContentLineNumbers);
    });
}