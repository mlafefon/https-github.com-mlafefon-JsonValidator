


import * as dom from './dom.js';
import { highlightLine } from './editor.js';
import * as constants from './constants.js';

export function getExpansionState() {
    const openPaths = new Set();
    dom.treeView.querySelectorAll('details[open]').forEach(el => {
        if (el.dataset.path && el.dataset.path !== '[]') {
            openPaths.add(el.dataset.path);
        }
    });
    return openPaths;
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
        if (typeof key === 'string' && key.includes(constants.UID_SEPARATOR)) {
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
        const pathString = JSON.stringify(path);
        details.dataset.path = pathString;
        
        if (isRoot) {
             details.open = true;
             details.dataset.isRoot = 'true';
        }
        
        if (context.expansionState && context.expansionState.has(pathString)) {
            details.open = true;
        }

        const summary = document.createElement('summary');
        
        const toggleIcon = document.createElement('span');
        toggleIcon.className = 'tree-toggle-icon';
        toggleIcon.setAttribute('aria-hidden', 'true');
        summary.appendChild(toggleIcon);

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
        updateSummary();
        
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

export function toggleAllTreeNodes() {
    if (!dom.toggleTreeBtn) return;
    const isCurrentlyCollapsed = dom.toggleTreeBtn.dataset.state === 'collapsed';
    const detailsElements = dom.treeView.querySelectorAll('details');

    if (detailsElements.length === 0) return;

    detailsElements.forEach(detail => {
        if (detail.dataset.isRoot) {
            detail.open = true;
        } else {
            detail.open = isCurrentlyCollapsed;
        }
    });

    if (isCurrentlyCollapsed) {
        dom.toggleTreeBtn.dataset.state = 'expanded';
        dom.expandAllIcon.style.display = 'none';
        dom.collapseAllIcon.style.display = 'block';
    } else {
        dom.toggleTreeBtn.dataset.state = 'collapsed';
        dom.expandAllIcon.style.display = 'block';
        dom.collapseAllIcon.style.display = 'none';
    }
}

export function buildTreeView(data, context = {}) {
    dom.treeView.innerHTML = '';
    if (dom.treeSearchInput) dom.treeSearchInput.value = '';
    highlightLine(null);

    if (dom.toggleTreeBtn) {
        dom.toggleTreeBtn.dataset.state = 'collapsed';
        dom.expandAllIcon.style.display = 'block';
        dom.collapseAllIcon.style.display = 'none';
        dom.toggleTreeBtn.disabled = data === null || data === undefined;
    }

    if (data === null || data === undefined) {
        dom.treeView.innerHTML = '<p class="tree-placeholder">הצג תצוגת עץ כאן כאשר ה-JSON תקין.</p>';
        return;
    }
    const rootNode = createJsonNode(Array.isArray(data) ? 'Array' : 'Object', data, true, { ...context, isParentArray: false }, []);
    dom.treeView.appendChild(rootNode);
}

export function clearSearchHighlights() {
    const highlighted = dom.treeView.querySelectorAll('.search-highlight');
    highlighted.forEach(el => el.classList.remove('search-highlight'));
}

export function performTreeSearch() {
    clearSearchHighlights();
    const searchTerm = dom.treeSearchInput.value.trim().toLowerCase();
    if (!searchTerm) return;
    const revealNode = (node) => {
        let parent = node.closest('details');
        while(parent) {
            parent.open = true;
            parent = parent.parentElement.closest('details');
        }
    };
    const leaves = dom.treeView.querySelectorAll('.tree-leaf');
    leaves.forEach(leaf => {
        const key = leaf.querySelector('.tree-key')?.textContent.toLowerCase() || '';
        const value = leaf.querySelector('.tree-value')?.textContent.toLowerCase() || '';
        if (key.includes(searchTerm) || value.includes(searchTerm)) {
            leaf.classList.add('search-highlight');
            revealNode(leaf);
        }
    });
    const summaries = dom.treeView.querySelectorAll('details > summary');
    summaries.forEach(summary => {
        const key = summary.querySelector('.tree-key')?.textContent.toLowerCase() || '';
        if (key.includes(searchTerm)) {
            summary.classList.add('search-highlight');
            revealNode(summary);
        }
    });
}