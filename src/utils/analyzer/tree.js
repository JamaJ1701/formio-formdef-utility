import { normalizeLabel } from "./normalizeLabel";

const collectChildren = (component, basePath) => {
    const children = [];

    if (Array.isArray(component?.components)) {
        children.push(
            ...buildTreeFromSchema(
                component.components,
                `${basePath}.components`,
            ),
        );
    }

    if (Array.isArray(component?.columns)) {
        component.columns.forEach((column, columnIndex) => {
            if (Array.isArray(column?.components)) {
                children.push(
                    ...buildTreeFromSchema(
                        column.components,
                        `${basePath}.columns[${columnIndex}].components`,
                    ),
                );
            }
        });
    }

    if (Array.isArray(component?.rows)) {
        component.rows.forEach((row, rowIndex) => {
            if (!Array.isArray(row)) {
                return;
            }

            row.forEach((column, columnIndex) => {
                if (Array.isArray(column?.components)) {
                    children.push(
                        ...buildTreeFromSchema(
                            column.components,
                            `${basePath}.rows[${rowIndex}][${columnIndex}].components`,
                        ),
                    );
                }
            });
        });
    }

    if (Array.isArray(component?.tabs)) {
        component.tabs.forEach((tab, tabIndex) => {
            if (Array.isArray(tab?.components)) {
                children.push(
                    ...buildTreeFromSchema(
                        tab.components,
                        `${basePath}.tabs[${tabIndex}].components`,
                    ),
                );
            }
        });
    }

    return children;
};

export const buildTreeFromSchema = (components, basePath = "components") => {
    if (!Array.isArray(components)) {
        return [];
    }

    return components
        .filter((component) => component && typeof component === "object")
        .map((component, index) => {
            const path = `${basePath}[${index}]`;

            return {
                id: path,
                label: normalizeLabel(component),
                type: component?.type ?? "unknown",
                key: component?.key ?? "",
                path,
                children: collectChildren(component, path),
            };
        });
};
