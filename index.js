// --- CONSTANTS ---
const ValidationStatus = {
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  IDLE: 'IDLE',
};

const ICONS = {
    SUCCESS: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24" stroke-width="1.5" stroke="currentColor" style="width:1.5rem; height:1.5rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`,
    ERROR: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24" stroke-width="1.5" stroke="currentColor" style="width:1.5rem; height:1.5rem;"><path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`,
    IDLE: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24" stroke-width="1.5" stroke="currentColor" style="width:1.5rem; height:1.5rem;"><path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>`,
};

const UID_SEPARATOR = '__JSON_LOC_UID__';
const LS_SCHEMA_KEY = 'userSchemas_v2';

// --- DOM ELEMENTS ---
const jsonInput = document.getElementById('json-input');
const lineNumbers = document.getElementById('line-numbers');
const beautifyBtn = document.getElementById('beautify-btn');
const minifyBtn = document.getElementById('minify-btn');
const treeView = document.getElementById('tree-view');
const statusBar = document.getElementById('status-bar');
const statusIcon = document.getElementById('status-icon');
const statusMessage = document.getElementById('status-message');
const errorDisplay = document.getElementById('error-display');
const errorIconEl = document.getElementById('error-icon');
const errorMessageEl = document.getElementById('error-message');
const schemaValidatorSelect = document.getElementById('schema-validator-select');
const schemaFeedback = document.getElementById('schema-feedback');
const schemaFeedbackIconEl = document.getElementById('schema-feedback-icon');
const schemaFeedbackMessageEl = document.getElementById('schema-feedback-message');
const resizer = document.getElementById('resizer');
const mainContent = document.querySelector('.main-content');
const editorPane = document.querySelector('.editor-pane');
const treePane = document.querySelector('.tree-pane');
const titleEl = document.querySelector('.title');
const treeSearchInput = document.getElementById('tree-search-input');
const treeSearchBtn = document.getElementById('tree-search-btn');
const loadFileBtn = document.getElementById('load-file-btn');
const fileInput = document.getElementById('file-input');
const manageSchemasBtn = document.getElementById('manage-schemas-btn');
const schemaEditorModal = document.getElementById('schema-editor-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const schemaEditSelect = document.getElementById('schema-edit-select');
const createNewSchemaBtn = document.getElementById('create-new-schema-btn');
const schemaTitleInput = document.getElementById('schema-title-input');
const schemaDescriptionInput = document.getElementById('schema-description-input');
const schemaContentTextarea = document.getElementById('schema-content-textarea');
const schemaEditorFeedback = document.getElementById('schema-editor-feedback');
const schemaEditorFeedbackIcon = document.getElementById('schema-editor-feedback-icon');
const schemaEditorFeedbackMessage = document.getElementById('schema-editor-feedback-message');
const downloadSchemaBtn = document.getElementById('download-schema-btn');
const saveSchemaBtn = document.getElementById('save-schema-btn');

// --- SCHEMA BUILDER UI ELEMENTS ---
const visualBuilderContainer = document.getElementById('schema-visual-builder-container');
const rawEditorContainer = document.getElementById('schema-raw-editor-container');
const fieldsContainer = document.getElementById('schema-fields-container');
const addSchemaFieldBtn = document.getElementById('add-schema-field-btn');
const fieldTemplate = document.getElementById('schema-field-template');
const schemaComplexityWarning = document.getElementById('schema-complexity-warning');
const schemaComplexityWarningIcon = document.getElementById('schema-complexity-warning-icon');
const schemaComplexityWarningMessage = document.getElementById('schema-complexity-warning-message');
const schemaEditorFormContainer = document.getElementById('schema-editor-form-container');
const schemaEditorFooter = document.getElementById('schema-editor-footer');


// --- STATE ---
let validationTimeout;
let schemaBuilderTimeout;
let currentHighlight = { gutter: null, background: null, line: null };
let currentErrorHighlight = { background: null, line: null };
let schemaData = null;
let currentErrorLineNumber = null;
let isEditingExistingSchema = false;
let nextFieldId = 0;
let currentEditingSchemaKey = null;

// --- PARSER ---
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
            const uniqueKey = `${key}${UID_SEPARATOR}${uid}`;
            locationsMap.set(uniqueKey, { originalKey: key, line: getLineNumber(jsonString, offset) });
            return `"${uniqueKey}"${colonAndSpace}`;
        });

        const parsed = JSON.parse(modifiedJsonString);
        return { parsed, locationsMap };
    };
    
    return { parse };
}

const locationParser = createLocationAwareParser();

// --- FUNCTIONS ---

function highlightErrorLine(lineNumber) {
    // Clear previous error highlight
    if (currentErrorHighlight.background) {
        currentErrorHighlight.background.remove();
        currentErrorHighlight = { background: null, line: null };
    }

    if (lineNumber === null || lineNumber === undefined) {
        return;
    }

    const editorContainer = document.querySelector('.editor-container');
    const lineHeight = parseFloat(getComputedStyle(jsonInput).lineHeight);
    const paddingTop = parseFloat(getComputedStyle(jsonInput).paddingTop);
    
    const highlightBg = document.createElement('div');
    highlightBg.className = 'line-highlight-error';
    highlightBg.style.height = `${lineHeight}px`;
    highlightBg.style.top = `${paddingTop + (lineNumber - 1) * lineHeight - jsonInput.scrollTop}px`;
    
    editorContainer.insertBefore(highlightBg, jsonInput);
    currentErrorHighlight.background = highlightBg;
    currentErrorHighlight.line = lineNumber;
}

