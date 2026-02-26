import { useEffect, useMemo, useRef, useState } from "react";

const FORMIO_LAYOUT_COMPONENT_TYPES = new Set([
    "columns",
    "content",
    "fieldset",
    "htmlelement",
    "panel",
    "table",
    "tabs",
    "well",
    "keyline",
]);

const isLayoutComponentType = (type) => FORMIO_LAYOUT_COMPONENT_TYPES.has(type);

const buildInitialCollapsedSet = (nodes, depth = 0, collapsed = new Set()) => {
    nodes.forEach((node) => {
        const children = node.children ?? [];
        if (children.length && depth > 0) {
            collapsed.add(node.id);
        }
        buildInitialCollapsedSet(children, depth + 1, collapsed);
    });

    return collapsed;
};

const filterTreeNodes = (nodes, selectedType, hideLayoutOnly, depth = 0) => {
    return nodes.reduce((accumulator, node) => {
        const children = filterTreeNodes(
            node.children ?? [],
            selectedType,
            hideLayoutOnly,
            depth + 1,
        );

        const matchesType =
            selectedType === "all" || node.type === selectedType;
        const isRootPanel = depth === 0 && node.type === "panel";
        const matchesLayout =
            !hideLayoutOnly || !isLayoutComponentType(node.type) || isRootPanel;
        const matchesSelf = matchesType && matchesLayout;

        if (!matchesSelf && !children.length) {
            return accumulator;
        }

        if (!matchesSelf && children.length) {
            accumulator.push(...children);
            return accumulator;
        }

        accumulator.push({
            ...node,
            children,
        });

        return accumulator;
    }, []);
};

const findNodeById = (nodes, id) => {
    for (const node of nodes) {
        if (node.id === id) {
            return node;
        }

        const childMatch = findNodeById(node.children ?? [], id);
        if (childMatch) {
            return childMatch;
        }
    }

    return null;
};

const collectVisibleIds = (nodes, ids = []) => {
    nodes.forEach((node) => {
        ids.push(node.id);
        collectVisibleIds(node.children ?? [], ids);
    });

    return ids;
};

const escapeRegExp = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const renderHighlightedText = (text, highlightTokens = []) => {
    if (typeof text !== "string" || !text.length || !highlightTokens.length) {
        return text;
    }

    const uniqueTokens = Array.from(
        new Set(highlightTokens.filter(Boolean)),
    ).sort((left, right) => right.length - left.length);

    if (!uniqueTokens.length) {
        return text;
    }

    const highlightRegex = new RegExp(
        `(${uniqueTokens.map((token) => escapeRegExp(token)).join("|")})`,
        "g",
    );

    return text.split(highlightRegex).map((part, index) => {
        if (uniqueTokens.includes(part)) {
            return (
                <mark key={`hl-${index}`} className="logic-ref-highlight">
                    {part}
                </mark>
            );
        }

        return <span key={`txt-${index}`}>{part}</span>;
    });
};

