const SCOPED_CONTAINER_TYPES = new Set([
    "datagrid",
    "container",
    "editgrid",
    "address",
    "dynamicWizard",
    "datatable",
    "tagpad",
]);

const NON_SCOPING_LAYOUT_TYPES = new Set([
    "panel",
    "table",
    "well",
    "columns",
    "fieldset",
    "tabs",
    "form",
]);

const buildDataPathForComponent = (component, parentDataPath) => {
    const key = typeof component?.key === "string" ? component.key : "";

    if (!key) {
        return "";
    }

    return parentDataPath ? `${parentDataPath}.${key}` : key;
};

const buildChildDataPath = (component, parentDataPath, componentDataPath) => {
    const hasKey =
        typeof component?.key === "string" && component.key.length > 0;

    if (!hasKey) {
        return parentDataPath;
    }

    if (component.type === "form") {
        return `${componentDataPath}.data`;
    }

    if (
        !NON_SCOPING_LAYOUT_TYPES.has(component.type) &&
        (SCOPED_CONTAINER_TYPES.has(component.type) || component.tree)
    ) {
        return componentDataPath;
    }

    return parentDataPath;
};

export const traverseComponents = (
    components,
    basePath,
    visit,
    parentDataPath = "",
) => {
    if (!Array.isArray(components)) {
        return;
    }

    components.forEach((component, index) => {
        if (!component || typeof component !== "object") {
            return;
        }

        const componentPath = `${basePath}[${index}]`;
        const componentDataPath = buildDataPathForComponent(
            component,
            parentDataPath,
        );

        visit(component, componentPath, {
            schemaPath: componentPath,
            dataPath: componentDataPath,
            parentDataPath,
        });

        const childDataPath = buildChildDataPath(
            component,
            parentDataPath,
            componentDataPath,
        );

        if (Array.isArray(component.components)) {
            traverseComponents(
                component.components,
                `${componentPath}.components`,
                visit,
                childDataPath,
            );
        }

        if (Array.isArray(component.columns)) {
            component.columns.forEach((column, columnIndex) => {
                if (Array.isArray(column?.components)) {
                    traverseComponents(
                        column.components,
                        `${componentPath}.columns[${columnIndex}].components`,
                        visit,
                        childDataPath,
                    );
                }
            });
        }

        if (Array.isArray(component.rows)) {
            component.rows.forEach((row, rowIndex) => {
                if (!Array.isArray(row)) {
                    return;
                }

                row.forEach((column, columnIndex) => {
                    if (Array.isArray(column?.components)) {
                        traverseComponents(
                            column.components,
                            `${componentPath}.rows[${rowIndex}][${columnIndex}].components`,
                            visit,
                            childDataPath,
                        );
                    }
                });
            });
        }

        if (Array.isArray(component.tabs)) {
            component.tabs.forEach((tab, tabIndex) => {
                if (Array.isArray(tab?.components)) {
                    traverseComponents(
                        component.tabs[tabIndex].components,
                        `${componentPath}.tabs[${tabIndex}].components`,
                        visit,
                        childDataPath,
                    );
                }
            });
        }
    });
};

export const indexComponentsByPath = (components) => {
    const indexed = {};

    traverseComponents(components, "components", (component, path) => {
        indexed[path] = component;
    });

    return indexed;
};

export const indexComponentMetadataByPath = (components) => {
    const indexed = {};

    traverseComponents(
        components,
        "components",
        (component, path, metadata) => {
            indexed[path] = {
                component,
                schemaPath: metadata.schemaPath,
                dataPath: metadata.dataPath,
                parentDataPath: metadata.parentDataPath,
            };
        },
    );

    return indexed;
};