function highlightLine(lineNumber) {
    if (currentHighlight.gutter) currentHighlight.gutter.classList.remove('line-number-highlight');
    if (currentHighlight.background) currentHighlight.background.remove();

    if (lineNumber === null || lineNumber === undefined) {
        currentHighlight = { gutter: null, background: null, line: null };
        return;
    }

    const editorContainer = document.querySelector('.editor-container');
    
    const gutterLine = lineNumbers.querySelector(`div:nth-child(${lineNumber})`);
    if (gutterLine) {
        gutterLine.classList.add('line-number-highlight');
        currentHighlight.gutter = gutterLine;
    }

    const lineHeight = parseFloat(getComputedStyle(jsonInput).lineHeight);
    const paddingTop = parseFloat(getComputedStyle(jsonInput).paddingTop);
    
    const highlightBg = document.createElement('div');
    highlightBg.className = 'line-highlight';
    highlightBg.style.height = `${lineHeight}px`;
    highlightBg.style.top = `${paddingTop + (lineNumber - 1) * lineHeight - jsonInput.scrollTop}px`;
    
    editorContainer.insertBefore(highlightBg, jsonInput);
    currentHighlight.background = highlightBg;
    currentHighlight.line = lineNumber;

    const targetScroll = (lineNumber - 1) * lineHeight;
    const viewTop = jsonInput.scrollTop;
    const viewBottom = viewTop + jsonInput.clientHeight - lineHeight;
    if (targetScroll < viewTop || targetScroll > viewBottom) {
        jsonInput.scrollTo({ top: targetScroll - (jsonInput.clientHeight / 3), behavior: 'smooth' });
    }
}

function updateLineNumbers() {
    const text = jsonInput.value;
    const lineCount = text.split('\n').length;
    lineNumbers.innerHTML = Array.from({ length: lineCount }, (_, i) => `<div>${i + 1}</div>`).join('');
}

function handleScroll() {
    lineNumbers.scrollTop = jsonInput.scrollTop;

    const lineHeight = parseFloat(getComputedStyle(jsonInput).lineHeight);
    const paddingTop = parseFloat(getComputedStyle(jsonInput).paddingTop);

    const updateHighlightPosition = (highlight) => {
        if (highlight.background && highlight.line !== null) {
            highlight.background.style.top = `${paddingTop + (highlight.line - 1) * lineHeight - jsonInput.scrollTop}px`;
        }
    };

    updateHighlightPosition(currentHighlight);
    updateHighlightPosition(currentErrorHighlight);
}

function beautifyJson() {
    const text = jsonInput.value;
    if (!text.trim()) return;
    try {
        // Use a simple JSON.parse for beautification, not the location-aware one
        const parsed = JSON.parse(text);
        jsonInput.value = JSON.stringify(parsed, null, 2);
        updateLineNumbers();
        validateAndParseJson();
    } catch (e) {
        // Can't beautify invalid JSON, do nothing.
    }
}

function minifyJson() {
    const text = jsonInput.value;
    if (!text.trim()) return;
    try {
        const parsed = JSON.parse(text);
        jsonInput.value = JSON.stringify(parsed);
        updateLineNumbers();
        validateAndParseJson();
    } catch (e) {
        // Can't minify invalid JSON, do nothing.
    }
}

function updateStatusBar(status, message) {
    statusBar.className = 'status-bar'; // Reset classes
    switch (status) {
        case ValidationStatus.SUCCESS:
            statusBar.classList.add('status-success');
            statusIcon.innerHTML = ICONS.SUCCESS;
            break;
        case ValidationStatus.ERROR:
            statusBar.classList.add('status-error');
            statusIcon.innerHTML = ICONS.ERROR;
            break;
        case ValidationStatus.IDLE:
        default:
            statusBar.classList.add('status-idle');
            statusIcon.innerHTML = ICONS.IDLE;
            break;
    }
    statusMessage.textContent = message;
}

function createJsonNode(key, value, isRoot, context, path) {
    const nodeElement = document.createElement('div');
    nodeElement.className = 'tree-node';
    if (isRoot) {
        nodeElement.dataset.isRootNode = 'true';
    }

    let displayKey = key;
    let line;

    if (context.locationsMap) {
        if (typeof key === 'string' && key.includes(UID_SEPARATOR)) {
            const locationInfo = context.locationsMap.get(key);
            if (locationInfo) {
                displayKey = locationInfo.originalKey;
                line = locationInfo.line;
            }
        }
    } else if (context.lineMap && path.length > 0) {
        const lineIndex = path[0];
        if (context.lineMap[lineIndex] !== undefined) {
             line = context.lineMap[lineIndex];
        }
    }
    
    const formatKey = (k) => {
        if (context.isParentArray) return `[${k}]`;
        return k;
    };
    
    const isObject = typeof value === 'object' && value !== null;

    if (isObject) {
        const details = document.createElement('details');
        if (isRoot) details.open = true;
        if (isRoot) details.dataset.isRoot = 'true';

        const summary = document.createElement('summary');
        
        const keySpan = document.createElement('span');
        if (isRoot) {
            keySpan.className = 'tree-key-root';
            keySpan.textContent = '$';
        } else {
            keySpan.className = 'tree-key';
            keySpan.textContent = formatKey(displayKey);
        }

        if(line) keySpan.dataset.line = line;
        summary.appendChild(keySpan);
        
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children';
        
        const entries = Object.entries(value);
        if (entries.length > 0) {
            let i = 0;
            for (const [childKey, childValue] of entries) {
                const childPath = [...path, Array.isArray(value) ? parseInt(childKey) : childKey];
                const childNode = createJsonNode(childKey, childValue, false, { ...context, isParentArray: Array.isArray(value) }, childPath);
                
                if (i === entries.length - 1) {
                    childNode.classList.add('is-last');
                }
                
                childrenContainer.appendChild(childNode);
                i++;
            }
        } else {
            details.classList.add('empty');
        }
        
        details.appendChild(summary);
        details.appendChild(childrenContainer);
        nodeElement.appendChild(details);

        const updateSummary = () => {
            const oldSummarySpan = summary.querySelector('.tree-summary');
            if(oldSummarySpan) oldSummarySpan.remove();

            if (!details.open) {
                const summarySpan = document.createElement('span');
                summarySpan.className = 'tree-summary';
                const summaryText = Array.isArray(value) 
                    ? `[Array(${entries.length})]`
                    : `{Object}`;
                summarySpan.textContent = summaryText;
                summary.appendChild(summarySpan);
            }
        };
        
        details.addEventListener('toggle', updateSummary);
        updateSummary(); // Initial call
        
    } else {
        const leaf = document.createElement('div');
        leaf.className = 'tree-leaf';
        if(line) leaf.dataset.line = line;

        const keySpan = document.createElement('span');
        keySpan.className = 'tree-key';
        keySpan.textContent = formatKey(displayKey);
        
        const valueSpan = document.createElement('span');
        const valueType = value === null ? 'object' : typeof value;
        valueSpan.className = `tree-value tree-value-${valueType}`;
        valueSpan.textContent = String(value);

        leaf.appendChild(keySpan);
        leaf.appendChild(valueSpan);
        nodeElement.appendChild(leaf);
    }

    return nodeElement;
}


