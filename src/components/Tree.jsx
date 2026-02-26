const TreeNode = ({ node }) => {
    return (
        <li>
            <div className="tree-node">
                <div>
                    <span className="tree-label">{node.label}</span>
                    <span className="tree-meta">
                        <span className="badge">{node.type}</span>
                        {node.key ? (
                            <span className="meta">key: {node.key}</span>
                        ) : null}
                    </span>
                </div>
            </div>
            {node.children.length > 0 ? (
                <ul>
                    {node.children.map((child) => (
                        <TreeNode key={child.id} node={child} />
                    ))}
                </ul>
            ) : null}
        </li>
    );
};

const Tree = ({ nodes }) => {
    if (!nodes.length) {
        return (
            <p className="empty-state">
                Run analysis to see the component tree.
            </p>
        );
    }

    return (
        <ul className="tree">
            {nodes.map((node) => (
                <TreeNode key={node.id} node={node} />
            ))}
        </ul>
    );
};

export default Tree;
