import { detectConnections } from "./analyzer/connections";
import { buildTreeFromSchema } from "./analyzer/tree";
import { indexComponentsByPath } from "./analyzer/traverse";
import { validateComponent } from "./analyzer/validation";

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
            connections: [],
            unresolvedConnections: [],
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
            connections: [],
            unresolvedConnections: [],
            stats: null,
        };
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {
            errors: [
                { path: "root", message: "Form definition must be an object." },
            ],
            tree: [],
            connections: [],
            unresolvedConnections: [],
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

    if (components.length === 0) {
        errors.push({
            path: "components",
            message: "No components found in the form definition.",
        });
    }

    let componentCount = 0;
    const duplicateKeys = new Map();

    try {
        const indexed = indexComponentsByPath(components);
        componentCount = Object.keys(indexed).length;

        Object.entries(indexed).forEach(([path, component]) => {
            validateComponent(component, path, errors);

            if (component.key) {
                if (duplicateKeys.has(component.key)) {
                    duplicateKeys.get(component.key).push(path);
                } else {
                    duplicateKeys.set(component.key, [path]);
                }
            }
        });

        // Report duplicate keys
        duplicateKeys.forEach((paths, key) => {
            if (paths.length > 1) {
                errors.push({
                    path: paths.join(", "),
                    message: `Duplicate key "${key}" found in ${paths.length} components.`,
                });
            }
        });

        const tree = buildTreeFromSchema(components);
        const connectionsAnalysis = detectConnections(indexed);

        return {
            errors,
            tree,
            connections: connectionsAnalysis.connections,
            unresolvedConnections: connectionsAnalysis.unresolved,
            stats: {
                total: componentCount,
                display: parsed.display || "unknown",
                totalConnections: connectionsAnalysis.stats.totalConnections,
                connectionTypes: connectionsAnalysis.stats.uniqueTypes,
                connectionTypeCounts: connectionsAnalysis.stats.typeCounts,
            },
        };
    } catch (error) {
        errors.push({
            path: "analysis",
            message: `Error during analysis: ${error.message}`,
        });

        return {
            errors,
            tree: [],
            connections: [],
            unresolvedConnections: [],
            stats: {
                total: componentCount,
                display: parsed.display || "unknown",
                totalConnections: 0,
                connectionTypes: 0,
                connectionTypeCounts: {},
            },
        };
    }
};