const TreeNode = ({
    node,
    depth,
    collapsedIds,
    onToggle,
    selectedNodeId,
    onSelect,
}) => {
    const children = node.children ?? [];
    const hasChildren = children.length > 0;
    const isCollapsed = hasChildren && collapsedIds.has(node.id);
    const isSelected = selectedNodeId === node.id;

    return (
        <li>
            <div
                className={`component-tree-node ${isSelected ? "selected" : ""}`}
                style={{ paddingLeft: `${12 + depth * 16}px` }}
            >
                {hasChildren ? (
                    <button
                        className="component-tree-toggle"
                        type="button"
                        onClick={() => onToggle(node.id)}
                        aria-expanded={!isCollapsed}
                        aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${node.label}`}
                    >
                        {isCollapsed ? "▸" : "▾"}
                    </button>
                ) : (
                    <span className="component-tree-spacer" aria-hidden="true">
                        ·
                    </span>
                )}

                <button
                    className="component-tree-select"
                    type="button"
                    onClick={() => onSelect(node.id)}
                >
                    <span className="component-tree-label">{node.label}</span>
                    <span className="component-tree-inline-meta">
                        <span className="badge">{node.type}</span>
                        {node.analysis?.totalErrors > 0 ? (
                            <span className="badge issue-tag">
                                errors: {node.analysis.totalErrors}
                            </span>
                        ) : null}
                        {node.analysis?.totalConnections > 0 ? (
                            <span className="badge connection-tag">
                                links: {node.analysis.totalConnections}
                            </span>
                        ) : null}
                        {node.analysis?.totalUnresolvedOutgoing > 0 ? (
                            <span className="badge unresolved-tag">
                                unresolved:{" "}
                                {node.analysis.totalUnresolvedOutgoing}
                            </span>
                        ) : null}
                        {node.hasLogic ? (
                            <span className="badge conditional-tag">logic</span>
                        ) : null}
                        {isLayoutComponentType(node.type) ? (
                            <span className="meta">layout-only</span>
                        ) : null}
                    </span>
                </button>
            </div>

            {hasChildren && !isCollapsed ? (
                <ul className="component-tree-children">
                    {children.map((child) => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            collapsedIds={collapsedIds}
                            onToggle={onToggle}
                            selectedNodeId={selectedNodeId}
                            onSelect={onSelect}
                        />
                    ))}
                </ul>
            ) : null}
        </li>
    );
};

const ComponentTree = ({
    nodes,
    errors,
    unresolvedConnections,
    componentTypes,
}) => {
    const [selectedType, setSelectedType] = useState("all");
    const [hideLayoutOnly, setHideLayoutOnly] = useState(false);
    const [selectedNodeIdOverride, setSelectedNodeIdOverride] = useState("");
    const [collapsedToggles, setCollapsedToggles] = useState(() => new Set());
    const detailPanelRef = useRef(null);

    const filteredNodes = useMemo(
        () => filterTreeNodes(nodes, selectedType, hideLayoutOnly),
        [nodes, selectedType, hideLayoutOnly],
    );

    const visibleNodeIds = useMemo(
        () => new Set(collectVisibleIds(filteredNodes)),
        [filteredNodes],
    );

    const selectedNodeId = useMemo(() => {
        const fallbackNodeId = filteredNodes[0]?.id ?? "";

        if (!selectedNodeIdOverride) {
            return fallbackNodeId;
        }

        if (visibleNodeIds.has(selectedNodeIdOverride)) {
            return selectedNodeIdOverride;
        }

        return fallbackNodeId;
    }, [selectedNodeIdOverride, visibleNodeIds, filteredNodes]);

    const collapsedIds = useMemo(() => {
        const next = buildInitialCollapsedSet(nodes);

        collapsedToggles.forEach((nodeId) => {
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
        });

        return next;
    }, [nodes, collapsedToggles]);

    const selectedNode = useMemo(
        () => findNodeById(filteredNodes, selectedNodeId),
        [filteredNodes, selectedNodeId],
    );

    const directErrorsByPath = useMemo(() => {
        const map = new Map();

        (errors ?? []).forEach((error) => {
            const locators = error.locators ?? [];
            locators.forEach((locator) => {
                if (!locator.schemaPath) {
                    return;
                }

                if (!map.has(locator.schemaPath)) {
                    map.set(locator.schemaPath, []);
                }

                map.get(locator.schemaPath).push(error);
            });
        });

        return map;
    }, [errors]);

    const selectedErrors = selectedNode
        ? (directErrorsByPath.get(selectedNode.id) ?? [])
        : [];

    const unresolvedBySourcePath = useMemo(() => {
        const map = new Map();

        (unresolvedConnections ?? []).forEach((connection) => {
            if (!connection.sourcePath) {
                return;
            }

            if (!map.has(connection.sourcePath)) {
                map.set(connection.sourcePath, []);
            }

            map.get(connection.sourcePath).push(connection);
        });

        return map;
    }, [unresolvedConnections]);

    const selectedUnresolvedReferences = selectedNode
        ? (unresolvedBySourcePath.get(selectedNode.id) ?? [])
        : [];

    const selectedTriggerLogicTypes = useMemo(() => {
        if (!selectedNode?.logicTypes?.length) {
            return [];
        }

        return selectedNode.logicTypes
            .filter((logicType) => logicType.startsWith("trigger:"))
            .map((logicType) => logicType.slice("trigger:".length));
    }, [selectedNode]);

    const selectedActionLogicTypes = useMemo(() => {
        if (!selectedNode?.logicTypes?.length) {
            return [];
        }

        return selectedNode.logicTypes
            .filter((logicType) => logicType.startsWith("action:"))
            .map((logicType) => logicType.slice("action:".length));
    }, [selectedNode]);

    const selectedOtherLogicTypes = useMemo(() => {
        if (!selectedNode?.logicTypes?.length) {
            return [];
        }

        return selectedNode.logicTypes.filter(
            (logicType) =>
                !logicType.startsWith("trigger:") &&
                !logicType.startsWith("action:") &&
                !logicType.startsWith("conditional:"),
        );
    }, [selectedNode]);

    const selectedConditionalLogicTypes = useMemo(() => {
        if (!selectedNode?.logicTypes?.length) {
            return [];
        }

        return selectedNode.logicTypes
            .filter((logicType) => logicType.startsWith("conditional:"))
            .map((logicType) => logicType.slice("conditional:".length));
    }, [selectedNode]);

    useEffect(() => {
        if (!selectedNodeId) {
            return;
        }

        const panel = detailPanelRef.current;
        if (!panel) {
            return;
        }

        const rect = panel.getBoundingClientRect();
        const isInView = rect.top >= 0 && rect.bottom <= window.innerHeight;

        if (!isInView) {
            panel.scrollIntoView({
                block: "nearest",
                behavior: "smooth",
            });
        }
    }, [selectedNodeId]);

    const handleToggleNode = (nodeId) => {
        setCollapsedToggles((previous) => {
            const next = new Set(previous);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }

            return next;
        });
    };

    if (!nodes.length) {
        return (
            <p className="empty-state">
                Run analysis to see the component tree.
            </p>
        );
    }

    return (
        <div className="component-tree-shell">
            <div className="component-tree-controls">
                <label className="component-tree-filter">
                    <span>Component type</span>
                    <select
                        value={selectedType}
                        onChange={(event) =>
                            setSelectedType(event.target.value)
                        }
                    >
                        <option value="all">All types</option>
                        {(componentTypes ?? []).map((type) => (
                            <option key={type} value={type}>
                                {type}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="component-tree-check">
                    <input
                        type="checkbox"
                        checked={hideLayoutOnly}
                        onChange={(event) =>
                            setHideLayoutOnly(event.target.checked)
                        }
                    />
                    <span>Hide layout-only components</span>
                </label>
            </div>

            <div className="component-tree-content">
                <div className="component-tree-list-wrap">
                    {filteredNodes.length ? (
                        <ul className="component-tree-list">
                            {filteredNodes.map((node) => (
                                <TreeNode
                                    key={node.id}
                                    node={node}
                                    depth={0}
                                    collapsedIds={collapsedIds}
                                    onToggle={handleToggleNode}
                                    selectedNodeId={selectedNodeId}
                                    onSelect={setSelectedNodeIdOverride}
                                />
                            ))}
                        </ul>
                    ) : (
                        <p className="empty-state">
                            No components match the active filters.
                        </p>
                    )}
                </div>

                <aside
                    ref={detailPanelRef}
                    className="component-tree-detail"
                    aria-live="polite"
                >
                    {selectedNode ? (
                        <>
                            <h4>{selectedNode.label}</h4>
                            <div className="component-tree-detail-meta">
                                <span className="badge">
                                    {selectedNode.type}
                                </span>
                                {selectedNode.key ? (
                                    <span className="meta">
                                        key: {selectedNode.key}
                                    </span>
                                ) : null}
                                <span className="meta">
                                    schema path: {selectedNode.id}
                                </span>
                                <span className="meta">
                                    data path:{" "}
                                    {selectedNode.dataPath || "not mapped"}
                                </span>
                                {selectedNode.hasCustomConditional ? (
                                    <span className="badge conditional-tag">
                                        custom conditional
                                    </span>
                                ) : null}
                                {selectedNode.hasLogic ? (
                                    <span className="badge conditional-tag">
                                        has logic
                                    </span>
                                ) : null}
                            </div>
                            {selectedNode.logicTypes?.length ? (
                                <div className="component-tree-detail-errors">
                                    <h5>Configured logic</h5>
                                    <div className="component-tree-detail-stats">
                                        {selectedTriggerLogicTypes.length ? (
                                            <span className="meta">
                                                trigger:{" "}
                                                {selectedTriggerLogicTypes.join(
                                                    ", ",
                                                )}
                                            </span>
                                        ) : null}
                                        {selectedActionLogicTypes.length ? (
                                            <span className="meta">
                                                action:{" "}
                                                {selectedActionLogicTypes.join(
                                                    ", ",
                                                )}
                                            </span>
                                        ) : null}
                                        {selectedConditionalLogicTypes.length ? (
                                            <span className="meta">
                                                conditional:{" "}
                                                {selectedConditionalLogicTypes.join(
                                                    ", ",
                                                )}
                                            </span>
                                        ) : null}
                                        {selectedOtherLogicTypes.length ? (
                                            <span className="meta">
                                                other:{" "}
                                                {selectedOtherLogicTypes.join(
                                                    ", ",
                                                )}
                                            </span>
                                        ) : null}
                                    </div>

                                    {(selectedNode.logicDetails ?? []).map(
                                        (logicDetail) => {
                                            const componentReferences = (
                                                logicDetail.references ?? []
                                            )
                                                .filter((reference) =>
                                                    reference.startsWith(
                                                        "component:",
                                                    ),
                                                )
                                                .map((reference) =>
                                                    reference.slice(
                                                        "component:".length,
                                                    ),
                                                );

                                            const dataReferences = (
                                                logicDetail.references ?? []
                                            )
                                                .filter((reference) =>
                                                    reference.startsWith("data:"),
                                                )
                                                .map((reference) =>
                                                    reference.slice(
                                                        "data:".length,
                                                    ),
                                                );

                                            return (
                                                <div
                                                    key={`${selectedNode.id}-${logicDetail.id}`}
                                                    className="logic-detail-card"
                                                >
                                                    <div className="component-tree-detail-stats">
                                                        <span className="badge conditional-tag">
                                                            {logicDetail.name}
                                                        </span>
                                                    </div>

                                                    <div className="logic-source-block">
                                                        <span className="meta">
                                                            type of logic
                                                        </span>
                                                        <div className="component-tree-detail-stats">
                                                            <span className="meta">
                                                                trigger: {logicDetail.triggerType}
                                                            </span>
                                                            {logicDetail.actionTypes?.length ? (
                                                                <span className="meta">
                                                                    actions: {logicDetail.actionTypes.join(
                                                                        ", ",
                                                                    )}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </div>

                                                    <div className="logic-source-block">
                                                        <span className="meta">
                                                            how configured
                                                        </span>
                                                        {logicDetail.sources?.length ? (
                                                            logicDetail.sources.map(
                                                                (
                                                                    source,
                                                                    index,
                                                                ) => (
                                                                    <div
                                                                        key={`${logicDetail.id}-${source.label}-${index}`}
                                                                        className="logic-source-block"
                                                                    >
                                                                        <span className="meta">
                                                                            {source.label}
                                                                        </span>
                                                                        <pre className="logic-source-text">
                                                                            {renderHighlightedText(
                                                                                source.text,
                                                                                logicDetail.highlightTokens,
                                                                            )}
                                                                        </pre>
                                                                    </div>
                                                                ),
                                                            )
                                                        ) : (
                                                            <span className="meta">
                                                                No explicit source expression configured.
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="logic-source-block">
                                                        <span className="meta">
                                                            other components mentioned
                                                        </span>
                                                        {componentReferences.length ? (
                                                            <div className="component-tree-detail-stats">
                                                                {componentReferences.map(
                                                                    (
                                                                        componentReference,
                                                                    ) => (
                                                                        <span
                                                                            key={`${logicDetail.id}-component-${componentReference}`}
                                                                            className="badge connection-tag"
                                                                        >
                                                                            {componentReference}
                                                                        </span>
                                                                    ),
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="meta">
                                                                None
                                                            </span>
                                                        )}

                                                        {dataReferences.length ? (
                                                            <div className="component-tree-detail-stats">
                                                                <span className="meta">
                                                                    form data: {dataReferences.join(", ")}
                                                                </span>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            );
                                        },
                                    )}
                                </div>
                            ) : null}
                            <div className="component-tree-detail-stats">
                                <span className="badge issue-tag">
                                    total errors:{" "}
                                    {selectedNode.analysis?.totalErrors ?? 0}
                                </span>
                                <span className="badge connection-tag">
                                    total links:{" "}
                                    {selectedNode.analysis?.totalConnections ??
                                        0}
                                </span>
                                <span className="badge unresolved-tag">
                                    unresolved out:{" "}
                                    {selectedNode.analysis
                                        ?.totalUnresolvedOutgoing ?? 0}
                                </span>
                            </div>
                            <div className="component-tree-detail-errors">
                                <h5>Direct errors</h5>
                                {selectedErrors.length ? (
                                    <ul>
                                        {selectedErrors.map((error, index) => (
                                            <li
                                                key={`${selectedNode.id}-${index}`}
                                            >
                                                {error.message}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="empty-state">
                                        No direct errors.
                                    </p>
                                )}
                            </div>
                            <div className="component-tree-detail-errors">
                                <h5>Unresolved references</h5>
                                {selectedUnresolvedReferences.length ? (
                                    <ul>
                                        {selectedUnresolvedReferences.map(
                                            (connection, index) => (
                                                <li
                                                    key={`${selectedNode.id}-${connection.targetKey}-${index}`}
                                                >
                                                    {connection.targetKey} (
                                                    {connection.connectionType})
                                                    at {connection.context}
                                                </li>
                                            ),
                                        )}
                                    </ul>
                                ) : (
                                    <p className="empty-state">
                                        No unresolved references.
                                    </p>
                                )}
                            </div>
                        </>
                    ) : (
                        <p className="empty-state">
                            Select a component to view details.
                        </p>
                    )}
                </aside>
            </div>
        </div>
    );
};

export default ComponentTree;