function buildTreeView(data, context = {}) {
    treeView.innerHTML = '';
    if (treeSearchInput) treeSearchInput.value = ''; // Clear search field
    highlightLine(null);
    if (data === null || data === undefined) {
        treeView.innerHTML = '<p class="tree-placeholder">הצג תצוגת עץ כאן כאשר ה-JSON תקין.</p>';
        return;
    }
    const rootNode = createJsonNode(Array.isArray(data) ? 'Array' : 'Object', data, true, { ...context, isParentArray: false }, []);
    treeView.appendChild(rootNode);
}

function getLineAndColumnFromPosition(text, position) {
    const textToPosition = text.substring(0, position);
    const lines = textToPosition.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    return { line, column };
}

function validateJsonAgainstSchema(jsonData, schema) {
    const errors = [];

    function pushError(baseMessage, currentSchema) {
        let finalMessage = baseMessage;
        if (currentSchema && currentSchema.description) {
            finalMessage += ` (תיאור: ${currentSchema.description})`;
        }
        errors.push(finalMessage);
    }

    function validate(instance, schema, path) {
        if (!schema) return;

        const instanceType = Array.isArray(instance) ? 'array' : (instance === null ? 'null' : typeof instance);
        
        // TYPE VALIDATION
        if (schema.type) {
            const schemaType = schema.type;
            let typeIsValid = false;
            if (schemaType === instanceType) {
                typeIsValid = true;
            } else if (schemaType === 'number' && typeof instance === 'number') {
                typeIsValid = true; // Allow integer for type number
            } else if (schemaType === 'integer' && Number.isInteger(instance)) {
                typeIsValid = true;
            }
            
            if (!typeIsValid) {
                pushError(`שגיאת טיפוס בנתיב '${path}': צפוי '${schemaType}', התקבל '${instanceType}'.`, schema);
                return; // Stop validating this branch if type is wrong
            }
        }
        
        // STRING VALIDATIONS
        if (instanceType === 'string') {
            if (schema.minLength !== undefined && instance.length < schema.minLength) {
                pushError(`אורך קצר מדי בנתיב '${path}': האורך הוא ${instance.length}, אך המינימום הנדרש הוא ${schema.minLength}.`, schema);
            }
            if (schema.maxLength !== undefined && instance.length > schema.maxLength) {
                pushError(`אורך ארוך מדי בנתיב '${path}': האורך הוא ${instance.length}, אך המקסימום המותר הוא ${schema.maxLength}.`, schema);
            }
            if (schema.pattern) {
                try {
                    const regex = new RegExp(schema.pattern);
                    if (!regex.test(instance)) {
                        pushError(`ערך לא תואם לתבנית בנתיב '${path}': הערך '${instance}' אינו תואם לתבנית '${schema.pattern}'.`, schema);
                    }
                } catch (e) {
                    console.error(`Invalid regex pattern in schema at path '${path}': ${schema.pattern}`);
                }
            }
        }

        // NUMBER VALIDATIONS
        if (typeof instance === 'number') {
            if (schema.minimum !== undefined && instance < schema.minimum) {
                pushError(`ערך נמוך מדי בנתיב '${path}': הערך הוא ${instance}, אך המינימום המותר הוא ${schema.minimum}.`, schema);
            }
            if (schema.maximum !== undefined && instance > schema.maximum) {
                pushError(`ערך גבוה מדי בנתיב '${path}': הערך הוא ${instance}, אך המקסימום המותר הוא ${schema.maximum}.`, schema);
            }
        }

        if (schema.enum) {
            if (Array.isArray(schema.enum) && !schema.enum.includes(instance)) {
                pushError(`ערך לא חוקי בנתיב '${path}': הערך '${instance}' אינו אחד מהערכים המותרים (${schema.enum.join(', ')}).`, schema);
            }
        }

        if (schema.type === 'object' && instanceType === 'object') {
            if (schema.required) {
                for (const key of schema.required) {
                    if (instance[key] === undefined) {
                        const propertySchema = schema.properties ? schema.properties[key] : undefined;
                        pushError(`מאפיין חובה חסר בנתיב '${path}': '${key}'.`, propertySchema);
                    }
                }
            }
            if (schema.properties) {
                for (const key in instance) {
                    if (Object.prototype.hasOwnProperty.call(instance, key) && schema.properties[key]) {
                        validate(instance[key], schema.properties[key], `${path}/${key}`);
                    }
                }
            }
        }

        if (schema.type === 'array' && instanceType === 'array') {
            if (schema.items) {
                for (let i = 0; i < instance.length; i++) {
                    validate(instance[i], schema.items, `${path}[${i}]`);
                }
            }
        }
    }

    validate(jsonData, schema, 'root');
    return errors;
}

function displaySchemaValidationResults(errors, objectCount = 1) {
    schemaFeedback.hidden = true;
    schemaFeedback.className = 'feedback-display';

    if (!errors) return;

    if (errors.length === 0) {
        schemaFeedback.classList.add('feedback-success');
        schemaFeedbackIconEl.innerHTML = ICONS.SUCCESS;
        const objectStr = objectCount > 1 ? `${objectCount} האובייקטים` : 'האובייקט';
        schemaFeedbackMessageEl.textContent = `אימות סכמה עבר בהצלחה! ${objectStr} תואמ(ים) לסכמה שנבחרה.`;
        schemaFeedback.hidden = false;
    } else {
        schemaFeedback.classList.add('feedback-error');
        schemaFeedbackIconEl.innerHTML = ICONS.ERROR;
        const errorHeader = `נמצאו ${errors.length} שגיאות אימות סכמה:`;
        const errorList = errors.slice(0, 10).map(e => `- ${e}`).join('\n');
        const extraErrors = errors.length > 10 ? `\n...ועוד ${errors.length - 10} שגיאות.` : '';
        schemaFeedbackMessageEl.textContent = `${errorHeader}\n${errorList}${extraErrors}`;
        schemaFeedback.hidden = false;
    }
}

