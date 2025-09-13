// --- DOM ELEMENTS ---
export const jsonInput = document.getElementById('json-input');
export const lineNumbers = document.getElementById('line-numbers');
export const beautifyBtn = document.getElementById('beautify-btn');
export const minifyBtn = document.getElementById('minify-btn');
export const treeView = document.getElementById('tree-view');
export const statusBar = document.getElementById('status-bar');
export const statusIcon = document.getElementById('status-icon');
export const statusMessage = document.getElementById('status-message');
export const appVersion = document.getElementById('app-version');
export const errorDisplay = document.getElementById('error-display');
export const errorIconEl = document.getElementById('error-icon');
export const errorMessageEl = document.getElementById('error-message');
export const schemaFeedback = document.getElementById('schema-feedback');
export const schemaFeedbackIconEl = document.getElementById('schema-feedback-icon');
export const schemaFeedbackTitle = document.getElementById('schema-feedback-title');
export const schemaFeedbackMessageEl = document.getElementById('schema-feedback-message');
export const copySchemaErrorsBtn = document.getElementById('copy-schema-errors-btn');
export const schemaFeedbackResizer = document.getElementById('schema-feedback-resizer');
export const resizer = document.getElementById('resizer');
export const mainContent = document.querySelector('.main-content');
export const editorPane = document.querySelector('.editor-pane');
export const treePane = document.querySelector('.tree-pane');
export const titleEl = document.querySelector('.title');
export const treeSearchInput = document.getElementById('tree-search-input');
export const treeSearchBtn = document.getElementById('tree-search-btn');
export const toggleTreeBtn = document.getElementById('toggle-tree-btn');
export const expandAllIcon = document.getElementById('expand-all-icon');
export const collapseAllIcon = document.getElementById('collapse-all-icon');
export const treePathDisplay = document.getElementById('tree-path-display');
export const loadFileBtn = document.getElementById('load-file-btn');
export const fileInput = document.getElementById('file-input');
export const manageSchemasBtn = document.getElementById('manage-schemas-btn');
export const schemaEditorModal = document.getElementById('schema-editor-modal');
export const closeModalBtn = document.getElementById('close-modal-btn');
export const createNewSchemaBtn = document.getElementById('create-new-schema-btn');
export const schemaTitleInput = document.getElementById('schema-title-input');
export const schemaDescriptionInput = document.getElementById('schema-description-input');
export const schemaContentTextarea = document.getElementById('schema-content-textarea');
export const schemaEditorFeedback = document.getElementById('schema-editor-feedback');
export const schemaEditorFeedbackIcon = document.getElementById('schema-editor-feedback-icon');
export const schemaEditorFeedbackMessage = document.getElementById('schema-editor-feedback-message');
export const downloadSchemaBtn = document.getElementById('download-schema-btn');
export const saveSchemaBtn = document.getElementById('save-schema-btn');
export const uploadSchemaBtn = document.getElementById('upload-schema-btn');
export const schemaFileInput = document.getElementById('schema-file-input');
export const schemaEditorFormContainer = document.getElementById('schema-editor-form-container');
export const schemaEditorFooter = document.getElementById('schema-editor-footer');
export const schemaEditorResizer = document.getElementById('schema-editor-resizer');
export const schemaFieldSearchInput = document.getElementById('schema-field-search-input');
export const schemaFieldSearchBtn = document.getElementById('schema-field-search-btn');
export const additionalPropsToggle = document.getElementById('additional-props-toggle');
export const deleteSchemaBtn = document.getElementById('delete-schema-btn');

// --- CUSTOM SCHEMA DROPDOWNS ---
export const schemaValidatorDropdown = document.getElementById('schema-validator-dropdown');
export const schemaValidatorSelectBtn = document.getElementById('schema-validator-select-btn');
export const schemaValidatorOptions = document.getElementById('schema-validator-options');
export const schemaEditDropdown = document.getElementById('schema-edit-dropdown');
export const schemaEditSelectBtn = document.getElementById('schema-edit-select-btn');
export const schemaEditOptions = document.getElementById('schema-edit-options');

// --- SCHEMA EDITOR TABS ---
export const schemaContentTab = document.getElementById('schema-content-tab');
export const exampleJsonTab = document.getElementById('example-json-tab');
export const schemaContentPane = document.getElementById('schema-content-pane');
export const exampleJsonPane = document.getElementById('example-json-pane');
export const schemaContentLineNumbers = document.getElementById('schema-content-line-numbers');
export const exampleJsonLineNumbers = document.getElementById('example-json-line-numbers');
export const exampleJsonTextarea = document.getElementById('example-json-textarea');
export const exampleJsonFeedback = document.getElementById('example-json-feedback');
export const exampleJsonFeedbackIcon = document.getElementById('example-json-feedback-icon');
export const exampleJsonFeedbackMessage = document.getElementById('example-json-feedback-message');
export const uploadExampleJsonBtn = document.getElementById('upload-example-json-btn');
export const generateExampleJsonBtn = document.getElementById('generate-example-json-btn');
export const exampleJsonFileInput = document.getElementById('example-json-file-input');

// --- SCHEMA BUILDER UI ELEMENTS ---
export const visualBuilderContainer = document.getElementById('schema-visual-builder-container');
export const fieldsContainer = document.getElementById('schema-fields-container');
export const addSchemaFieldBtn = document.getElementById('add-schema-field-btn');
export const fieldTemplate = document.getElementById('schema-field-template');
export const schemaComplexityWarning = document.getElementById('schema-complexity-warning');
export const schemaComplexityWarningIcon = document.getElementById('schema-complexity-warning-icon');
export const schemaComplexityWarningMessage = document.getElementById('schema-complexity-warning-message');

// --- ADD FIELD MODAL ELEMENTS ---
export const addFieldModal = document.getElementById('add-field-modal');
export const addFieldForm = document.getElementById('add-field-form');
export const closeAddFieldModalBtn = document.getElementById('close-add-field-modal-btn');
export const cancelAddFieldBtn = document.getElementById('cancel-add-field-btn');
export const newFieldNameInput = document.getElementById('new-field-name');
export const newFieldDescriptionInput = document.getElementById('new-field-description');
export const newFieldRequiredCheckbox = document.getElementById('new-field-required');

// --- CONFIRM CLOSE MODAL ---
export const confirmCloseModal = document.getElementById('confirm-close-modal');
export const confirmSaveCloseBtn = document.getElementById('confirm-save-close-btn');
export const confirmDiscardBtn = document.getElementById('confirm-discard-btn');
export const confirmCloseXBtn = document.getElementById('confirm-close-x-btn');

// --- CONFIRM DELETE SCHEMA MODAL ---
export const confirmDeleteSchemaModal = document.getElementById('confirm-delete-schema-modal');
export const confirmDeleteSchemaCancelBtn = document.getElementById('confirm-delete-schema-cancel-btn');
export const confirmDeleteSchemaConfirmBtn = document.getElementById('confirm-delete-schema-confirm-btn');
export const schemaToDeleteName = document.getElementById('schema-to-delete-name');