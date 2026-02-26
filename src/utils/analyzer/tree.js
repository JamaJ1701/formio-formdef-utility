import { normalizeLabel } from "./normalizeLabel";

const hasCustomConditional = (component) => {
    const custom = component?.conditional?.custom;
    return typeof custom === "string" && custom.trim().length > 0;
};

const extractConditionalLogicTypes = (component) => {
    const logicTypes = [];

    if (hasCustomConditional(component)) {
        logicTypes.push("conditional:javascript");
    }

    if (component?.conditional?.json) {
        logicTypes.push("conditional:json");
    }

    const simpleConditional = component?.conditional;
    const hasSimpleWhen =
        typeof simpleConditional?.when === "string" &&
        simpleConditional.when.trim().length > 0;
    const hasSimpleConditions = Array.isArray(simpleConditional?.conditions);

    if (hasSimpleWhen || hasSimpleConditions) {
        logicTypes.push("conditional:simple");
    }

    return logicTypes;
};

const resolveTreeLabel = (component, basePath) => {
    const isRootLevel = basePath === "components";
    const isPanel = component?.type === "panel";
    const hasTitle =
        typeof component?.title === "string" && component.title.trim().length;

    if (isRootLevel && isPanel && hasTitle) {
        return component.title.trim();
    }

    return normalizeLabel(component);
};

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

    const tree = [];

    components.forEach((component, index) => {
        if (!component || typeof component !== "object") {
            return;
        }

        const path = `${basePath}[${index}]`;

        tree.push({
            id: path,
            label: resolveTreeLabel(component, basePath),
            type: component?.type ?? "unknown",
            key: component?.key ?? "",
            hasCustomConditional: hasCustomConditional(component),
            conditionalLogicTypes: extractConditionalLogicTypes(component),
            path,
            children: collectChildren(component, path),
        });
    });

    return tree;
};