function validateAndParseJson() {
    const text = jsonInput.value;
    
    errorDisplay.hidden = true;
    errorDisplay.classList.remove('clickable');
    currentErrorLineNumber = null;
    schemaFeedback.hidden = true;
    highlightLine(null);
    highlightErrorLine(null);

    const previousErrorLine = lineNumbers.querySelector('.line-number-error');
    if (previousErrorLine) {
        previousErrorLine.classList.remove('line-number-error');
    }

    if (!text.trim()) {
        updateStatusBar(ValidationStatus.IDLE, 'הדבק את ה-JSON שלך ובדוק את תקינותו, או נסה פורמט JSON Lines.');
        buildTreeView(undefined);
        beautifyBtn.disabled = true;
        minifyBtn.disabled = true;
        return;
    }

    beautifyBtn.disabled = false;
    minifyBtn.disabled = false;
    
    const selectedSchemaKey = schemaValidatorSelect.value;
    const runValidation = (parsedData) => {
        if (!selectedSchemaKey || !schemaData) {
            displaySchemaValidationResults(null);
            return;
        }
        const schema = schemaData[selectedSchemaKey];
        if (!schema) return;

        const dataToValidate = Array.isArray(parsedData) ? parsedData : [parsedData];
        let allErrors = [];
        
        for (let i = 0; i < dataToValidate.length; i++) {
            const item = dataToValidate[i];
            const errors = validateJsonAgainstSchema(item, schema);
            if (errors.length > 0) {
                if (dataToValidate.length > 1) {
                    allErrors.push(...errors.map(e => `[אובייקט ${i + 1}] ${e}`));
                } else {
                    allErrors.push(...errors);
                }
            }
        }
        displaySchemaValidationResults(allErrors, dataToValidate.length);
    };

    try {
        const { parsed, locationsMap } = locationParser.parse(text);
        const plainParsed = JSON.parse(text);
        updateStatusBar(ValidationStatus.SUCCESS, 'JSON תקין!');
        buildTreeView(parsed, { locationsMap });
        runValidation(plainParsed);
        return;
    } catch (e) {
        // Not a valid single JSON, try JSON Lines
    }

    const lines = text.trim().split('\n');
    if (lines.length > 1) {
        const parsedLines = [];
        const lineMap = [];
        let isAllLinesValid = true;
        let lineCursor = 0;

        for(let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '') continue;
            try {
                parsedLines.push(JSON.parse(line));
                lineMap[lineCursor] = i + 1; // map parsed index to original line number
                lineCursor++;
            } catch {
                isAllLinesValid = false;
                break;
            }
        }

        if (isAllLinesValid && parsedLines.length > 0) {
            updateStatusBar(ValidationStatus.SUCCESS, 'זוהה פורמט JSON Lines. כל השורות תקינות!');
            buildTreeView(parsedLines, { lineMap });
            runValidation(parsedLines);
            return;
        }
    }

    try {
      JSON.parse(text);
    } catch(e) {
        updateStatusBar(ValidationStatus.ERROR, 'JSON לא תקין. תקן את השגיאה שמוצגת למעלה.');
        
        let detailedMessage = e.message;
        const positionMatch = e.message.match(/at position (\d+)/);
        if (positionMatch) {
            const position = parseInt(positionMatch[1], 10);
            const { line, column } = getLineAndColumnFromPosition(text, position);
            
            let errorLineToHighlight = line;
            let finalMessage = e.message.replace(`at position ${position}`, `(line ${line}, column ${column})`);
            const isLikelyMissingCommaError = /Unexpected string|Unexpected number|Unexpected token ["tfn{\[]|Expected ','/i.test(e.message);

            if (isLikelyMissingCommaError && line > 1) {
                const lines = text.split('\n');
                let previousLineIndex = -1;
                for (let i = line - 2; i >= 0; i--) {
                    if (lines[i].trim() !== '') {
                        previousLineIndex = i;
                        break;
                    }
                }

                if (previousLineIndex !== -1) {
                    const prevLineTrimmed = lines[previousLineIndex].trim();
                    const lastChar = prevLineTrimmed.slice(-1);
                    if (!['{', '[', ','].includes(lastChar)) {
                        const correctedLineNumber = previousLineIndex + 1;
                        const correctedOriginalMessage = finalMessage.replace(`(line ${line},`, `(line ${correctedLineNumber},`);
                        errorLineToHighlight = correctedLineNumber;
                        finalMessage = `ייתכן שחסר פסיק בשורה ${errorLineToHighlight}.\n${correctedOriginalMessage}`;
                    }
                }
            }

            currentErrorLineNumber = errorLineToHighlight;
            errorDisplay.classList.add('clickable');
            detailedMessage = finalMessage;

            const errorLineDiv = lineNumbers.querySelector(`div:nth-child(${errorLineToHighlight})`);
            if (errorLineDiv) {
                errorLineDiv.classList.add('line-number-error');
            }
            highlightErrorLine(errorLineToHighlight);

        } else {
             currentErrorLineNumber = null;
             errorDisplay.classList.remove('clickable');
        }
        
        errorIconEl.innerHTML = ICONS.ERROR;
        errorMessageEl.textContent = detailedMessage;
        errorDisplay.hidden = false;
    }
    buildTreeView(null);
}

// --- SCHEMA MANAGEMENT / BUILDER FUNCTIONS ---

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
    const selects = [schemaValidatorSelect, schemaEditSelect];
    const keys = schemaData ? Object.keys(schemaData) : [];

    selects.forEach(select => {
        const currentVal = select.value;
        // Clear existing options, keeping the placeholder
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
                option.textContent = schemaData[key].title || key;
                select.appendChild(option);
            });
        }
        select.value = currentVal && keys.includes(currentVal) ? currentVal : '';
    });
}

