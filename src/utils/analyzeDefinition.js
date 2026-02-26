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

const incrementTypeCount = (map, key, type) => {
    if (!key || !type) return;

    if (!map.has(key)) {
        map.set(key, new Map());
    }

    const typeMap = map.get(key);
    typeMap.set(type, (typeMap.get(type) ?? 0) + 1);
};

const toCountObject = (typeMap) => {
    if (!typeMap) {
        return {};
    }

    return Object.fromEntries(typeMap.entries());
};

const mergeCountObjects = (left = {}, right = {}) => {
    const merged = { ...left };

    Object.entries(right).forEach(([key, value]) => {
        merged[key] = (merged[key] ?? 0) + value;
    });

    return merged;
};

const FORMIO_TRIGGER_TYPES = new Set(["simple", "javascript", "json", "event"]);

const FORMIO_ACTION_TYPES = new Set([
    "property",
    "value",
    "mergeComponentSchema",
    "customAction",
]);

const appendReferenceMatches = (
    references,
    highlightTokens,
    text,
    componentKeys = [],
) => {
    if (typeof text !== "string" || !text.trim()) {
        return;
    }

    const dataPathRegex = /\b(?:data|row)\s*(?:\.\s*[A-Za-z_$][\w$]*|\[\s*["'][^"']+["']\s*\])/g;
    const dataMatches = text.match(dataPathRegex) ?? [];

    dataMatches.forEach((match) => {
        const normalized = match.replace(/\s+/g, "");
        references.add(`data:${normalized}`);
        highlightTokens.add(match);
    });

    componentKeys.forEach((componentKey) => {
        const keyRegex = new RegExp(`\\b${componentKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
        if (keyRegex.test(text)) {
            references.add(`component:${componentKey}`);
            highlightTokens.add(componentKey);
        }
    });
};

const extractConfiguredLogicDetails = (component, componentKeys = []) => {
    const details = [];
    const logicEntries = Array.isArray(component?.logic) ? component.logic : [];

    logicEntries.forEach((logic, index) => {
        const name =
            typeof logic?.name === "string" && logic.name.trim()
                ? logic.name.trim()
                : `Logic ${index + 1}`;

        const triggerTypeRaw =
            typeof logic?.trigger?.type === "string"
                ? logic.trigger.type.trim()
                : "";
        const triggerType = triggerTypeRaw
            ? triggerTypeRaw.toLowerCase()
            : "configured";

        const actionTypes = Array.isArray(logic?.actions)
            ? logic.actions
                  .map((action) =>
                      typeof action?.type === "string" && action.type.trim()
                          ? action.type.trim()
                          : "configured",
                  )
                  .filter(Boolean)
            : [];

        const sources = [];
        const references = new Set();
        const highlightTokens = new Set();

        if (typeof logic?.trigger?.javascript === "string") {
            sources.push({
                label: "trigger javascript",
                text: logic.trigger.javascript,
            });
            appendReferenceMatches(
                references,
                highlightTokens,
                logic.trigger.javascript,
                componentKeys,
            );
        }

        if (logic?.trigger?.json) {
            const jsonText = JSON.stringify(logic.trigger.json, null, 2);
            sources.push({
                label: "trigger json",
                text: jsonText,
            });
            appendReferenceMatches(
                references,
                highlightTokens,
                jsonText,
                componentKeys,
            );
        }

        if (Array.isArray(logic?.actions)) {
            logic.actions.forEach((action, actionIndex) => {
                const actionLabel =
                    typeof action?.name === "string" && action.name.trim()
                        ? action.name.trim()
                        : `action ${actionIndex + 1}`;

                [
                    ["custom action", action?.customAction],
                    ["value", action?.value],
                    ["schema", action?.schemaDefinition],
                ].forEach(([typeLabel, sourceText]) => {
                    if (typeof sourceText !== "string") {
                        return;
                    }

                    sources.push({
                        label: `${actionLabel} ${typeLabel}`,
                        text: sourceText,
                    });
                    appendReferenceMatches(
                        references,
                        highlightTokens,
                        sourceText,
                        componentKeys,
                    );
                });
            });
        }

        details.push({
            id: `advanced-${index}`,
            name,
            triggerType,
            actionTypes: Array.from(new Set(actionTypes)),
            references: Array.from(references).sort((left, right) =>
                left.localeCompare(right),
            ),
            highlightTokens: Array.from(highlightTokens).sort(
                (left, right) => right.length - left.length,
            ),
            sources,
        });
    });

    const conditional = component?.conditional;
    if (conditional && typeof conditional === "object") {
        const references = new Set();
        const highlightTokens = new Set();

        const when =
            typeof conditional?.when === "string" ? conditional.when.trim() : "";
        if (when) {
            references.add(`component:${when}`);
            highlightTokens.add(when);
        }

        (conditional.conditions ?? []).forEach((condition) => {
            const targetComponent =
                typeof condition?.component === "string"
                    ? condition.component.trim()
                    : "";
            if (targetComponent) {
                references.add(`component:${targetComponent}`);
                highlightTokens.add(targetComponent);
            }
        });

        if (typeof conditional?.custom === "string") {
            appendReferenceMatches(
                references,
                highlightTokens,
                conditional.custom,
                componentKeys,
            );
        }

        if (conditional?.json) {
            appendReferenceMatches(
                references,
                highlightTokens,
                JSON.stringify(conditional.json, null, 2),
                componentKeys,
            );
        }

        details.push({
            id: "conditional",
            name: "Conditional Visibility",
            triggerType: "conditional",
            actionTypes: ["show/hide"],
            references: Array.from(references).sort((left, right) =>
                left.localeCompare(right),
            ),
            highlightTokens: Array.from(highlightTokens).sort(
                (left, right) => right.length - left.length,
            ),
            sources: [
                {
                    label: "conditional",
                    text: JSON.stringify(conditional, null, 2),
                },
            ],
        });
    }

    return details;
};

const extractLogicTypes = (component) => {
    const logicEntries = Array.isArray(component?.logic) ? component.logic : [];

    if (!logicEntries.length) {
        return {
            hasLogic: false,
            logicTypes: [],
        };
    }

    const logicTypes = new Set();

    logicEntries.forEach((logic) => {
        const triggerTypeRaw =
            typeof logic?.trigger?.type === "string"
                ? logic.trigger.type.trim()
                : "";
        const triggerType = triggerTypeRaw.toLowerCase();

        if (triggerType) {
            if (FORMIO_TRIGGER_TYPES.has(triggerType)) {
                logicTypes.add(`trigger:${triggerType}`);
            } else {
                logicTypes.add(`trigger:unsupported(${triggerTypeRaw})`);
            }
        } else if (logic?.trigger && typeof logic.trigger === "object") {
            logicTypes.add("trigger:configured");
        }

        if (Array.isArray(logic?.actions)) {
            logic.actions.forEach((action) => {
                const actionType =
                    typeof action?.type === "string" ? action.type.trim() : "";

                if (actionType) {
                    if (FORMIO_ACTION_TYPES.has(actionType)) {
                        logicTypes.add(`action:${actionType}`);
                    } else {
                        logicTypes.add(`action:unsupported(${actionType})`);
                    }
                } else if (action && typeof action === "object") {
                    logicTypes.add("action:configured");
                }
            });
        }
    });

    if (!logicTypes.size) {
        logicTypes.add("configured");
    }

    return {
        hasLogic: true,
        logicTypes: Array.from(logicTypes).sort((left, right) =>
            left.localeCompare(right),
        ),
    };
};

const getPrimaryPath = (value) => {
    if (typeof value !== "string") {
        return "";
    }

    return value.split(",")[0].trim();
};

const buildLocatorFromMetadata = (metadata) => {
    if (!metadata?.component) {
        return null;
    }

    const component = metadata.component;

    return {
        label:
            component.label || component.key || component.type || "Component",
        key: component.key || "",
        type: component.type || "unknown",
        schemaPath: metadata.schemaPath || "",
        schemaPathDisplay:
            metadata.schemaPathDisplay || metadata.schemaPath || "",
        dataPath: metadata.dataPath || "",
    };
};

const enrichErrorsWithLocators = (errors, metadataByPath) => {
    return errors.map((error) => {
        const rawPath = typeof error.path === "string" ? error.path : "";
        const schemaPaths = rawPath
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);

        const locators = schemaPaths
            .map((schemaPath) => {
                const metadata = metadataByPath[schemaPath];
                return buildLocatorFromMetadata(metadata);
            })
            .filter(Boolean);

        if (!locators.length) {
            return error;
        }

        return {
            ...error,
            locators,
        };
    });
};

const buildTreeAnalysisMaps = (errors, connections, unresolvedConnections) => {
    const errorCounts = new Map();
    const incomingCounts = new Map();
    const outgoingCounts = new Map();
    const unresolvedOutgoingCounts = new Map();
    const incomingTypeCounts = new Map();
    const outgoingTypeCounts = new Map();
    const unresolvedOutgoingTypeCounts = new Map();

    errors.forEach((error) => {
        incrementCount(errorCounts, getPrimaryPath(error.path));
    });

    connections.forEach((connection) => {
        incrementCount(outgoingCounts, connection.sourcePath);
        incrementCount(incomingCounts, connection.targetPath);
        incrementTypeCount(
            outgoingTypeCounts,
            connection.sourcePath,
            connection.connectionType,
        );
        incrementTypeCount(
            incomingTypeCounts,
            connection.targetPath,
            connection.connectionType,
        );
    });

    unresolvedConnections.forEach((connection) => {
        incrementCount(unresolvedOutgoingCounts, connection.sourcePath);
        incrementTypeCount(
            unresolvedOutgoingTypeCounts,
            connection.sourcePath,
            connection.connectionType,
        );
    });

    return {
        errorCounts,
        incomingCounts,
        outgoingCounts,
        unresolvedOutgoingCounts,
        incomingTypeCounts,
        outgoingTypeCounts,
        unresolvedOutgoingTypeCounts,
    };
};

const enrichTreeWithAnalysis = (nodes, maps, metadataByPath, componentKeys) => {
    return nodes.map((node) => {
        const children = enrichTreeWithAnalysis(
            node.children ?? [],
            maps,
            metadataByPath,
            componentKeys,
        );
        const metadata = metadataByPath[node.id];
        const dataPath = metadata?.dataPath || "";
        const affectsDataPath = Boolean(dataPath);
        const { hasLogic, logicTypes } = extractLogicTypes(metadata?.component);
        const logicDetails = extractConfiguredLogicDetails(
            metadata?.component,
            componentKeys,
        );
        const conditionalLogicTypes = Array.isArray(node.conditionalLogicTypes)
            ? node.conditionalLogicTypes
            : [];
        const combinedLogicTypes = Array.from(
            new Set([...logicTypes, ...conditionalLogicTypes]),
        ).sort((left, right) => left.localeCompare(right));
        const hasAnyLogic = hasLogic || combinedLogicTypes.length > 0;

        const directErrors = maps.errorCounts.get(node.id) ?? 0;
        const directIncoming = maps.incomingCounts.get(node.id) ?? 0;
        const directOutgoing = maps.outgoingCounts.get(node.id) ?? 0;
        const directUnresolvedOutgoing =
            maps.unresolvedOutgoingCounts.get(node.id) ?? 0;
        const directIncomingTypeCounts = toCountObject(
            maps.incomingTypeCounts.get(node.id),
        );
        const directOutgoingTypeCounts = toCountObject(
            maps.outgoingTypeCounts.get(node.id),
        );
        const directUnresolvedOutgoingTypeCounts = toCountObject(
            maps.unresolvedOutgoingTypeCounts.get(node.id),
        );

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
                    totalIncomingTypeCounts: mergeCountObjects(
                        total.totalIncomingTypeCounts,
                        analysis.totalIncomingTypeCounts,
                    ),
                    totalOutgoingTypeCounts: mergeCountObjects(
                        total.totalOutgoingTypeCounts,
                        analysis.totalOutgoingTypeCounts,
                    ),
                    totalUnresolvedOutgoingTypeCounts: mergeCountObjects(
                        total.totalUnresolvedOutgoingTypeCounts,
                        analysis.totalUnresolvedOutgoingTypeCounts,
                    ),
                };
            },
            {
                totalErrors: 0,
                totalIncoming: 0,
                totalOutgoing: 0,
                totalUnresolvedOutgoing: 0,
                totalIncomingTypeCounts: {},
                totalOutgoingTypeCounts: {},
                totalUnresolvedOutgoingTypeCounts: {},
            },
        );

        const totalErrors = directErrors + childRollup.totalErrors;
        const totalIncoming = directIncoming + childRollup.totalIncoming;
        const totalOutgoing = directOutgoing + childRollup.totalOutgoing;
        const totalUnresolvedOutgoing =
            directUnresolvedOutgoing + childRollup.totalUnresolvedOutgoing;
        const totalIncomingTypeCounts = mergeCountObjects(
            directIncomingTypeCounts,
            childRollup.totalIncomingTypeCounts,
        );
        const totalOutgoingTypeCounts = mergeCountObjects(
            directOutgoingTypeCounts,
            childRollup.totalOutgoingTypeCounts,
        );
        const totalUnresolvedOutgoingTypeCounts = mergeCountObjects(
            directUnresolvedOutgoingTypeCounts,
            childRollup.totalUnresolvedOutgoingTypeCounts,
        );

        return {
            ...node,
            children,
            dataPath,
            affectsDataPath,
            hasLogic: hasAnyLogic,
            logicTypes: combinedLogicTypes,
            logicDetails,
            analysis: {
                directErrors,
                directIncoming,
                directOutgoing,
                directUnresolvedOutgoing,
                directIncomingTypeCounts,
                directOutgoingTypeCounts,
                directUnresolvedOutgoingTypeCounts,
                totalErrors,
                totalIncoming,
                totalOutgoing,
                totalUnresolvedOutgoing,
                totalIncomingTypeCounts,
                totalOutgoingTypeCounts,
                totalUnresolvedOutgoingTypeCounts,
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
        const componentKeys = Array.from(
            new Set(
                Object.values(metadataByPath)
                    .map((metadata) => metadata?.component?.key)
                    .filter(
                        (key) =>
                            typeof key === "string" && key.trim().length > 0,
                    ),
            ),
        );
        componentCount = Object.keys(metadataByPath).length;
        const detectedComponentTypes = Array.from(
            new Set(
                Object.values(metadataByPath)
                    .map((metadata) => metadata?.component?.type)
                    .filter(Boolean),
            ),
        ).sort((left, right) => left.localeCompare(right));

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

        const connectionsAnalysis = detectConnections(indexed, metadataByPath);
        const errorsWithLocators = enrichErrorsWithLocators(
            errors,
            metadataByPath,
        );
        const tree = enrichTreeWithAnalysis(
            buildTreeFromSchema(components),
            buildTreeAnalysisMaps(
                errorsWithLocators,
                connectionsAnalysis.connections,
                connectionsAnalysis.unresolved,
            ),
            metadataByPath,
            componentKeys,
        );

        return {
            errors: errorsWithLocators,
            tree,
            connections: connectionsAnalysis.connections,
            unresolvedConnections: connectionsAnalysis.unresolved,
            stats: {
                total: componentCount,
                display: parsed.display || "unknown",
                totalConnections: connectionsAnalysis.stats.totalConnections,
                connectionTypes: connectionsAnalysis.stats.uniqueTypes,
                connectionTypeCounts: connectionsAnalysis.stats.typeCounts,
                componentTypes: detectedComponentTypes,
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
                componentTypes: [],
            },
        };
    }
};
