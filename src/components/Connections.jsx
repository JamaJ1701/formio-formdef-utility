const ConnectionItem = ({ connection }) => {
    return (
        <li className="connection-item">
            <div className="connection-route">
                <span className="connection-node">
                    {connection.sourceLabel}
                </span>
                <span className="connection-arrow">→</span>
                <span className="connection-node">
                    {connection.targetLabel}
                </span>
            </div>
            <div className="connection-meta">
                <span className="badge">{connection.connectionType}</span>
                <span className="meta">
                    source key: {connection.sourceKey || "-"}
                </span>
                <span className="meta">target key: {connection.targetKey}</span>
                <span className="meta">via: {connection.context}</span>
            </div>
        </li>
    );
};

const UnresolvedItem = ({ connection }) => {
    return (
        <li className="unresolved-item">
            <div className="connection-route">
                <span className="connection-node">
                    {connection.sourceLabel}
                </span>
                <span className="connection-arrow">→</span>
                <span className="connection-node">{connection.targetKey}</span>
            </div>
            <div className="connection-meta">
                <span className="badge">{connection.connectionType}</span>
                <span className="meta">unresolved key</span>
                <span className="meta">via: {connection.context}</span>
            </div>
        </li>
    );
};

const groupByType = (connections) => {
    return connections.reduce((accumulator, connection) => {
        const type = connection.connectionType;
        if (!accumulator[type]) {
            accumulator[type] = [];
        }
        accumulator[type].push(connection);
        return accumulator;
    }, {});
};

const Connections = ({ connections, unresolvedConnections }) => {
    if (!connections.length && !unresolvedConnections.length) {
        return (
            <p className="empty-state">
                Run analysis to see detected component connections.
            </p>
        );
    }

    const grouped = groupByType(connections);

    return (
        <div className="connections-wrap">
            {Object.entries(grouped).map(([type, items]) => (
                <div key={type} className="connection-group">
                    <h4>
                        {type} <span className="meta">({items.length})</span>
                    </h4>
                    <ul>
                        {items.map((connection) => (
                            <ConnectionItem
                                key={connection.id}
                                connection={connection}
                            />
                        ))}
                    </ul>
                </div>
            ))}

            {unresolvedConnections.length ? (
                <div className="connection-group unresolved-group">
                    <h4>
                        unresolved references{" "}
                        <span className="meta">
                            ({unresolvedConnections.length})
                        </span>
                    </h4>
                    <ul>
                        {unresolvedConnections.map((connection, index) => (
                            <UnresolvedItem
                                key={`${connection.sourcePath}-${connection.targetKey}-${index}`}
                                connection={connection}
                            />
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
};

export default Connections;