function displaySchemaEditorFeedback(type, message) {
    schemaEditorFeedback.hidden = false;
    schemaEditorFeedback.className = `feedback-display feedback-${type}`;
    schemaEditorFeedbackIcon.innerHTML = type === 'success' ? ICONS.SUCCESS : ICONS.ERROR;
    schemaEditorFeedbackMessage.textContent = message;

    setTimeout(() => {
        if (!schemaEditorModal.hidden) {
             schemaEditorFeedback.hidden = true;
        }
    }, 5000);
}

function updateValidationVisibility(fieldRow) {
    const selectedType = fieldRow.querySelector('.field-type').value;
    const validationGroups = fieldRow.querySelectorAll('.validation-group');
    validationGroups.forEach(group => {
        const supportedTypes = group.dataset.type.split(' ');
        if (supportedTypes.includes(selectedType)) {
            group.hidden = false;
        } else {
            group.hidden = true;
        }
    });
}

function addSchemaFieldRow(fieldData = {}, focusOnCreate = false) {
    const fragment = fieldTemplate.content.cloneNode(true);
    const fieldRow = fragment.querySelector('.schema-field-row');
    fieldRow.dataset.fieldId = nextFieldId++;

    if (fieldData.name) fieldRow.querySelector('.field-name').value = fieldData.name;
    if (fieldData.type) fieldRow.querySelector('.field-type').value = fieldData.type;
    if (fieldData.description) fieldRow.querySelector('.field-description').value = fieldData.description;
    if (fieldData.required) fieldRow.querySelector('.field-required').checked = fieldData.required;

    // Populate validation rules
    const validationInputs = fieldRow.querySelectorAll('.validation-input');
    validationInputs.forEach(input => {
        const rule = input.dataset.rule;
        if (fieldData[rule] !== undefined) {
            if (rule === 'enum' && Array.isArray(fieldData[rule])) {
                input.value = fieldData[rule].join(', ');
            } else {
                input.value = fieldData[rule];
            }
        }
    });

    fieldsContainer.appendChild(fragment);
    const newRow = fieldsContainer.lastElementChild;
    updateValidationVisibility(newRow);

    if (focusOnCreate) {
        const nameInput = newRow.querySelector('.field-name');
        if (nameInput) {
            nameInput.focus();
        }
    }
}

function buildSchemaFromUI() {
    const schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": schemaTitleInput.value.trim() || "Untitled Schema",
        "description": schemaDescriptionInput.value.trim(),
        "type": "object",
        "properties": {},
        "required": []
    };

    if (!schema.description) {
        delete schema.description;
    }

    const requiredFields = [];
    const fieldRows = fieldsContainer.querySelectorAll('.schema-field-row');

    fieldRows.forEach(row => {
        const name = row.querySelector('.field-name').value.trim();
        if (!name) return; // Skip fields without a name

        const type = row.querySelector('.field-type').value;
        const description = row.querySelector('.field-description').value.trim();
        const isRequired = row.querySelector('.field-required').checked;

        const property = { type };
        if (description) {
            property.description = description;
        }

        if (isRequired) {
            requiredFields.push(name);
        }

        // Add validation rules based on visible inputs
        const validationInputs = row.querySelectorAll('.validation-input:not([hidden])');
        validationInputs.forEach(input => {
            const rule = input.dataset.rule;
            let value = input.value.trim();

            if (value) {
                if (rule === 'enum') {
                    const enumArray = value.split(',').map(v => v.trim()).filter(Boolean);
                    if (enumArray.length > 0) {
                        if (type === 'number' || type === 'integer') {
                            property[rule] = enumArray.map(v => parseFloat(v)).filter(v => !isNaN(v));
                        } else {
                            property[rule] = enumArray;
                        }
                    }
                } else if (['minLength', 'maxLength', 'minimum', 'maximum'].includes(rule)) {
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                        property[rule] = numValue;
                    }
                } else {
                    property[rule] = value;
                }
            }
        });

        schema.properties[name] = property;
    });

    if (requiredFields.length > 0) {
        schema.required = requiredFields;
    } else {
        delete schema.required;
    }
    
    // Prevent event loops by only updating if the content is different
    try {
        const currentContent = JSON.parse(schemaContentTextarea.value);
        if (JSON.stringify(currentContent) === JSON.stringify(schema)) {
            return;
        }
    } catch(e) {
        // Current content is invalid, so update is needed
    }

    schemaContentTextarea.value = JSON.stringify(schema, null, 2);
}

function populateUIFromSchema(schema) {
    fieldsContainer.innerHTML = '';
    schemaTitleInput.value = schema?.title || '';
    schemaDescriptionInput.value = schema?.description || '';
    
    let canUseBuilder = true;
    schemaComplexityWarning.hidden = true;

    if (!schema || schema.type !== 'object' || typeof schema.properties !== 'object') {
        canUseBuilder = false;
    } else {
        for (const key in schema.properties) {
            const prop = schema.properties[key];
            if (typeof prop.type !== 'string') {
                canUseBuilder = false;
                break;
            }
        }
    }

    if (!canUseBuilder) {
        schemaComplexityWarningIcon.innerHTML = ICONS.IDLE;
        schemaComplexityWarningMessage.textContent = "הסכמה מורכבת מדי לבנאי הויזואלי. ניתן לערוך אותה רק דרך עורך ה-JSON.";
        schemaComplexityWarning.hidden = false;
        return;
    }
    
    const properties = schema.properties || {};
    const required = schema.required || [];

    for (const name in properties) {
        const prop = properties[name];
        addSchemaFieldRow({
            name,
            type: prop.type,
            description: prop.description,
            required: required.includes(name),
            minLength: prop.minLength,
            maxLength: prop.maxLength,
            pattern: prop.pattern,
            minimum: prop.minimum,
            maximum: prop.maximum,
            enum: prop.enum,
        });
    }
}

function updateVisualBuilderFromRaw() {
    clearTimeout(schemaBuilderTimeout); // Debounce
    schemaBuilderTimeout = setTimeout(() => {
        try {
            const rawContent = schemaContentTextarea.value.trim();
            if (!rawContent) {
                fieldsContainer.innerHTML = '';
                schemaTitleInput.value = '';
                schemaDescriptionInput.value = '';
                schemaComplexityWarning.hidden = true;
                return;
            };

            const schema = JSON.parse(rawContent);
            populateUIFromSchema(schema);
        } catch (e) {
            fieldsContainer.innerHTML = '';
            schemaComplexityWarningIcon.innerHTML = ICONS.ERROR;
            schemaComplexityWarningMessage.textContent = `תוכן ה-JSON אינו תקין: ${e.message}`;
            schemaComplexityWarning.hidden = false;
        }
    }, 500);
}

