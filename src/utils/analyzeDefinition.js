import { detectConnections } from "./analyzer/connections";
import { buildTreeFromSchema } from "./analyzer/tree";
import {
    indexComponentMetadataByPath,
    indexComponentsByPath,
} from "./analyzer/traverse";
import { validateComponent } from "./analyzer/validation";

const incrementCount = (map, key) => {
    if (!key) return;
    map.set(key, (map.get(key) ?? 0) + 1);
};

const getPrimaryPath = (value) => {
    if (typeof value !== "string") {
        return "";
    }

    return value.split(",")[0].trim();
};

const buildTreeAnalysisMaps = (errors, connections, unresolvedConnections) => {
    const errorCounts = new Map();
    const incomingCounts = new Map();
    const outgoingCounts = new Map();
    const unresolvedOutgoingCounts = new Map();

    errors.forEach((error) => {
        incrementCount(errorCounts, getPrimaryPath(error.path));
    });

    connections.forEach((connection) => {
        incrementCount(outgoingCounts, connection.sourcePath);
        incrementCount(incomingCounts, connection.targetPath);
    });

    unresolvedConnections.forEach((connection) => {
        incrementCount(unresolvedOutgoingCounts, connection.sourcePath);
    });

    return {
        errorCounts,
        incomingCounts,
        outgoingCounts,
        unresolvedOutgoingCounts,
    };
};

const enrichTreeWithAnalysis = (nodes, maps) => {
    return nodes.map((node) => {
        const children = enrichTreeWithAnalysis(node.children ?? [], maps);

        const directErrors = maps.errorCounts.get(node.id) ?? 0;
        const directIncoming = maps.incomingCounts.get(node.id) ?? 0;
        const directOutgoing = maps.outgoingCounts.get(node.id) ?? 0;
        const directUnresolvedOutgoing =
            maps.unresolvedOutgoingCounts.get(node.id) ?? 0;

        const childRollup = children.reduce(
            (total, child) => {
                const analysis = child.analysis ?? {};
                return {
                    totalErrors:
                        total.totalErrors + (analysis.totalErrors ?? 0),
                    totalIncoming:
                        total.totalIncoming + (analysis.totalIncoming ?? 0),
                    totalOutgoing:
                        total.totalOutgoing + (analysis.totalOutgoing ?? 0),
                    totalUnresolvedOutgoing:
                        total.totalUnresolvedOutgoing +
                        (analysis.totalUnresolvedOutgoing ?? 0),
                };
            },
            {
                totalErrors: 0,
                totalIncoming: 0,
                totalOutgoing: 0,
                totalUnresolvedOutgoing: 0,
            },
        );

        const totalErrors = directErrors + childRollup.totalErrors;
        const totalIncoming = directIncoming + childRollup.totalIncoming;
        const totalOutgoing = directOutgoing + childRollup.totalOutgoing;
        const totalUnresolvedOutgoing =
            directUnresolvedOutgoing + childRollup.totalUnresolvedOutgoing;

        return {
            ...node,
            children,
            analysis: {
                directErrors,
                directIncoming,
                directOutgoing,
                directUnresolvedOutgoing,
                totalErrors,
                totalIncoming,
                totalOutgoing,
                totalUnresolvedOutgoing,
                totalConnections: totalIncoming + totalOutgoing,
            },
        };
    });
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
    const duplicateDataPaths = new Map();

    try {
        const indexed = indexComponentsByPath(components);
        const metadataByPath = indexComponentMetadataByPath(components);
        componentCount = Object.keys(metadataByPath).length;

        Object.entries(metadataByPath).forEach(([path, metadata]) => {
            const { component, dataPath } = metadata;
            validateComponent(component, path, errors);

            if (dataPath) {
                if (duplicateDataPaths.has(dataPath)) {
                    duplicateDataPaths.get(dataPath).push(path);
                } else {
                    duplicateDataPaths.set(dataPath, [path]);
                }
            }
        });

        // Report duplicate effective submission paths (scope-aware).
        duplicateDataPaths.forEach((paths, dataPath) => {
            if (paths.length > 1) {
                errors.push({
                    path: paths.join(", "),
                    message: `Duplicate data path "${dataPath}" found in ${paths.length} components. Keys can repeat across different containers, but final submission paths must be unique.`,
                });
            }
        });

        const connectionsAnalysis = detectConnections(indexed);
        const tree = enrichTreeWithAnalysis(
            buildTreeFromSchema(components),
            buildTreeAnalysisMaps(
                errors,
                connectionsAnalysis.connections,
                connectionsAnalysis.unresolved,
            ),
        );

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
