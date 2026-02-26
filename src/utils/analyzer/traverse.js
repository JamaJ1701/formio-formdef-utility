export const traverseComponents = (components, basePath, visit) => {
    if (!Array.isArray(components)) {
        return;
    }

    components.forEach((component, index) => {
        if (!component || typeof component !== "object") {
            return;
        }

        const componentPath = `${basePath}[${index}]`;
        visit(component, componentPath);

        if (Array.isArray(component.components)) {
            traverseComponents(
                component.components,
                `${componentPath}.components`,
                visit,
            );
        }

        if (Array.isArray(component.columns)) {
            component.columns.forEach((column, columnIndex) => {
                if (Array.isArray(column?.components)) {
                    traverseComponents(
                        column.components,
                        `${componentPath}.columns[${columnIndex}].components`,
                        visit,
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
