export const validateComponent = (component, path, errors) => {
    if (!component?.type) {
        errors.push({ path, message: "Missing component type." });
    }

    if (component?.input && !component?.key) {
        errors.push({
            path,
            message: "Input component is missing a key.",
        });
    }

    if (!component?.label && !component?.key) {
        errors.push({
            path,
            message: "Component needs a label or key for clarity.",
        });
    }
};
