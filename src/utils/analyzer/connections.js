import { normalizeLabel } from "./normalizeLabel";

const SCRIPT_FIELDS = new Set([
    "customConditional",
    "calculateValue",
    "customDefaultValue",
    "custom",
    "filter",
    "url",
    "template",
    "javascript",
]);

const DIRECT_KEY_FIELDS = new Set([
    "refreshOn",
    "redrawOn",
    "when",
    "component",
]);

const isObject = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value);

const extractFromScript = (script, knownKeys) => {
    if (!script || typeof script !== "string") return [];

    const references = new Set();
    const patterns = [
        /(?:submission\.data|data|row)\??\.([A-Za-z_][\w$]*)/g,
        /(?:submission\.data|data|row)\[['"`]([A-Za-z_][\w$]*)['"`]\]/g,
        /\{\{\s*(?:submission\.data|data|row)\??\.([A-Za-z_][\w$]*)/g,
        /\{\{\s*(?:submission\.data|data|row)\[['"`]([A-Za-z_][\w$]*)['"`]\]/g,
        /\binstance\.getValue\(\s*['"`]([A-Za-z_][\w$]*)['"`]\s*\)/g,
    ];

    patterns.forEach((pattern) => {
        for (const match of script.matchAll(pattern)) {
            const key = match?.[1];
            if (key && knownKeys.has(key)) {
                references.add(key);
            }
        }
    });

    return [...references];
};

const extractFromJsonLogic = (value, knownKeys, references = new Set()) => {
    if (Array.isArray(value)) {
        value.forEach((item) =>
            extractFromJsonLogic(item, knownKeys, references),
        );
        return references;
    }

    if (!isObject(value)) {
        return references;
    }

    if (typeof value.var === "string") {
        const raw = value.var.trim();
        const parts = raw.split(".");

        if (
            parts[0] === "data" ||
            parts[0] === "row" ||
            parts[0] === "submission"
        ) {
            const candidate = parts[0] === "submission" ? parts[2] : parts[1];
            if (candidate && knownKeys.has(candidate)) {
                references.add(candidate);
            }
        } else if (knownKeys.has(parts[0])) {
            references.add(parts[0]);
        }
    }

    Object.values(value).forEach((child) => {
        extractFromJsonLogic(child, knownKeys, references);
    });

    return references;
};

const buildComponentCatalog = (flattened) => {
    const byPath = new Map();
    const keysToPaths = new Map();

    Object.entries(flattened).forEach(([path, component]) => {
        const entry = {
            path,
            component,
            key: component?.key ?? "",
            label: normalizeLabel(component),
            type: component?.type ?? "unknown",
        };

        byPath.set(path, entry);

        if (entry.key) {
            if (!keysToPaths.has(entry.key)) {
                keysToPaths.set(entry.key, []);
            }
            keysToPaths.get(entry.key).push(path);
        }
    });

    return { byPath, keysToPaths };
};

export const detectConnections = (flattened) => {
    const { byPath, keysToPaths } = buildComponentCatalog(flattened);
    const knownKeys = new Set(keysToPaths.keys());
    const connections = [];
    const unresolved = [];
    const dedupe = new Set();

    const addReference = (sourcePath, targetKey, type, context) => {
        if (!targetKey) return;

        const source = byPath.get(sourcePath);
        const targetPaths = keysToPaths.get(targetKey);

        if (!targetPaths?.length) {
            const unresolvedId = `${sourcePath}|${targetKey}|${type}|${context}`;
            if (!dedupe.has(unresolvedId)) {
                dedupe.add(unresolvedId);
                unresolved.push({
                    sourcePath,
                    sourceKey: source?.key ?? "",
                    sourceLabel: source?.label ?? sourcePath,
                    targetKey,
                    connectionType: type,
                    context,
                });
            }
            return;
        }

        targetPaths.forEach((targetPath) => {
            const target = byPath.get(targetPath);
            const id = `${sourcePath}|${targetPath}|${type}|${context}`;

            if (dedupe.has(id)) return;
            dedupe.add(id);

            connections.push({
                id,
                sourcePath,
                sourceKey: source?.key ?? "",
                sourceLabel: source?.label ?? sourcePath,
                sourceType: source?.type ?? "unknown",
                targetPath,
                targetKey,
                targetLabel: target?.label ?? targetPath,
                targetType: target?.type ?? "unknown",
                connectionType: type,
                context,
            });
        });
    };

    const addScriptReferences = (sourcePath, script, type, context) => {
        extractFromScript(script, knownKeys).forEach((key) => {
            addReference(sourcePath, key, type, context);
        });
    };

    const addJsonLogicReferences = (sourcePath, json, type, context) => {
        [...extractFromJsonLogic(json, knownKeys)].forEach((key) => {
            addReference(sourcePath, key, type, context);
        });
    };

    const walkUnknowns = (value, sourcePath, currentPath) => {
        if (Array.isArray(value)) {
            value.forEach((item, index) => {
                walkUnknowns(item, sourcePath, `${currentPath}[${index}]`);
            });
            return;
        }

        if (!isObject(value)) {
            return;
        }

        Object.entries(value).forEach(([key, child]) => {
            const path = `${currentPath}.${key}`;

            if (
                DIRECT_KEY_FIELDS.has(key) &&
                typeof child === "string" &&
                knownKeys.has(child)
            ) {
                addReference(sourcePath, child, `direct:${key}`, path);
            }

            if (typeof child === "string" && SCRIPT_FIELDS.has(key)) {
                addScriptReferences(sourcePath, child, `script:${key}`, path);
            }

            if (key === "json" || key === "jsonLogic") {
                addJsonLogicReferences(sourcePath, child, `json:${key}`, path);
            }

            walkUnknowns(child, sourcePath, path);
        });
    };

    byPath.forEach(({ component }, sourcePath) => {
        const conditional = component?.conditional;
        if (conditional?.when) {
            addReference(
                sourcePath,
                conditional.when,
                "conditional:simple",
                `${sourcePath}.conditional.when`,
            );
        }
        if (conditional?.json) {
            addJsonLogicReferences(
                sourcePath,
                conditional.json,
                "conditional:json",
                `${sourcePath}.conditional.json`,
            );
        }

        if (typeof component?.customConditional === "string") {
            addScriptReferences(
                sourcePath,
                component.customConditional,
                "conditional:customJavascript",
                `${sourcePath}.customConditional`,
            );
        }

        if (typeof component?.calculateValue === "string") {
            addScriptReferences(
                sourcePath,
                component.calculateValue,
                "calculation:calculateValue",
                `${sourcePath}.calculateValue`,
            );
        }

        if (typeof component?.customDefaultValue === "string") {
            addScriptReferences(
                sourcePath,
                component.customDefaultValue,
                "default:customDefaultValue",
                `${sourcePath}.customDefaultValue`,
            );
        }

        if (typeof component?.validate?.custom === "string") {
            addScriptReferences(
                sourcePath,
                component.validate.custom,
                "validation:custom",
                `${sourcePath}.validate.custom`,
            );
        }

        if (component?.refreshOn && typeof component.refreshOn === "string") {
            addReference(
                sourcePath,
                component.refreshOn,
                "dependency:refreshOn",
                `${sourcePath}.refreshOn`,
            );
        }

        if (component?.redrawOn && typeof component.redrawOn === "string") {
            addReference(
                sourcePath,
                component.redrawOn,
                "dependency:redrawOn",
                `${sourcePath}.redrawOn`,
            );
        }

        if (typeof component?.data?.custom === "string") {
            addScriptReferences(
                sourcePath,
                component.data.custom,
                "data:custom",
                `${sourcePath}.data.custom`,
            );
        }

        if (typeof component?.data?.filter === "string") {
            addScriptReferences(
                sourcePath,
                component.data.filter,
                "data:filter",
                `${sourcePath}.data.filter`,
            );
        }

        if (typeof component?.data?.url === "string") {
            addScriptReferences(
                sourcePath,
                component.data.url,
                "data:url",
                `${sourcePath}.data.url`,
            );
        }

        if (Array.isArray(component?.logic)) {
            component.logic.forEach((logicRule, logicIndex) => {
                const trigger = logicRule?.trigger;

                if (trigger?.simple?.when) {
                    addReference(
                        sourcePath,
                        trigger.simple.when,
                        "logic:trigger:simple",
                        `${sourcePath}.logic[${logicIndex}].trigger.simple.when`,
                    );
                }

                if (typeof trigger?.javascript === "string") {
                    addScriptReferences(
                        sourcePath,
                        trigger.javascript,
                        "logic:trigger:javascript",
                        `${sourcePath}.logic[${logicIndex}].trigger.javascript`,
                    );
                }

                if (trigger?.json) {
                    addJsonLogicReferences(
                        sourcePath,
                        trigger.json,
                        "logic:trigger:json",
                        `${sourcePath}.logic[${logicIndex}].trigger.json`,
                    );
                }

                if (Array.isArray(logicRule?.actions)) {
                    logicRule.actions.forEach((action, actionIndex) => {
                        const actionPath = `${sourcePath}.logic[${logicIndex}].actions[${actionIndex}]`;

                        if (
                            action?.component &&
                            typeof action.component === "string"
                        ) {
                            addReference(
                                sourcePath,
                                action.component,
                                "logic:action:component",
                                `${actionPath}.component`,
                            );
                        }

                        if (typeof action?.value === "string") {
                            addScriptReferences(
                                sourcePath,
                                action.value,
                                "logic:action:value",
                                `${actionPath}.value`,
                            );
                        }

                        if (action?.value && isObject(action.value)) {
                            addJsonLogicReferences(
                                sourcePath,
                                action.value,
                                "logic:action:valueJson",
                                `${actionPath}.value`,
                            );
                        }

                        if (typeof action?.property?.value === "string") {
                            addScriptReferences(
                                sourcePath,
                                action.property.value,
                                "logic:action:propertyValue",
                                `${actionPath}.property.value`,
                            );
                        }
                    });
                }
            });
        }

        walkUnknowns(component, sourcePath, sourcePath);
    });

    const typeCounts = connections.reduce((accumulator, item) => {
        accumulator[item.connectionType] =
            (accumulator[item.connectionType] ?? 0) + 1;
        return accumulator;
    }, {});

    return {
        connections,
        unresolved,
        stats: {
            totalConnections: connections.length,
            uniqueTypes: Object.keys(typeCounts).length,
            typeCounts,
        },
    };
};
