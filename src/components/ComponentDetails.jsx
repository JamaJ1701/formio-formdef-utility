const ComponentDetails = ({
    selectedNode,
    selectedErrors,
    selectedUnresolvedReferences,
    selectedReferencedComponents,
    selectedReferencingComponents,
    selectedTriggerLogicTypes,
    selectedActionLogicTypes,
    selectedConditionalLogicTypes,
    selectedOtherLogicTypes,
    renderHighlightedText,
}) => {
    if (!selectedNode) {
        return (
            <p className="empty-state">Select a component to view details.</p>
        );
    }

    const directLinks =
        (selectedNode.analysis?.directIncoming ?? 0) +
        (selectedNode.analysis?.directOutgoing ?? 0);
    const childLinks = Math.max(
        0,
        (selectedNode.analysis?.totalConnections ?? 0) - directLinks,
    );

    return (
        <>
            <div className="component-tree-detail-header">
                <div className="component-tree-detail-title">
                    <h4>{selectedNode.label}</h4>
                    <div className="component-tree-detail-badges">
                        <span className="badge type-tag">
                            {selectedNode.type}
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
                </div>
                <dl className="component-tree-detail-kv">
                    {selectedNode.key ? (
                        <div className="component-tree-detail-kv-row">
                            <dt>key</dt>
                            <dd>{selectedNode.key}</dd>
                        </div>
                    ) : null}
                    <div className="component-tree-detail-kv-row">
                        <dt>schema path</dt>
                        <dd>
                            {selectedNode.schemaPathDisplay || selectedNode.id}
                        </dd>
                    </div>
                    {selectedNode.schemaPath &&
                    selectedNode.schemaPath !==
                        selectedNode.schemaPathDisplay ? (
                        <div className="component-tree-detail-kv-row">
                            <dt>raw path</dt>
                            <dd>{selectedNode.schemaPath}</dd>
                        </div>
                    ) : null}
                    <div className="component-tree-detail-kv-row">
                        <dt>data path</dt>
                        <dd>{selectedNode.dataPath || "not mapped"}</dd>
                    </div>
                </dl>
            </div>
            {selectedNode.logicTypes?.length ? (
                <div className="component-tree-detail-section">
                    <h5>Configured logic</h5>
                    <div className="component-tree-detail-stats">
                        {selectedTriggerLogicTypes.length ? (
                            <span className="meta">
                                trigger: {selectedTriggerLogicTypes.join(", ")}
                            </span>
                        ) : null}
                        {selectedActionLogicTypes.length ? (
                            <span className="meta">
                                action: {selectedActionLogicTypes.join(", ")}
                            </span>
                        ) : null}
                        {selectedConditionalLogicTypes.length ? (
                            <span className="meta">
                                conditional:{" "}
                                {selectedConditionalLogicTypes.join(", ")}
                            </span>
                        ) : null}
                        {selectedOtherLogicTypes.length ? (
                            <span className="meta">
                                other: {selectedOtherLogicTypes.join(", ")}
                            </span>
                        ) : null}
                    </div>

                    {(selectedNode.logicDetails ?? []).map((logicDetail) => {
                        const componentReferences = (
                            logicDetail.references ?? []
                        )
                            .filter((reference) =>
                                reference.startsWith("component:"),
                            )
                            .map((reference) =>
                                reference.slice("component:".length),
                            );

                        const dataReferences = (logicDetail.references ?? [])
                            .filter((reference) =>
                                reference.startsWith("data:"),
                            )
                            .map((reference) =>
                                reference.slice("data:".length),
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
                                    <span className="meta">type of logic</span>
                                    <div className="component-tree-detail-stats">
                                        <span className="meta">
                                            trigger: {logicDetail.triggerType}
                                        </span>
                                        {logicDetail.actionTypes?.length ? (
                                            <span className="meta">
                                                actions:{" "}
                                                {logicDetail.actionTypes.join(
                                                    ", ",
                                                )}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="logic-source-block">
                                    <span className="meta">how configured</span>
                                    {logicDetail.sources?.length ? (
                                        logicDetail.sources.map(
                                            (source, index) => (
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
                                            No explicit source expression
                                            configured.
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
                                                (componentReference) => (
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
                                        <span className="meta">None</span>
                                    )}

                                    {dataReferences.length ? (
                                        <div className="component-tree-detail-stats">
                                            <span className="meta">
                                                form data:{" "}
                                                {dataReferences.join(", ")}
                                            </span>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : null}
            <div className="component-tree-detail-section">
                <h5>Summary</h5>
                <div className="component-tree-detail-stats">
                    <span className="badge issue-tag">
                        total errors: {selectedNode.analysis?.totalErrors ?? 0}
                    </span>
                    <span className="badge connection-tag">
                        direct links: {directLinks}
                    </span>
                    {childLinks > 0 ? (
                        <span className="badge connection-tag">
                            child links: {childLinks}
                        </span>
                    ) : null}
                    <span className="badge unresolved-tag">
                        unresolved out:{" "}
                        {selectedNode.analysis?.totalUnresolvedOutgoing ?? 0}
                    </span>
                </div>
            </div>
            <div className="component-tree-detail-section">
                <h5>Direct errors</h5>
                {selectedErrors.length ? (
                    <ul className="component-tree-detail-list">
                        {selectedErrors.map((error, index) => (
                            <li key={`${selectedNode.id}-${index}`}>
                                {error.message}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="empty-state">No direct errors.</p>
                )}
            </div>
            <div className="component-tree-detail-section">
                <h5>Components referencing this</h5>
                {selectedReferencingComponents.length ? (
                    <ul className="component-tree-detail-list">
                        {selectedReferencingComponents.map((connection) => (
                            <li
                                key={`${selectedNode.id}-incoming-${connection.id}`}
                            >
                                <span className="detail-list-title">
                                    {connection.sourceDataPath ||
                                        connection.sourceKey ||
                                        connection.sourceSchemaPathDisplay ||
                                        connection.sourcePath}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="empty-state">No incoming references.</p>
                )}
            </div>
            <div className="component-tree-detail-section">
                <h5>Components referenced by this</h5>
                {selectedReferencedComponents.length ? (
                    <ul className="component-tree-detail-list">
                        {selectedReferencedComponents.map((connection) => (
                            <li
                                key={`${selectedNode.id}-outgoing-${connection.id}`}
                            >
                                <span className="detail-list-title">
                                    {connection.targetDataPath ||
                                        connection.targetKey ||
                                        connection.targetSchemaPathDisplay ||
                                        connection.targetPath}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="empty-state">No outgoing references.</p>
                )}
            </div>
            <div className="component-tree-detail-section">
                <h5>Unresolved references</h5>
                {selectedUnresolvedReferences.length ? (
                    <ul className="component-tree-detail-list">
                        {selectedUnresolvedReferences.map(
                            (connection, index) => (
                                <li
                                    key={`${selectedNode.id}-${connection.targetKey}-${index}`}
                                >
                                    <span className="detail-list-title">
                                        {connection.targetKey}
                                    </span>
                                    <span className="detail-list-meta">
                                        ({connection.connectionType})
                                    </span>
                                    <span className="detail-list-context">
                                        at {connection.context}
                                    </span>
                                </li>
                            ),
                        )}
                    </ul>
                ) : (
                    <p className="empty-state">No unresolved references.</p>
                )}
            </div>
        </>
    );
};

export default ComponentDetails;
