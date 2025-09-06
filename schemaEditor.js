import * as dom from './dom.js';
import { state } from './state.js';
import * as constants from './constants.js';
import { sanitizeInput } from './utils.js';
import { validateAndParseJson } from './editor.js';


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

function populateSchemaSelects() {
    const selects = [dom.schemaValidatorSelect, dom.schemaEditSelect];
    const keys = state.schemaData ? Object.keys(state.schemaData) : [];

    selects.forEach(select => {
        const currentVal = select.value;
        while (select.options.length > 1) {
            select.remove(1);
        }

        if (keys.length === 0) {
            select.options[0].textContent = 'אין סכמות';
            select.disabled = true;
        } else {
            select.options[0].textContent = select.id === 'schema-edit-select' ? 'בחר סכמה לעריכה...' : 'בחר סכמה';
            select.disabled = false;

            keys.sort().forEach(key => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = state.schemaData[key].title || key;
                select.appendChild(option);
            });
        }
        select.value = currentVal && keys.includes(currentVal) ? currentVal : '';
    });
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

export function triggerUIUpdate() {
    clearTimeout(state.schemaBuilderTimeout);
    state.schemaBuilderTimeout = setTimeout(buildSchemaFromUI, 300);
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
            addButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 1rem; height: 1rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg><span>${type === 'object' ? 'הוסף שדה' : 'הוסף מאפיין'}</span>`;
            actionsContainer.appendChild(addButton);
        }
        if (childrenContainer.children.length === 0 && !childrenContainer.querySelector('.field-placeholder')) {
             const placeholder = document.createElement('div');
             placeholder.className = 'field-placeholder';
             placeholder.textContent = type === 'object' ? 'אין שדות מוגדרים' : 'אין מאפיינים מוגדרים';
             childrenContainer.appendChild(placeholder);
        }
    }
}

function activateInlineEdit(displayElement, propertyToUpdate) {
    const fieldRow = displayElement.closest('.schema-field-row');
    if (!fieldRow || fieldRow.querySelector('.inline-edit-input')) return;

    const isPlaceholder = displayElement.classList.contains('is-placeholder');
    const originalValue = isPlaceholder ? '' : displayElement.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-edit-input';
    input.value = originalValue;
    
    displayElement.hidden = true;
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
    dom.schemaEditSelect.value = '';
    dom.schemaTitleInput.value = '';
    dom.schemaDescriptionInput.value = '';
    dom.schemaContentTextarea.value = '';
    state.initialSchemaStateOnLoad = '';
    state.isEditingExistingSchema = false;
    state.currentEditingSchemaKey = null;
    dom.schemaEditorFeedback.hidden = true;
    dom.schemaComplexityWarning.hidden = true;
    dom.fieldsContainer.innerHTML = '';
}

export function loadSchemaForEditing() {
    const key = dom.schemaEditSelect.value;
    dom.schemaEditorFeedback.hidden = true;
    state.currentEditingSchemaKey = key;

    if (!key) {
        clearSchemaEditorForm();
        dom.schemaEditorFormContainer.hidden = true;
        dom.schemaEditorFooter.hidden = true;
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
    }
}

export function saveSchema() {
    const title = dom.schemaTitleInput.value.trim();
    if (!title) {
        displaySchemaEditorFeedback('error', 'כותרת הסכמה היא שדה חובה.');
        return false;
    }

    const oldKey = state.currentEditingSchemaKey;
    const newKey = generateKeyFromTitle(title);
    buildSchemaFromUI();
    const content = dom.schemaContentTextarea.value.trim();

    if (!content) {
        displaySchemaEditorFeedback('error', 'תוכן הסכמה לא יכול להיות ריק.');
        return false;
    }
    
    if (state.schemaData && state.schemaData[newKey] && newKey !== state.currentEditingSchemaKey) {
        displaySchemaEditorFeedback('error', `סכמה עם הכותרת '${title}' כבר קיימת. בחר כותרת אחרת.`);
        return false;
    }

    let parsedContent;
    try {
        parsedContent = JSON.parse(content);
    } catch (e) {
        displaySchemaEditorFeedback('error', `תוכן הסכמה אינו JSON תקין: ${e.message}`);
        return false;
    }
    
    if (state.isEditingExistingSchema && state.currentEditingSchemaKey && newKey !== state.currentEditingSchemaKey) {
        delete state.schemaData[state.currentEditingSchemaKey];
    }
    state.schemaData[newKey] = parsedContent;

    try {
        localStorage.setItem(constants.LS_SCHEMA_KEY, JSON.stringify(state.schemaData));
        state.initialSchemaStateOnLoad = content;
        
        populateSchemaSelects();
        
        dom.schemaEditSelect.value = newKey;
        if (dom.schemaValidatorSelect.value === oldKey) {
            dom.schemaValidatorSelect.value = newKey;
        }

        displaySchemaEditorFeedback('success', 'הסכמה נשמרה בהצלחה!');
        state.currentEditingSchemaKey = newKey;
        state.isEditingExistingSchema = true;

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

export function openSchemaEditor() {
    const selectedSchemaKey = dom.schemaValidatorSelect.value;
    dom.schemaEditorModal.hidden = false;
    populateSchemaSelects();
    if (selectedSchemaKey && state.schemaData && state.schemaData[selectedSchemaKey]) {
        dom.schemaEditSelect.value = selectedSchemaKey;
        loadSchemaForEditing();
    } else {
        clearSchemaEditorForm();
        dom.schemaEditorFormContainer.hidden = true;
        dom.schemaEditorFooter.hidden = true;
    }
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

export function handleSchemaFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const loadedJson = JSON.parse(e.target.result);
            clearSchemaEditorForm();
            dom.schemaEditorFormContainer.hidden = false;
            dom.schemaEditorFooter.hidden = false;
            const isSchema = loadedJson && typeof loadedJson === 'object' && !Array.isArray(loadedJson) && (loadedJson.hasOwnProperty('$schema') || loadedJson.hasOwnProperty('properties'));
            let schemaToLoad;
            let titleToSet = file.name.replace(/\.json$/i, '');
            if (isSchema) {
                schemaToLoad = loadedJson;
                if (schemaToLoad.title) titleToSet = schemaToLoad.title; else schemaToLoad.title = titleToSet;
            } else if (loadedJson && typeof loadedJson === 'object' && !Array.isArray(loadedJson)) {
                displaySchemaEditorFeedback('success', 'קובץ JSON רגיל זוהה. מתבצעת המרה אוטומטית לסכמה.');
                
                const inferredSchema = await generateSchemaFromObject(loadedJson);
            
                const newSchema = {
                    "$schema": "http://json-schema.org/draft-07/schema#",
                    "title": titleToSet, 
                    "description": `סכמה שנוצרה אוטומטית מהקובץ ${file.name}`,
                    "type": "object", 
                    "properties": inferredSchema.properties,
                };
                if (inferredSchema.required && inferredSchema.required.length > 0) {
                    newSchema.required = inferredSchema.required;
                }
                
                schemaToLoad = newSchema;
            } else throw new Error("לא ניתן להמיר את קובץ ה-JSON. יש להעלות אובייקט JSON.");

            const schemaString = JSON.stringify(schemaToLoad, null, 2);
            dom.schemaContentTextarea.value = schemaString;
            state.initialSchemaStateOnLoad = schemaString;
            updateVisualBuilderFromRaw();
            state.isEditingExistingSchema = false;
            state.currentEditingSchemaKey = null;
        } catch (err) { displaySchemaEditorFeedback('error', `קובץ לא תקין. ${err.message}`); }
    };
    reader.onerror = () => displaySchemaEditorFeedback('error', `שגיאה בקריאת הקובץ: ${reader.error.message}`);
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
    updateVisualBuilderFromRaw();
    dom.schemaTitleInput.focus();
}

export async function initializeSchemaValidator() {
    try {
        const storedSchemas = localStorage.getItem(constants.LS_SCHEMA_KEY);
        if (storedSchemas) {
            state.schemaData = JSON.parse(storedSchemas);
        } else {
            console.log("No schemas in localStorage, fetching from schema directory...");
            state.schemaData = {};
            const indexResponse = await fetch('./schema/index.json');
            if (!indexResponse.ok) {
                throw new Error(`Could not fetch schema/index.json: ${indexResponse.statusText}`);
            }
            const schemaFiles = await indexResponse.json();

            const schemaPromises = schemaFiles.map(async (filename) => {
                const schemaResponse = await fetch(`./schema/${filename}`);
                if (!schemaResponse.ok) {
                    console.error(`Failed to fetch schema/${filename}`);
                    return null;
                }
                const schemaContent = await schemaResponse.json();
                const schemaKey = filename.replace('.json', '');
                return { key: schemaKey, content: schemaContent };
            });

            const results = await Promise.all(schemaPromises);
            results.forEach(result => {
                if (result) {
                    state.schemaData[result.key] = result.content;
                }
            });

            if (Object.keys(state.schemaData).length > 0) {
                localStorage.setItem(constants.LS_SCHEMA_KEY, JSON.stringify(state.schemaData));
            }
        }
    } catch (e) {
        console.error("Could not load or parse schema data:", e);
        state.schemaData = {};
    }

    populateSchemaSelects();
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
                addButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 1rem; height: 1rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg><span>הוסף מאפיין</span>';
                actionsContainer.appendChild(addButton);
            }
            if (childrenContainer.children.length === 0 && !childrenContainer.querySelector('.field-placeholder')) {
                 const placeholder = document.createElement('div');
                 placeholder.className = 'field-placeholder';
                 placeholder.textContent = 'אין מאפיינים מוגדרים';
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