function clearSchemaEditorForm() {
    schemaEditSelect.value = '';
    schemaTitleInput.value = '';
    schemaDescriptionInput.value = '';
    schemaContentTextarea.value = '';
    isEditingExistingSchema = false;
    currentEditingSchemaKey = null;
    schemaEditorFeedback.hidden = true;
    schemaComplexityWarning.hidden = true;
    fieldsContainer.innerHTML = '';
    clearSchemaHighlight();
}

function loadSchemaForEditing() {
    const key = schemaEditSelect.value;
    schemaEditorFeedback.hidden = true;
    currentEditingSchemaKey = key;

    if (!key) {
        clearSchemaEditorForm();
        schemaEditorFormContainer.hidden = true;
        schemaEditorFooter.hidden = true;
        return;
    }

    schemaEditorFormContainer.hidden = false;
    schemaEditorFooter.hidden = false;

    const schema = schemaData[key];
    if (schema) {
        isEditingExistingSchema = true;
        schemaContentTextarea.value = JSON.stringify(schema, null, 2);
        populateUIFromSchema(schema);
    }
}

function saveSchema() {
    const title = schemaTitleInput.value.trim();
    const newKey = generateKeyFromTitle(title);
    
    buildSchemaFromUI();
    const content = schemaContentTextarea.value.trim();

    if (!title || !content) {
        displaySchemaEditorFeedback('error', 'יש למלא את כל השדות: כותרת ותוכן.');
        return;
    }
    
    if (schemaData && schemaData[newKey] && newKey !== currentEditingSchemaKey) {
        displaySchemaEditorFeedback('error', `סכמה עם הכותרת '${title}' כבר קיימת. בחר כותרת אחרת.`);
        return;
    }

    let parsedContent;
    try {
        parsedContent = JSON.parse(content);
    } catch (e) {
        displaySchemaEditorFeedback('error', `תוכן הסכמה אינו JSON תקין: ${e.message}`);
        return;
    }
    
    parsedContent.title = title;
    parsedContent.description = schemaDescriptionInput.value.trim();
    if (!parsedContent.description) {
        delete parsedContent.description;
    }

    if (!schemaData) {
        schemaData = {};
    }
    
    if (isEditingExistingSchema && currentEditingSchemaKey && newKey !== currentEditingSchemaKey) {
        delete schemaData[currentEditingSchemaKey];
    }

    schemaData[newKey] = parsedContent;

    try {
        localStorage.setItem(LS_SCHEMA_KEY, JSON.stringify(schemaData));
        populateSchemaSelects();
        displaySchemaEditorFeedback('success', 'הסכמה נשמרה בהצלחה!');
        
        setTimeout(() => {
             closeSchemaEditor();
             validateAndParseJson();
        }, 1000);

    } catch (e) {
        console.error('Failed to save schemas to localStorage:', e);
        displaySchemaEditorFeedback('error', 'שגיאה בשמירה ל-LocalStorage. ייתכן שהאחסון מלא.');
    }
}

function downloadSchemaFile() {
    const content = schemaContentTextarea.value.trim();
    if (!content) {
        displaySchemaEditorFeedback('error', 'אין תוכן לשמור.');
        return;
    }

    try {
        // Validate it's JSON before saving
        JSON.parse(content);
    } catch(e) {
        displaySchemaEditorFeedback('error', 'לא ניתן לשמור קובץ, תוכן הסכמה אינו JSON תקין.');
        return;
    }

    const title = schemaTitleInput.value.trim();
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

function openSchemaEditor() {
    const selectedSchemaKey = schemaValidatorSelect.value;

    schemaEditorModal.hidden = false;
    populateSchemaSelects();
    
    // Check if a valid schema was selected in the main view
    if (selectedSchemaKey && schemaData && schemaData[selectedSchemaKey]) {
        schemaEditSelect.value = selectedSchemaKey;
        loadSchemaForEditing(); // This function will load the data and show the form
    } else {
        // If no schema was selected, just open the editor in its default state
        clearSchemaEditorForm();
        schemaEditorFormContainer.hidden = true;
        schemaEditorFooter.hidden = true;
    }
}

function closeSchemaEditor() {
    schemaEditorModal.hidden = true;
    clearSchemaHighlight();
}

function clearSchemaHighlight() {
    const textarea = schemaContentTextarea;
    // Collapse selection to its start to remove highlight without moving cursor
    if (textarea.selectionEnd > textarea.selectionStart) {
        textarea.setSelectionRange(textarea.selectionStart, textarea.selectionStart);
    }
}

function highlightSchemaProperty(focusedElement) {
    const textarea = schemaContentTextarea;

    if (!focusedElement || !textarea.value.trim()) {
        return;
    }

    const row = focusedElement.closest('.schema-field-row');
    if (!row) return;

    // Use a microtask to ensure any pending UI/model updates (like from an input event) have completed
    setTimeout(() => {
        const text = textarea.value;
        const fieldName = row.querySelector('.field-name').value.trim();
        if (!fieldName || !text) return;

        let startIndex = -1;
        let endIndex = -1;
        
        let keyToFind = '';
        let isRequiredSearch = false;

        if (focusedElement.classList.contains('field-name')) {
            keyToFind = `"${fieldName}"`;
        } else if (focusedElement.classList.contains('field-type')) {
            keyToFind = `"type"`;
        } else if (focusedElement.classList.contains('field-description')) {
            keyToFind = `"description"`;
        } else if (focusedElement.dataset.rule) {
            keyToFind = `"${focusedElement.dataset.rule}"`;
        } else if (focusedElement.classList.contains('field-required')) {
            isRequiredSearch = true;
        }

        if (!keyToFind && !isRequiredSearch) return;

        if (isRequiredSearch) {
            const requiredRegex = /"required"\s*:\s*\[([^\]]*)\]/;
            const requiredMatch = text.match(requiredRegex);
            if (requiredMatch) {
                const requiredArrayContent = requiredMatch[1];
                const requiredArrayOffset = requiredMatch.index + requiredMatch[0].indexOf('[') + 1;
                const nameInArrayRegex = new RegExp(`"${fieldName}"`);
                const nameMatch = requiredArrayContent.match(nameInArrayRegex);
                if (nameMatch) {
                    startIndex = requiredArrayOffset + nameMatch.index;
                    endIndex = startIndex + nameMatch[0].length;
                }
            }
        } else {
            const propRegex = new RegExp(`"${fieldName}"\\s*:\\s*{`);
            const propMatch = text.match(propRegex);
            const propStartIndex = propMatch ? propMatch.index : -1;
            
            if (propStartIndex !== -1) {
                if (focusedElement.classList.contains('field-name')) {
                    startIndex = propStartIndex;
                    endIndex = propStartIndex + keyToFind.length;
                } else {
                    let openBraces = 1;
                    let searchAreaEnd = text.length;
                    for (let i = propStartIndex + propMatch[0].length; i < text.length; i++) {
                        if (text[i] === '{') openBraces++;
                        if (text[i] === '}') openBraces--;
                        if (openBraces === 0) {
                            searchAreaEnd = i;
                            break;
                        }
                    }
                    const keyIndex = text.substring(propStartIndex, searchAreaEnd).indexOf(keyToFind);
                    if (keyIndex !== -1) {
                        startIndex = propStartIndex + keyIndex;
                        endIndex = startIndex + keyToFind.length;
                    }
                }
            }
        }
        
        if (startIndex !== -1 && endIndex !== -1) {
            textarea.setSelectionRange(startIndex, endIndex);

            const textToSelection = text.substring(0, startIndex);
            const lineNum = textToSelection.split('\n').length;
            const computedStyle = window.getComputedStyle(textarea);
            const realLineHeight = parseFloat(computedStyle.lineHeight) || 24;
            const targetScrollTop = (lineNum - 1) * realLineHeight;

            if (textarea.scrollTop > targetScrollTop || (textarea.scrollTop + textarea.clientHeight) < (targetScrollTop + realLineHeight)) {
                 textarea.scrollTop = Math.max(0, targetScrollTop - textarea.clientHeight / 3);
            }
        }

    }, 0);
}


