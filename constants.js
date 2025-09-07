// --- CONSTANTS ---
export const ValidationStatus = {
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  IDLE: 'IDLE',
};

export const ICONS = {
    SUCCESS: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:1.5rem; height:1.5rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`,
    ERROR: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:1.5rem; height:1.5rem;"><path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`,
    IDLE: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:1.5rem; height:1.5rem;"><path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>`,
};

export const UID_SEPARATOR = '__JSON_LOC_UID__';
export const LS_SCHEMA_KEY = 'userSchemas_v2';

export const VALIDATION_DESCRIPTIONS = {
    // Common
    enum: {
        placeholder: 'ערכים מותרים (מופרדים בפסיק)',
        title: {
            string: '\u202Bרשימת ערכי טקסט מותרים, מופרדים בפסיקים. לדוגמה: red, green, blue',
            number: '\u202Bרשימת ערכים מספריים מותרים, מופרדים בפסיקים. לדוגמה: 1, 2, 3, 10.5'
        }
    },
    // Number / Integer
    minimum: {
        placeholder: 'ערך מינימלי (כולל)',
        title: '\u202Bהערך המינימלי המותר (כולל את הערך עצמו). לדוגמה: 0.'
    },
    maximum: {
        placeholder: 'ערך מקסימלי (כולל)',
        title: '\u202Bהערך המקסימלי המותר (כולל את הערך עצמו). לדוגמה: 100.'
    },
    exclusiveMinimum: {
        placeholder: 'ערך מינימלי (לא כולל)',
        title: '\u202Bהערך המינימלי המותר, אך לא כולל את הערך עצמו. אם הערך הוא 0, המספר הקטן ביותר שיתקבל גדול מ-0.'
    },
    exclusiveMaximum: {
        placeholder: 'ערך מקסימלי (לא כולל)',
        title: '\u202Bהערך המקסימלי המותר, אך לא כולל את הערך עצמו. אם הערך הוא 100, המספר הגדול ביותר שיתקבל קטן מ-100.'
    },
    multipleOf: {
        placeholder: 'כפולה של',
        title: '\u202Bהערך חייב להיות כפולה של מספר זה. לדוגמה: עבור כפולה של 2, הערכים 2, 4, 6 תקינים, אך 3 לא.'
    },
    // String
    minLength: {
        placeholder: 'אורך מינימלי',
        title: '\u202Bמספר התווים המינימלי. לדוגמה: 2.'
    },
    maxLength: {
        placeholder: 'אורך מקסימלי',
        title: '\u202Bמספר התווים המקסימלי. לדוגמה: 50.'
    },
    pattern: {
        placeholder: 'תבנית (Regex)',
        title: '\u202Bביטוי רגולרי (Regular Expression) שהערך חייב להתאים לו.'
    },
    // Array
    minItems: {
        placeholder: 'מספר פריטים מינימלי',
        title: '\u202Bהמספר המינימלי של פריטים במערך. לדוגמה: 1.'
    },
    maxItems: {
        placeholder: 'מספר פריטים מקסימלי',
        title: '\u202Bהמספר המקסימלי של פריטים במערך. לדוגמה: 10.'
    },
    uniqueItems: {
        label: 'פריטים ייחודיים בלבד',
        title: '\u202Bאם מסומן, כל הפריטים במערך חייבים להיות ייחודיים זה מזה.'
    }
};