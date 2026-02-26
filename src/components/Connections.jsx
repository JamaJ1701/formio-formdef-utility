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
                <span className="meta">
                    rule field (schema path): {connection.context}
                </span>
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

const Connections = ({ connections }) => {
    if (!connections.length) {
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
        </div>
    );
};

export default Connections;