async function initializeSchemaValidator() {
    try {
        const storedSchemas = localStorage.getItem(LS_SCHEMA_KEY);
        if (storedSchemas) {
            schemaData = JSON.parse(storedSchemas);
        } else {
            console.log("No schemas in localStorage, fetching from schema directory...");
            schemaData = {};
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
                    schemaData[result.key] = result.content;
                }
            });

            if (Object.keys(schemaData).length > 0) {
                localStorage.setItem(LS_SCHEMA_KEY, JSON.stringify(schemaData));
            }
        }
    } catch (e) {
        console.error("Could not load or parse schema data:", e);
        // In case of any error, start with an empty set of schemas
        schemaData = {};
    }

    populateSchemaSelects();
}

function initResize(e) {
    if (e.button !== 0) return;
    e.preventDefault();

    const startX = e.clientX;
    const startEditorWidth = editorPane.offsetWidth;
    const startTreeWidth = treePane.offsetWidth;

    const doResize = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const totalWidth = startEditorWidth + startTreeWidth;
        const minWidth = 200;

        let newEditorWidth = startEditorWidth - dx;

        if (newEditorWidth < minWidth) {
            newEditorWidth = minWidth;
        }
        if (totalWidth - newEditorWidth < minWidth) {
            newEditorWidth = totalWidth - minWidth;
        }

        const newEditorFraction = newEditorWidth / totalWidth;
        const newTreeFraction = 1 - newEditorFraction;

        mainContent.style.gridTemplateColumns = `${newEditorFraction}fr 5px ${newTreeFraction}fr`;
    };

    const stopResize = () => {
        window.removeEventListener('mousemove', doResize);
        window.removeEventListener('mouseup', stopResize);
    };

    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResize);
}

function showEasterEgg() {
    if (document.querySelector('.easter-egg-overlay')) {
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'easter-egg-overlay';

    const messageBox = document.createElement('div');
    messageBox.className = 'easter-egg-box';
    messageBox.textContent = 'made by: Galanti Amir';

    overlay.appendChild(messageBox);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', () => {
        overlay.remove();
    });
}

function clearSearchHighlights() {
    const highlighted = treeView.querySelectorAll('.search-highlight');
    highlighted.forEach(el => el.classList.remove('search-highlight'));
}

function performTreeSearch() {
    clearSearchHighlights();
    const searchTerm = treeSearchInput.value.trim().toLowerCase();

    if (!searchTerm) {
        return;
    }

    const revealNode = (node) => {
        let parent = node.closest('details');
        while(parent) {
            parent.open = true;
            parent = parent.parentElement.closest('details');
        }
    };

    const leaves = treeView.querySelectorAll('.tree-leaf');
    leaves.forEach(leaf => {
        const key = leaf.querySelector('.tree-key')?.textContent.toLowerCase() || '';
        const value = leaf.querySelector('.tree-value')?.textContent.toLowerCase() || '';

        if (key.includes(searchTerm) || value.includes(searchTerm)) {
            leaf.classList.add('search-highlight');
            revealNode(leaf);
        }
    });

    const summaries = treeView.querySelectorAll('details > summary');
    summaries.forEach(summary => {
        const key = summary.querySelector('.tree-key')?.textContent.toLowerCase() || '';
        if (key.includes(searchTerm)) {
            summary.classList.add('search-highlight');
            revealNode(summary);
        }
    });
}

// --- EVENT LISTENERS ---
jsonInput.addEventListener('input', () => {
    updateLineNumbers();
    clearTimeout(validationTimeout);
    validationTimeout = setTimeout(validateAndParseJson, 500);
});

jsonInput.addEventListener('paste', () => {
    const wasEmpty = jsonInput.value.trim() === '';
    
    setTimeout(() => {
        if (wasEmpty) {
            jsonInput.focus();
            jsonInput.setSelectionRange(0, 0);
            jsonInput.scrollTop = 0;
            jsonInput.scrollLeft = 0;
            handleScroll();
        }
    }, 0);
});

