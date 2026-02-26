const normalizeLabel = (component) => {
    if (component.label) return component.label;
    if (component.key) return component.key;
    if (component.type) return component.type;
    return "Component";
};

const collectChildSets = (component, nodePath, errors) => {
    const sets = [];

    if (Object.prototype.hasOwnProperty.call(component, "components")) {
        if (Array.isArray(component.components)) {
            sets.push({
                label: "components",
                components: component.components,
            });
        } else if (component.components !== undefined) {
            errors.push({
                path: `${nodePath}.components`,
                message: "Expected components to be an array.",
            });
        }
    }

    if (Object.prototype.hasOwnProperty.call(component, "columns")) {
        if (Array.isArray(component.columns)) {
            component.columns.forEach((column, index) => {
                if (Array.isArray(column?.components)) {
                    sets.push({
                        label: `columns[${index}]`,
                        components: column.components,
                    });
                } else if (column?.components !== undefined) {
                    errors.push({
                        path: `${nodePath}.columns[${index}].components`,
                        message: "Expected column components to be an array.",
                    });
                }
            });
        } else if (component.columns !== undefined) {
            errors.push({
                path: `${nodePath}.columns`,
                message: "Expected columns to be an array.",
            });
        }
    }

    if (Object.prototype.hasOwnProperty.call(component, "rows")) {
        if (Array.isArray(component.rows)) {
            component.rows.forEach((row, rowIndex) => {
                if (Array.isArray(row)) {
                    row.forEach((column, columnIndex) => {
                        if (Array.isArray(column?.components)) {
                            sets.push({
                                label: `rows[${rowIndex}][${columnIndex}]`,
                                components: column.components,
                            });
                        } else if (column?.components !== undefined) {
                            errors.push({
                                path: `${nodePath}.rows[${rowIndex}][${columnIndex}].components`,
                                message:
                                    "Expected row column components to be an array.",
                            });
                        }
                    });
                } else if (row !== undefined) {
                    errors.push({
                        path: `${nodePath}.rows[${rowIndex}]`,
                        message: "Expected rows to contain column arrays.",
                    });
                }
            });
        } else if (component.rows !== undefined) {
            errors.push({
                path: `${nodePath}.rows`,
                message: "Expected rows to be an array.",
            });
        }
    }

    if (Object.prototype.hasOwnProperty.call(component, "tabs")) {
        if (Array.isArray(component.tabs)) {
            component.tabs.forEach((tab, index) => {
                if (Array.isArray(tab?.components)) {
                    sets.push({
                        label: `tabs[${index}]`,
                        components: tab.components,
                    });
                } else if (tab?.components !== undefined) {
                    errors.push({
                        path: `${nodePath}.tabs[${index}].components`,
                        message: "Expected tab components to be an array.",
                    });
                }
            });
        } else if (component.tabs !== undefined) {
            errors.push({
                path: `${nodePath}.tabs`,
                message: "Expected tabs to be an array.",
            });
        }
    }

    return sets;
};

const buildTree = (components, basePath, errors) => {
    let count = 0;
    const nodes = components.map((component, index) => {
        const nodePath = `${basePath}[${index}]`;
        count += 1;

        if (!component?.type) {
            errors.push({ path: nodePath, message: "Missing component type." });
        }
        if (component?.input && !component?.key) {
            errors.push({
                path: nodePath,
                message: "Input component is missing a key.",
            });
        }
        if (!component?.label && !component?.key) {
            errors.push({
                path: nodePath,
                message: "Component needs a label or key for clarity.",
            });
        }

        const childSets = collectChildSets(component ?? {}, nodePath, errors);
        const childNodes = [];
        childSets.forEach((set) => {
            const childResult = buildTree(
                set.components,
                `${nodePath}.${set.label}`,
                errors,
            );
            count += childResult.count;
            childNodes.push(...childResult.nodes);
        });

        return {
            id: nodePath,
            label: normalizeLabel(component ?? {}),
            type: component?.type ?? "unknown",
            key: component?.key ?? "",
            children: childNodes,
        };
    });

    return { nodes, count };
};

export const analyzeDefinition = (raw) => {
    const errors = [];

    if (!raw.trim()) {
        return {
            errors: [
                {
                    path: "root",
                    message: "Paste a form definition to analyze.",
                },
            ],
            tree: [],
            stats: null,
        };
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        return {
            errors: [
                { path: "root", message: `Invalid JSON: ${error.message}` },
            ],
            tree: [],
            stats: null,
        };
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {
            errors: [
                { path: "root", message: "Form definition must be an object." },
            ],
            tree: [],
            stats: null,
        };
    }

    if (!Array.isArray(parsed.components)) {
        errors.push({
            path: "components",
            message: "Form definition must include a components array.",
        });
    }

    const components = Array.isArray(parsed.components)
        ? parsed.components
        : [];
    const treeResult = buildTree(components, "components", errors);

    if (components.length === 0) {
        errors.push({
            path: "components",
            message: "No components found in the form definition.",
        });
    }

    return {
        errors,
        tree: treeResult.nodes,
        stats: {
            total: treeResult.count,
            display: parsed.display || "unknown",
        },
    };
};
