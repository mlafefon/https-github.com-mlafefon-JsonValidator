


import * as dom from './dom.js';
import { state } from './state.js';
import * as constants from './constants.js';
import { buildTreeView, getExpansionState } from './treeView.js';

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
            const uniqueKey = `${key}${constants.UID_SEPARATOR}${uid}`;
            locationsMap.set(uniqueKey, { originalKey: key, line: getLineNumber(jsonString, offset) });
            return `"${uniqueKey}"${colonAndSpace}`;
        });

        const parsed = JSON.parse(modifiedJsonString);
        return { parsed, locationsMap };
    };
    
    return { parse };
}

const locationParser = createLocationAwareParser();

function buildPathToLineMap(parsedObjectWithUids, locationsMap) {
    const pathToLineMap = new Map();
    pathToLineMap.set('root', 1);

    function traverse(obj, currentPath) {
        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                const itemPath = `${currentPath}/${index}`;
                // Inherit parent's line number for array items
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

// --- FUNCTIONS ---

function highlightErrorLine(lineNumber) {
    if (state.currentErrorHighlight.background) {
        state.currentErrorHighlight.background.remove();
        state.currentErrorHighlight = { background: null, line: null };
    }

    if (lineNumber === null || lineNumber === undefined) {
        return;
    }

    const editorContainer = document.querySelector('.editor-container');
    const lineHeight = parseFloat(getComputedStyle(dom.jsonInput).lineHeight);
    const paddingTop = parseFloat(getComputedStyle(dom.jsonInput).paddingTop);
    
    const highlightBg = document.createElement('div');
    highlightBg.className = 'line-highlight-error';
    highlightBg.style.height = `${lineHeight}px`;
    highlightBg.style.top = `${paddingTop + (lineNumber - 1) * lineHeight - dom.jsonInput.scrollTop}px`;
    
    editorContainer.insertBefore(highlightBg, dom.jsonInput);
    state.currentErrorHighlight.background = highlightBg;
    state.currentErrorHighlight.line = lineNumber;
}

export function highlightLine(lineNumber) {
    if (state.currentHighlight.gutter) state.currentHighlight.gutter.classList.remove('line-number-highlight');
    if (state.currentHighlight.background) state.currentHighlight.background.remove();

    if (lineNumber === null || lineNumber === undefined) {
        state.currentHighlight = { gutter: null, background: null, line: null };
        return;
    }

    const editorContainer = document.querySelector('.editor-container');
    
    const gutterLine = dom.lineNumbers.querySelector(`div:nth-child(${lineNumber})`);
    if (gutterLine) {
        gutterLine.classList.add('line-number-highlight');
        state.currentHighlight.gutter = gutterLine;
    }

    const lineHeight = parseFloat(getComputedStyle(dom.jsonInput).lineHeight);
    const paddingTop = parseFloat(getComputedStyle(dom.jsonInput).paddingTop);
    
    const highlightBg = document.createElement('div');
    highlightBg.className = 'line-highlight';
    highlightBg.style.height = `${lineHeight}px`;
    highlightBg.style.top = `${paddingTop + (lineNumber - 1) * lineHeight - dom.jsonInput.scrollTop}px`;
    
    editorContainer.insertBefore(highlightBg, dom.jsonInput);
    state.currentHighlight.background = highlightBg;
    state.currentHighlight.line = lineNumber;

    const targetScroll = (lineNumber - 1) * lineHeight;
    const viewTop = dom.jsonInput.scrollTop;
    const viewBottom = viewTop + dom.jsonInput.clientHeight - lineHeight;
    if (targetScroll < viewTop || targetScroll > viewBottom) {
        dom.jsonInput.scrollTo({ top: targetScroll - (dom.jsonInput.clientHeight / 3), behavior: 'smooth' });
    }
}

export function updateLineNumbers() {
    const text = dom.jsonInput.value;
    const lineCount = text.split('\n').length;
    dom.lineNumbers.innerHTML = Array.from({ length: lineCount }, (_, i) => `<div>${i + 1}</div>`).join('');
}

export function handleScroll() {
    dom.lineNumbers.scrollTop = dom.jsonInput.scrollTop;

    const lineHeight = parseFloat(getComputedStyle(dom.jsonInput).lineHeight);
    const paddingTop = parseFloat(getComputedStyle(dom.jsonInput).paddingTop);

    const updateHighlightPosition = (highlight) => {
        if (highlight.background && highlight.line !== null) {
            highlight.background.style.top = `${paddingTop + (highlight.line - 1) * lineHeight - dom.jsonInput.scrollTop}px`;
        }
    };

    updateHighlightPosition(state.currentHighlight);
    updateHighlightPosition(state.currentErrorHighlight);
}

export function beautifyJson() {
    const text = dom.jsonInput.value;
    if (!text.trim()) return;
    const expansionState = getExpansionState();

    try {
        // First, try to parse as a single JSON object
        const parsed = JSON.parse(text);
        dom.jsonInput.value = JSON.stringify(parsed, null, 2);
        updateLineNumbers();
        validateAndParseJson({ expansionState });
        return;
    } catch (e) {
        // Not a single valid JSON, try parsing as multi-JSON
    }

    const multiJsonResult = parseMultiJson(text);
    if (multiJsonResult.success) {
        const beautifiedObjects = multiJsonResult.data.map(obj => JSON.stringify(obj, null, 2));
        dom.jsonInput.value = beautifiedObjects.join('\n\n');
        updateLineNumbers();
        validateAndParseJson({ expansionState });
    }
}

export function minifyJson() {
    const text = dom.jsonInput.value;
    if (!text.trim()) return;
    const expansionState = getExpansionState();

    try {
        // First, try to parse as a single JSON object
        const parsed = JSON.parse(text);
        dom.jsonInput.value = JSON.stringify(parsed);
        updateLineNumbers();
        validateAndParseJson({ expansionState });
        return;
    } catch (e) {
        // Not a single valid JSON, try parsing as multi-JSON
    }

    const multiJsonResult = parseMultiJson(text);
    if (multiJsonResult.success) {
        const minifiedObjects = multiJsonResult.data.map(obj => JSON.stringify(obj));
        dom.jsonInput.value = minifiedObjects.join('\n');
        updateLineNumbers();
        validateAndParseJson({ expansionState });
    }
}

export function updateStatusBar(status, message) {
    dom.statusBar.className = 'status-bar'; // Reset classes
    switch (status) {
        case constants.ValidationStatus.SUCCESS:
            dom.statusBar.classList.add('status-success');
            dom.statusIcon.innerHTML = constants.ICONS.SUCCESS;
            break;
        case constants.ValidationStatus.ERROR:
            dom.statusBar.classList.add('status-error');
            dom.statusIcon.innerHTML = constants.ICONS.ERROR;
            break;
        case constants.ValidationStatus.IDLE:
        default:
            dom.statusBar.classList.add('status-idle');
            dom.statusIcon.innerHTML = constants.ICONS.IDLE;
            break;
    }
    dom.statusMessage.textContent = message;
}

function getLineAndColumnFromPosition(text, position) {
    const textToPosition = text.substring(0, position);
    const lines = textToPosition.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    return { line, column };
}

export function validateJsonAgainstSchema(jsonData, schema, checkAdditionalProperties = false) {
    const errors = [];

    function pushError(baseMessage, path, currentSchema, type = 'invalidValue') {
        let finalMessage = baseMessage;
        if (currentSchema && currentSchema.description) {
            finalMessage += ` (תיאור: ${currentSchema.description})`;
        }
        errors.push({ message: finalMessage, path, type });
    }

    function validate(instance, schema, path) {
        if (!schema) return;

        const instanceType = Array.isArray(instance) ? 'array' : (instance === null ? 'null' : typeof instance);
        
        if (schema.type) {
            const schemaType = schema.type;
            let typeIsValid = false;
            if (schemaType === instanceType) {
                typeIsValid = true;
            } else if (schemaType === 'number' && typeof instance === 'number') {
                typeIsValid = true;
            } else if (schemaType === 'integer' && Number.isInteger(instance)) {
                typeIsValid = true;
            }
            
            if (!typeIsValid) {
                pushError(`שגיאת טיפוס בנתיב '${path}': צפוי '${schemaType}', התקבל '${instanceType}'.`, path, schema);
                return;
            }
        }
        
        // --- HANDLE CONTAINERS FIRST ---
        if (schema.type === 'object' && instanceType === 'object') {
            const keys = Object.keys(instance);
            if (schema.minProperties !== undefined && keys.length < schema.minProperties) {
                pushError(`מספר שדות נמוך מדי בנתיב '${path}': ישנם ${keys.length} שדות, אך המינימום הנדרש הוא ${schema.minProperties}.`, path, schema);
            }
            if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) {
                pushError(`מספר שדות גבוה מדי בנתיב '${path}': ישנם ${keys.length} שדות, אך המקסימום המותר הוא ${schema.maxProperties}.`, path, schema);
            }
            if (schema.required) {
                for (const key of schema.required) {
                    if (instance[key] === undefined) {
                        const propertySchema = schema.properties ? schema.properties[key] : undefined;
                        let missingFieldMessage = 'שדה חובה חסר';
                        if (propertySchema) {
                            if (propertySchema.type === 'object') {
                                missingFieldMessage = 'אובייקט חובה חסר';
                            } else if (propertySchema.type === 'array') {
                                missingFieldMessage = 'רשימת חובה חסרה';
                            }
                        }
                        pushError(`${missingFieldMessage} בנתיב '${path}': '${key}'.`, path, propertySchema, 'missingProperty');
                    }
                }
            }
            if (checkAdditionalProperties && schema.properties) {
                for (const key in instance) {
                    if (Object.prototype.hasOwnProperty.call(instance, key) && schema.properties[key] === undefined) {
                        pushError(`שדה מיותר בנתיב '${path}/${key}'`, `${path}/${key}`, null, 'additionalProperty');
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
            return;
        }

        if (schema.type === 'array' && instanceType === 'array') {
            if (schema.minItems !== undefined && instance.length < schema.minItems) {
                pushError(`מספר פריטים נמוך מדי בנתיב '${path}': ישנם ${instance.length} פריטים, אך המינימום הנדרש הוא ${schema.minItems}.`, path, schema);
            }
            if (schema.maxItems !== undefined && instance.length > schema.maxItems) {
                pushError(`מספר פריטים גבוה מדי בנתיב '${path}': ישנם ${instance.length} פריטים, אך המקסימום המותר הוא ${schema.maxItems}.`, path, schema);
            }
            if (schema.uniqueItems === true) {
                const stringifiedItems = instance.map(item => JSON.stringify(item));
                if (new Set(stringifiedItems).size !== instance.length) {
                    pushError(`פריטים לא ייחודיים בנתיב '${path}': המערך מכיל פריטים כפולים, אך נדרשת ייחודיות.`, path, schema);
                }
            }
            if (schema.items) {
                for (let i = 0; i < instance.length; i++) {
                    validate(instance[i], schema.items, `${path}/${i}`);
                }
            }
            return;
        }


        // --- HANDLE PRIMITIVES (if not a container) ---
        if (instanceType === 'string') {
            if (schema.minLength !== undefined && instance.length < schema.minLength) {
                pushError(`אורך קצר מדי בנתיב '${path}': האורך הוא ${instance.length}, אך המינימום הנדרש הוא ${schema.minLength}.`, path, schema);
            }
            if (schema.maxLength !== undefined && instance.length > schema.maxLength) {
                pushError(`אורך ארוך מדי בנתיב '${path}': האורך הוא ${instance.length}, אך המקסימום המותר הוא ${schema.maxLength}.`, path, schema);
            }
            if (schema.pattern) {
                try {
                    const regex = new RegExp(schema.pattern);
                    if (!regex.test(instance)) {
                        pushError(`ערך לא תואם לתבנית בנתיב '${path}': הערך '${instance}' אינו תואם לתבנית '${schema.pattern}'.`, path, schema);
                    }
                } catch (e) {
                    console.error(`Invalid regex pattern in schema at path '${path}': ${schema.pattern}`);
                }
            }
        }

        if (typeof instance === 'number') {
            if (schema.minimum !== undefined && instance < schema.minimum) {
                pushError(`ערך נמוך מדי בנתיב '${path}': הערך הוא ${instance}, אך המינימום המותר הוא ${schema.minimum}.`, path, schema);
            }
            if (schema.maximum !== undefined && instance > schema.maximum) {
                pushError(`ערך גבוה מדי בנתיב '${path}': הערך הוא ${instance}, אך המקסימום המותר הוא ${schema.maximum}.`, path, schema);
            }
        }

        if (schema.enum) {
            if (Array.isArray(schema.enum) && !schema.enum.includes(instance)) {
                pushError(`ערך לא חוקי בנתיב '${path}': הערך '${instance}' אינו אחד מהערכים המותרים (${schema.enum.join(', ')}).`, path, schema);
            }
        }
    }

    validate(jsonData, schema, 'root');
    return errors;
}

function displaySchemaValidationResults(errors, objectCount = 1) {
    dom.schemaFeedback.hidden = true;
    dom.schemaFeedback.className = 'feedback-display';
    dom.schemaFeedbackTitle.textContent = '';
    dom.schemaFeedbackMessageEl.innerHTML = '';
    dom.copySchemaErrorsBtn.hidden = true;
    dom.schemaFeedback.style.height = '';

    if (!errors) return;

    const validationErrors = errors.filter(e => e.type !== 'additionalProperty');
    const additionalPropWarnings = errors.filter(e => e.type === 'additionalProperty');
    
    if (validationErrors.length === 0 && additionalPropWarnings.length === 0) {
        dom.schemaFeedback.classList.add('feedback-success');
        dom.schemaFeedbackIconEl.innerHTML = constants.ICONS.SUCCESS;
        const objectStr = objectCount > 1 ? `${objectCount} האובייקטים` : 'האובייקט';
        dom.schemaFeedbackTitle.textContent = 'אימות סכמה עבר בהצלחה!';
        dom.schemaFeedbackMessageEl.textContent = `${objectStr} תואמ(ים) לסכמה שנבחרה.`;
        dom.schemaFeedback.hidden = false;
        return;
    }

    // Build title
    const titleParts = [];
    if (validationErrors.length > 0) {
        titleParts.push(`נמצאו ${validationErrors.length} שגיאות אימות`);
    }
    if (additionalPropWarnings.length > 0) {
        titleParts.push(`${additionalPropWarnings.length} שדות מיותרים`);
    }
    dom.schemaFeedbackTitle.textContent = titleParts.join(' ו-') + ':';
    
    // Set main feedback style and icon
    if (validationErrors.length > 0) {
        dom.schemaFeedback.classList.add('feedback-error');
        dom.schemaFeedbackIconEl.innerHTML = constants.ICONS.ERROR;
    } else {
        dom.schemaFeedback.classList.add('feedback-info');
        dom.schemaFeedbackIconEl.innerHTML = constants.ICONS.IDLE;
    }

    // Render validation errors
    const errorListHtml = validationErrors.slice(0, 10).map(error => {
        const line = state.pathToLineMap ? state.pathToLineMap.get(error.path) : null;
        const cssClass = line ? 'schema-error-line clickable' : 'schema-error-line';
        const typeClass = error.type ? `schema-error-type-${error.type}` : '';
        const dataAttr = line ? `data-line="${line}"` : '';
        const sanitizedMessage = error.message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<div class="${cssClass} ${typeClass}" ${dataAttr}>- ${sanitizedMessage}</div>`;
    }).join('');

    const extraErrors = validationErrors.length > 10 ? `<div class="schema-error-line">...ועוד ${validationErrors.length - 10} שגיאות.</div>` : '';
    
    // Render additional property warnings
    const warningListHtml = additionalPropWarnings.map(warning => {
        const line = state.pathToLineMap ? state.pathToLineMap.get(warning.path) : null;
        const cssClass = line ? 'schema-error-line clickable' : 'schema-error-line';
        const typeClass = 'schema-error-type-additionalProperty';
        const dataAttr = line ? `data-line="${line}"` : '';
        const formattedPath = warning.path.replace(/\//g, ':');
        const message = `שדה מיותר בנתיב: ${formattedPath}`;
        return `<div class="${cssClass} ${typeClass}" ${dataAttr}>- ${message}</div>`;
    }).join('');

    dom.schemaFeedbackMessageEl.innerHTML = `${errorListHtml}${extraErrors}${warningListHtml}`;
    dom.copySchemaErrorsBtn.hidden = validationErrors.length === 0;
    dom.schemaFeedback.hidden = false;
}

/**
 * Parses a string that may contain multiple concatenated JSON objects or arrays.
 * Handles both minified (JSON Lines) and pretty-printed formats.
 * @param {string} text The input string to parse.
 * @returns {{success: boolean, data?: any[], lineMap?: number[]}}
 */
function parseMultiJson(text) {
    const objects = [];
    const lineMap = [];
    let remainingText = text;
    let totalConsumedLength = 0;

    while (remainingText.trim().length > 0) {
        const preTrimLength = remainingText.length;
        remainingText = remainingText.trimStart();
        const trimLength = preTrimLength - remainingText.length;
        totalConsumedLength += trimLength;
        
        if (remainingText.length === 0) break;

        const firstChar = remainingText[0];
        if (firstChar !== '{' && firstChar !== '[') {
            return { success: false }; // Invalid start or trailing chars
        }
        
        const stack = [];
        let inString = false;
        let isEscaped = false;
        let endIndex = -1;
        let started = false;

        for (let i = 0; i < remainingText.length; i++) {
            const char = remainingText[i];
            
            if (isEscaped) {
                isEscaped = false;
                continue;
            }
            if (char === '\\') {
                isEscaped = true;
                continue;
            }
            if (char === '"') {
                inString = !inString;
            }

            if (inString) continue;

            if (char === '{' || char === '[') {
                stack.push(char);
                started = true;
            } else if (char === '}') {
                if (stack.length === 0 || stack[stack.length - 1] !== '{') return { success: false }; // Mismatched
                stack.pop();
            } else if (char === ']') {
                if (stack.length === 0 || stack[stack.length - 1] !== '[') return { success: false }; // Mismatched
                stack.pop();
            }

            if (started && stack.length === 0) {
                endIndex = i;
                break;
            }
        }

        if (endIndex === -1) {
            return { success: false }; // Unclosed object
        }

        const jsonCandidate = remainingText.substring(0, endIndex + 1);
        try {
            const originalTextBeforeThisObject = text.substring(0, totalConsumedLength);
            const startLineOfThisObject = originalTextBeforeThisObject.split('\n').length;
            lineMap.push(startLineOfThisObject);

            objects.push(JSON.parse(jsonCandidate));
            
            totalConsumedLength += jsonCandidate.length;
            remainingText = remainingText.substring(jsonCandidate.length);
        } catch (e) {
            return { success: false }; // A segment is not valid JSON
        }
    }
    
    // Succeed if we found at least one object and consumed the whole string
    if (objects.length > 0 && remainingText.trim().length === 0) { 
        // If only one object was found, it should be handled by the single JSON parser.
        // This function is for multi-json, so we can return true for 1 or more.
        return { success: true, data: objects, lineMap };
    }
    
    return { success: false };
}


export function validateAndParseJson(options = {}) {
    const { expansionState } = options;
    const text = dom.jsonInput.value;
    
    dom.errorDisplay.hidden = true;
    dom.errorDisplay.classList.remove('clickable');
    state.currentErrorLineNumber = null;
    state.pathToLineMap = null;
    dom.schemaFeedback.hidden = true;
    highlightLine(null);
    highlightErrorLine(null);

    const previousErrorLine = dom.lineNumbers.querySelector('.line-number-error');
    if (previousErrorLine) {
        previousErrorLine.classList.remove('line-number-error');
    }

    if (!text.trim()) {
        updateStatusBar(constants.ValidationStatus.IDLE, 'הדבק את ה-JSON שלך ובדוק את תקינותו, או נסה פורמט JSON Lines.');
        buildTreeView(undefined);
        dom.beautifyBtn.disabled = true;
        dom.minifyBtn.disabled = true;
        return;
    }

    dom.beautifyBtn.disabled = false;
    dom.minifyBtn.disabled = false;
    
    const selectedSchemaKey = dom.schemaValidatorSelect.value;
    const runValidation = (parsedData) => {
        if (!selectedSchemaKey || !state.schemaData) {
            displaySchemaValidationResults(null);
            return;
        }
        const schema = state.schemaData[selectedSchemaKey];
        if (!schema) return;

        const checkAdditional = dom.additionalPropsToggle.checked;
        const dataToValidate = Array.isArray(parsedData) ? parsedData : [parsedData];
        let allErrors = [];
        
        for (let i = 0; i < dataToValidate.length; i++) {
            const item = dataToValidate[i];
            const errors = validateJsonAgainstSchema(item, schema, checkAdditional);
            if (errors.length > 0) {
                if (dataToValidate.length > 1) {
                    allErrors.push(...errors.map(e => ({...e, message: `[אובייקט ${i + 1}] ${e.message}`})));
                } else {
                    allErrors.push(...errors);
                }
            }
        }
        displaySchemaValidationResults(allErrors, dataToValidate.length);
    };

    try {
        const { parsed, locationsMap } = locationParser.parse(text);
        state.pathToLineMap = buildPathToLineMap(parsed, locationsMap);
        const plainParsed = JSON.parse(text);

        const multiJsonCheck = parseMultiJson(text);
        if (multiJsonCheck.success && multiJsonCheck.data.length > 1) {
             // It's technically valid single JSON (e.g. `[1][2]`), but it's really multi-json.
             // Prioritize multi-json handling.
             throw new Error("Ambiguous single/multi JSON, treating as multi-JSON.");
        }

        updateStatusBar(constants.ValidationStatus.SUCCESS, 'JSON תקין!');
        buildTreeView(parsed, { locationsMap, expansionState });
        runValidation(plainParsed);
        return;
    } catch (e) {
        // Not a valid single JSON, try multi-JSON/JSON lines
    }

    const multiJsonResult = parseMultiJson(text);
    if (multiJsonResult.success) {
        state.pathToLineMap = new Map();
        updateStatusBar(constants.ValidationStatus.SUCCESS, 'זוהה פורמט JSON Lines / Multi-JSON. כל האובייקטים תקינים!');
        buildTreeView(multiJsonResult.data, { lineMap: multiJsonResult.lineMap, expansionState });
        runValidation(multiJsonResult.data);
        return;
    }

    try {
      JSON.parse(text);
    } catch(e) {
        updateStatusBar(constants.ValidationStatus.ERROR, 'JSON לא תקין. תקן את השגיאה שמוצגת למעלה.');
        
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

            state.currentErrorLineNumber = errorLineToHighlight;
            dom.errorDisplay.classList.add('clickable');
            detailedMessage = finalMessage;

            const errorLineDiv = dom.lineNumbers.querySelector(`div:nth-child(${errorLineToHighlight})`);
            if (errorLineDiv) {
                errorLineDiv.classList.add('line-number-error');
            }
            highlightErrorLine(errorLineToHighlight);

        } else {
             state.currentErrorLineNumber = null;
             dom.errorDisplay.classList.remove('clickable');
        }
        
        dom.errorIconEl.innerHTML = constants.ICONS.ERROR;
        dom.errorMessageEl.textContent = detailedMessage;
        dom.errorDisplay.hidden = false;
    }
    buildTreeView(null);
}