jsonInput.addEventListener('scroll', handleScroll);
beautifyBtn.addEventListener('click', beautifyJson);
minifyBtn.addEventListener('click', minifyJson);
schemaValidatorSelect.addEventListener('change', validateAndParseJson);


treeView.addEventListener('click', (e) => {
    if (e.target.tagName === 'SUMMARY') {
        return;
    }
    
    const target = e.target.closest('[data-line]');
    if (target) {
        const lineNumber = parseInt(target.dataset.line, 10);
        highlightLine(lineNumber);
    }
});

loadFileBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        jsonInput.value = text;
        
        jsonInput.focus();
        jsonInput.setSelectionRange(0, 0);
        jsonInput.scrollTop = 0;
        jsonInput.scrollLeft = 0;

        updateLineNumbers();
        validateAndParseJson();
        handleScroll();
    };
    reader.onerror = () => {
        updateStatusBar(ValidationStatus.ERROR, `שגיאה בקריאת הקובץ: ${reader.error.message}`);
    };
    reader.readAsText(file);

    event.target.value = '';
});

errorDisplay.addEventListener('click', () => {
    if (currentErrorLineNumber === null) return;

    jsonInput.focus();

    const lines = jsonInput.value.split('\n');
    const position = lines.slice(0, currentErrorLineNumber - 1).reduce((acc, line) => acc + line.length + 1, 0);
    
    jsonInput.setSelectionRange(position, position);

    const lineHeight = parseFloat(getComputedStyle(jsonInput).lineHeight);
    const targetScroll = (currentErrorLineNumber - 1) * lineHeight;
    jsonInput.scrollTo({ top: targetScroll, behavior: 'smooth' });
});

if (resizer) {
    resizer.addEventListener('mousedown', initResize);
}

titleEl.addEventListener('click', (e) => {
    if (e.ctrlKey) {
        showEasterEgg();
    }
});

treeSearchBtn.addEventListener('click', performTreeSearch);

treeSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        performTreeSearch();
    }
});

treeSearchInput.addEventListener('input', () => {
    if (treeSearchInput.value.trim() === '') {
        clearSearchHighlights();
    }
});

// --- SCHEMA EDITOR EVENT LISTENERS ---
manageSchemasBtn.addEventListener('click', openSchemaEditor);
closeModalBtn.addEventListener('click', closeSchemaEditor);
schemaEditorModal.addEventListener('click', (e) => {
    if (e.target === schemaEditorModal) {
        closeSchemaEditor();
    }
});

createNewSchemaBtn.addEventListener('click', () => {
    clearSchemaEditorForm();
    schemaEditorFormContainer.hidden = false;
    schemaEditorFooter.hidden = false;
    schemaTitleInput.focus();
});
schemaEditSelect.addEventListener('change', loadSchemaForEditing);
saveSchemaBtn.addEventListener('click', saveSchema);
downloadSchemaBtn.addEventListener('click', downloadSchemaFile);


addSchemaFieldBtn.addEventListener('click', () => addSchemaFieldRow({}, true));

// Use event delegation for dynamic field rows
fieldsContainer.addEventListener('input', (e) => {
    clearTimeout(schemaBuilderTimeout);
    schemaBuilderTimeout = setTimeout(() => {
        buildSchemaFromUI();
        // After UI builds schema, re-highlight the current element as text has changed
        if (document.activeElement && visualBuilderContainer.contains(document.activeElement)) {
            highlightSchemaProperty(document.activeElement);
        }
    }, 300);
});

fieldsContainer.addEventListener('change', (e) => {
    if (e.target.classList.contains('field-type')) {
        const fieldRow = e.target.closest('.schema-field-row');
        if (fieldRow) {
            updateValidationVisibility(fieldRow);
        }
    }
});

fieldsContainer.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.delete-field-btn');
    if (deleteBtn) {
        const fieldRow = deleteBtn.closest('.schema-field-row');
        if (fieldRow) {
            fieldRow.remove();
            buildSchemaFromUI();
        }
    }
});

fieldsContainer.addEventListener('focusin', (e) => {
    const targetRow = e.target.closest('.schema-field-row');
    if (!targetRow) return;

    const currentFocusedRow = fieldsContainer.querySelector('.field-row-focused');
    if (currentFocusedRow && currentFocusedRow !== targetRow) {
        currentFocusedRow.classList.remove('field-row-focused');
    }
    targetRow.classList.add('field-row-focused');
});

fieldsContainer.addEventListener('focusout', (e) => {
    const targetRow = e.target.closest('.schema-field-row');
    // Remove highlight if focus moves outside of the row that is losing focus
    if (targetRow && !targetRow.contains(e.relatedTarget)) {
        targetRow.classList.remove('field-row-focused');
    }
});

schemaTitleInput.addEventListener('input', () => {
    clearTimeout(schemaBuilderTimeout);
    schemaBuilderTimeout = setTimeout(buildSchemaFromUI, 300);
});

schemaDescriptionInput.addEventListener('input', () => {
    clearTimeout(schemaBuilderTimeout);
    schemaBuilderTimeout = setTimeout(buildSchemaFromUI, 300);
});

schemaContentTextarea.addEventListener('input', updateVisualBuilderFromRaw);


// --- INITIALIZATION ---
updateLineNumbers();
validateAndParseJson();
initializeSchemaValidator();

visualBuilderContainer.addEventListener('focusin', (e) => {
    if (e.target.matches('input, select')) {
        highlightSchemaProperty(e.target);
    }
});

visualBuilderContainer.addEventListener('focusout', (e) => {
    // If the new focused element is NOT inside the visual builder or the raw editor, clear.
    if (!visualBuilderContainer.contains(e.relatedTarget) && e.relatedTarget !== schemaContentTextarea) {
        clearSchemaHighlight();
    }
});

schemaContentTextarea.addEventListener('focus', () => {
    clearSchemaHighlight();
});

const resizeObserver = new ResizeObserver(() => {
    const scrollbarHeight = jsonInput.offsetHeight - jsonInput.clientHeight;
    lineNumbers.style.paddingBottom = `calc(1rem + ${scrollbarHeight}px)`;
    handleScroll();
});

resizeObserver.observe(jsonInput);