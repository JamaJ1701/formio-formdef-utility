export const normalizeLabel = (component) => {
    if (component?.label) return component.label;
    if (component?.key) return component.key;
    if (component?.type) return component.type;
    return "Component";
};
