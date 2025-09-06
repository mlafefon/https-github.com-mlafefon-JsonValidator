export const state = {
    validationTimeout: undefined,
    schemaBuilderTimeout: undefined,
    currentHighlight: { gutter: null, background: null, line: null },
    currentErrorHighlight: { background: null, line: null },
    schemaData: null,
    currentErrorLineNumber: null,
    isEditingExistingSchema: false,
    nextFieldId: 0,
    currentEditingSchemaKey: null,
    initialSchemaStateOnLoad: '',
    currentParentForNewField: null,
};
