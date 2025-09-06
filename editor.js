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
    try {
        const expansionState = getExpansionState();
        const parsed = JSON.parse(text);
        dom.jsonInput.value = JSON.stringify(parsed, null, 2);
        updateLineNumbers();
        validateAndParseJson({ expansionState });
    } catch (e) {
        // Can't beautify invalid JSON, do nothing.
    }
}

export function minifyJson() {
    const text = dom.jsonInput.value;
    if (!text.trim()) return;
    try {
        const expansionState = getExpansionState();
        const parsed = JSON.parse(text);
        dom.jsonInput.value = JSON.stringify(parsed);
        updateLineNumbers();
        validateAndParseJson({ expansionState });
    } catch (e) {
        // Can't minify invalid JSON, do nothing.
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
                pushError(`שגיאת טיפוס בנתיב '${path}': צפוי '${schemaType}', התקבל '${instanceType}'.`, schema);
                return;
            }
        }
        
        if (instanceType === 'string') {
            if (schema.minLength !== undefined && instance.length < schema.minLength) {
                pushError(`אורך קצר מדי בנתיב '${path}': האורך הוא ${instance.length}, אך המינימוм הנדרש הוא ${schema.minLength}.`, schema);
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
    dom.schemaFeedback.hidden = true;
    dom.schemaFeedback.className = 'feedback-display';

    if (!errors) return;

    if (errors.length === 0) {
        dom.schemaFeedback.classList.add('feedback-success');
        dom.schemaFeedbackIconEl.innerHTML = constants.ICONS.SUCCESS;
        const objectStr = objectCount > 1 ? `${objectCount} האובייקטים` : 'האובייקט';
        dom.schemaFeedbackMessageEl.textContent = `אימות סכמה עבר בהצלחה! ${objectStr} תואמ(ים) לסכמה שנבחרה.`;
        dom.schemaFeedback.hidden = false;
    } else {
        dom.schemaFeedback.classList.add('feedback-error');
        dom.schemaFeedbackIconEl.innerHTML = constants.ICONS.ERROR;
        const errorHeader = `נמצאו ${errors.length} שגיאות אימות סכמה:`;
        const errorList = errors.slice(0, 10).map(e => `- ${e}`).join('\n');
        const extraErrors = errors.length > 10 ? `\n...ועוד ${errors.length - 10} שגיאות.` : '';
        dom.schemaFeedbackMessageEl.textContent = `${errorHeader}\n${errorList}${extraErrors}`;
        dom.schemaFeedback.hidden = false;
    }
}

export function validateAndParseJson(options = {}) {
    const { expansionState } = options;
    const text = dom.jsonInput.value;
    
    dom.errorDisplay.hidden = true;
    dom.errorDisplay.classList.remove('clickable');
    state.currentErrorLineNumber = null;
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
        updateStatusBar(constants.ValidationStatus.SUCCESS, 'JSON תקין!');
        buildTreeView(parsed, { locationsMap, expansionState });
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
            updateStatusBar(constants.ValidationStatus.SUCCESS, 'זוהה פורמט JSON Lines. כל השורות תקינות!');
            buildTreeView(parsedLines, { lineMap, expansionState });
            runValidation(parsedLines);
            return;
        }
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
