import { useMemo } from "react";
import { ReactFlow, Background, Controls, MarkerType } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const NODE_MIN_WIDTH = 200;
const NODE_MAX_WIDTH = 420;
const NODE_HEIGHT = 84;
const HORIZONTAL_GAP = 56;
const COLUMN_WIDTH = NODE_MAX_WIDTH + HORIZONTAL_GAP;
const ROOT_GAP = 28;
const SIBLING_GAP = 14;
const FRAME_PADDING_LEFT = 16;
const FRAME_PADDING_RIGHT = 16;
const FRAME_PADDING_Y = 20;
const FRAME_HEADER_HEIGHT = 64;
const FRAME_DETAIL_LINE_HEIGHT = 18;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const estimateWidthFromText = (text) => {
    const normalized = String(text ?? "").trim();
    const length = normalized.length;
    return length * 7.4 + 72;
};

const isContainerNode = (node) =>
    Array.isArray(node?.children) && node.children.length > 0;

const formatTopTypeCounts = (counts, limit = 2) => {
    const entries = Object.entries(counts ?? {});
    if (!entries.length) {
        return "";
    }

    const sorted = entries
        .sort((left, right) => right[1] - left[1])
        .slice(0, limit)
        .map(([type, count]) => `${type}(${count})`)
        .join(", ");

    return sorted;
};

const TreeDiagramNode = ({ data }) => {
    const directIncoming = data.analysis?.directIncoming ?? 0;
    const directOutgoing = data.analysis?.directOutgoing ?? 0;
    const directErrors = data.analysis?.directErrors ?? 0;
    const totalErrors = data.analysis?.totalErrors ?? 0;
    const totalConnections = data.analysis?.totalConnections ?? 0;
    const totalUnresolvedOutgoing = data.analysis?.totalUnresolvedOutgoing ?? 0;
    const incomingTypeSummary = formatTopTypeCounts(
        data.analysis?.totalIncomingTypeCounts,
    );
    const outgoingTypeSummary = formatTopTypeCounts(
        data.analysis?.totalOutgoingTypeCounts,
    );

    return (
        <div className="diagram-node">
            <span className="diagram-node-label">{data.label}</span>
            <span className="diagram-node-meta">
                <span className="badge">{data.type}</span>
                {data.key ? (
                    <span className="meta">key: {data.key}</span>
                ) : null}
                {data.hasCustomConditional ? (
                    <span className="badge conditional-tag">
                        custom conditional
                    </span>
                ) : null}
                {totalErrors > 0 ? (
                    <span className="badge issue-tag">
                        errors: {totalErrors}
                    </span>
                ) : null}
                {totalConnections > 0 ? (
                    <span className="badge connection-tag">
                        links: {totalConnections}
                    </span>
                ) : null}
                {directIncoming + directOutgoing > 0 ? (
                    <span className="badge connection-tag">
                        in/out: {directIncoming}/{directOutgoing}
                    </span>
                ) : null}
                {totalUnresolvedOutgoing > 0 ? (
                    <span className="badge unresolved-tag">
                        unresolved: {totalUnresolvedOutgoing}
                    </span>
                ) : null}
                {directErrors > 0 ? (
                    <span className="badge issue-tag">
                        direct errors: {directErrors}
                    </span>
                ) : null}
            </span>
            {incomingTypeSummary ? (
                <span className="diagram-analysis-detail">
                    incoming types: {incomingTypeSummary}
                </span>
            ) : null}
            {outgoingTypeSummary ? (
                <span className="diagram-analysis-detail">
                    outgoing types: {outgoingTypeSummary}
                </span>
            ) : null}
        </div>
    );
};

const PageFrameNode = ({ data }) => {
    const directIncoming = data.analysis?.directIncoming ?? 0;
    const directOutgoing = data.analysis?.directOutgoing ?? 0;
    const directErrors = data.analysis?.directErrors ?? 0;
    const totalErrors = data.analysis?.totalErrors ?? 0;
    const totalConnections = data.analysis?.totalConnections ?? 0;
    const totalUnresolvedOutgoing = data.analysis?.totalUnresolvedOutgoing ?? 0;
    const incomingTypeSummary = formatTopTypeCounts(
        data.analysis?.totalIncomingTypeCounts,
    );
    const outgoingTypeSummary = formatTopTypeCounts(
        data.analysis?.totalOutgoingTypeCounts,
    );

    return (
        <div className="diagram-frame">
            <span className="diagram-frame-title">{data.label}</span>
            <span className="diagram-frame-meta">
                <span className="badge">{data.type}</span>
                {data.key ? (
                    <span className="meta">key: {data.key}</span>
                ) : null}
                {data.hasCustomConditional ? (
                    <span className="badge conditional-tag">
                        custom conditional
                    </span>
                ) : null}
                {totalErrors > 0 ? (
                    <span className="badge issue-tag">
                        errors: {totalErrors}
                    </span>
                ) : null}
                {totalConnections > 0 ? (
                    <span className="badge connection-tag">
                        links: {totalConnections}
                    </span>
                ) : null}
                {directIncoming + directOutgoing > 0 ? (
                    <span className="badge connection-tag">
                        in/out: {directIncoming}/{directOutgoing}
                    </span>
                ) : null}
                {totalUnresolvedOutgoing > 0 ? (
                    <span className="badge unresolved-tag">
                        unresolved: {totalUnresolvedOutgoing}
                    </span>
                ) : null}
                {directErrors > 0 ? (
                    <span className="badge issue-tag">
                        direct errors: {directErrors}
                    </span>
                ) : null}
            </span>
            {incomingTypeSummary ? (
                <span className="diagram-analysis-detail">
                    incoming types: {incomingTypeSummary}
                </span>
            ) : null}
            {outgoingTypeSummary ? (
                <span className="diagram-analysis-detail">
                    outgoing types: {outgoingTypeSummary}
                </span>
            ) : null}
        </div>
    );
};

const nodeTypes = {
    treeNode: TreeDiagramNode,
    pageFrame: PageFrameNode,
};

const buildFlowGraph = (tree, connections = []) => {
    const nodes = [];
    const edges = [];
    const pathToDiagramId = new Map();
    const edgeIds = new Set();

    const heightCache = new Map();
    const widthCache = new Map();
    const subtreeWidthCache = new Map();
    const frameHeaderHeightCache = new Map();

    const getNodeWidth = (node) => {
        if (widthCache.has(node.id)) {
            return widthCache.get(node.id);
        }

        const labelWidth = estimateWidthFromText(node.label);
        const typeWidth = estimateWidthFromText(node.type);
        const keyWidth = node.key
            ? estimateWidthFromText(`key: ${node.key}`)
            : 0;
        const conditionalWidth = node.hasCustomConditional
            ? estimateWidthFromText("custom conditional")
            : 0;
        const errorWidth =
            (node.analysis?.totalErrors ?? 0) > 0
                ? estimateWidthFromText(`errors: ${node.analysis.totalErrors}`)
                : 0;
        const linksWidth =
            (node.analysis?.totalConnections ?? 0) > 0
                ? estimateWidthFromText(
                      `links: ${node.analysis.totalConnections}`,
                  )
                : 0;
        const unresolvedWidth =
            (node.analysis?.totalUnresolvedOutgoing ?? 0) > 0
                ? estimateWidthFromText(
                      `unresolved: ${node.analysis.totalUnresolvedOutgoing}`,
                  )
                : 0;
        const inOutWidth =
            (node.analysis?.directIncoming ?? 0) +
                (node.analysis?.directOutgoing ?? 0) >
            0
                ? estimateWidthFromText(
                      `in/out: ${node.analysis.directIncoming}/${node.analysis.directOutgoing}`,
                  )
                : 0;
        const incomingTypesWidth = node.analysis?.totalIncomingTypeCounts
            ? estimateWidthFromText(
                  `incoming types: ${formatTopTypeCounts(node.analysis.totalIncomingTypeCounts)}`,
              )
            : 0;
        const outgoingTypesWidth = node.analysis?.totalOutgoingTypeCounts
            ? estimateWidthFromText(
                  `outgoing types: ${formatTopTypeCounts(node.analysis.totalOutgoingTypeCounts)}`,
              )
            : 0;

        const width = clamp(
            Math.max(
                labelWidth,
                typeWidth,
                keyWidth,
                conditionalWidth,
                errorWidth,
                linksWidth,
                unresolvedWidth,
                inOutWidth,
                incomingTypesWidth,
                outgoingTypesWidth,
            ),
            NODE_MIN_WIDTH,
            NODE_MAX_WIDTH,
        );

        widthCache.set(node.id, width);
        return width;
    };

    const getNodeHeight = (node) => {
        if (heightCache.has(node.id)) {
            return heightCache.get(node.id);
        }

        let height = NODE_HEIGHT;

        if (isContainerNode(node)) {
            const childrenHeight = node.children.reduce(
                (total, child, index) => {
                    const next = total + getNodeHeight(child);
                    return index < node.children.length - 1
                        ? next + SIBLING_GAP
                        : next;
                },
                0,
            );

            const headerHeight = getFrameHeaderHeight(node);

            height =
                headerHeight +
                FRAME_PADDING_Y * 2 +
                Math.max(childrenHeight, NODE_HEIGHT);
        }

        heightCache.set(node.id, height);
        return height;
    };

    const getSubtreeWidth = (node) => {
        if (subtreeWidthCache.has(node.id)) {
            return subtreeWidthCache.get(node.id);
        }

        const ownWidth = getNodeWidth(node);

        if (!isContainerNode(node)) {
            subtreeWidthCache.set(node.id, ownWidth);
            return ownWidth;
        }

        const childWidth = Math.max(
            0,
            ...node.children.map(
                (child) => HORIZONTAL_GAP + getSubtreeWidth(child),
            ),
        );

        const width = Math.max(ownWidth, FRAME_PADDING_LEFT + childWidth);
        subtreeWidthCache.set(node.id, width);
        return width;
    };

    const getFrameHeaderHeight = (node) => {
        if (frameHeaderHeightCache.has(node.id)) {
            return frameHeaderHeightCache.get(node.id);
        }

        let detailLines = 0;

        if (formatTopTypeCounts(node.analysis?.totalIncomingTypeCounts)) {
            detailLines += 1;
        }

        if (formatTopTypeCounts(node.analysis?.totalOutgoingTypeCounts)) {
            detailLines += 1;
        }

        const headerHeight =
            FRAME_HEADER_HEIGHT + detailLines * FRAME_DETAIL_LINE_HEIGHT;
        frameHeaderHeightCache.set(node.id, headerHeight);
        return headerHeight;
    };

    const getRenderedNodeWidth = (node) => {
        const nodeWidth = getNodeWidth(node);

        if (!isContainerNode(node)) {
            return nodeWidth;
        }

        const innerWidth = getSubtreeWidth(node);
        return Math.max(
            innerWidth + FRAME_PADDING_RIGHT,
            nodeWidth + FRAME_PADDING_LEFT + FRAME_PADDING_RIGHT,
        );
    };

    const visit = (node, depth, top, parentId, xOffset) => {
        const isContainer = isContainerNode(node);
        const height = getNodeHeight(node);
        const nodeWidth = getNodeWidth(node);
        const id = isContainer ? `frame-${node.id}` : node.id;
        const x = xOffset + depth * COLUMN_WIDTH;

        pathToDiagramId.set(node.id, id);

        if (isContainer) {
            const frameWidth = getRenderedNodeWidth(node);

            nodes.push({
                id,
                type: "pageFrame",
                position: {
                    x,
                    y: top,
                },
                data: {
                    label: node.label,
                    type: node.type,
                    key: node.key,
                    hasCustomConditional: node.hasCustomConditional,
                    analysis: node.analysis,
                },
                style: {
                    width: frameWidth,
                    height,
                },
                draggable: false,
                connectable: false,
                selectable: false,
                zIndex: -1,
            });
        } else {
            const y = top + height / 2 - NODE_HEIGHT / 2;
            nodes.push({
                id,
                type: "treeNode",
                position: {
                    x,
                    y,
                },
                data: {
                    label: node.label,
                    type: node.type,
                    key: node.key,
                    hasCustomConditional: node.hasCustomConditional,
                    analysis: node.analysis,
                },
                style: {
                    width: nodeWidth,
                    minHeight: NODE_HEIGHT,
                },
                draggable: false,
                connectable: false,
                selectable: true,
                zIndex: 2,
            });
        }

        if (parentId) {
            const hierarchyEdgeId = `${parentId}=>${id}`;
            if (!edgeIds.has(hierarchyEdgeId)) {
                edgeIds.add(hierarchyEdgeId);
                edges.push({
                    id: hierarchyEdgeId,
                    source: parentId,
                    target: id,
                    type: "smoothstep",
                    animated: false,
                    selectable: false,
                });
            }
        }

        if (isContainer) {
            let childTop = top + FRAME_HEADER_HEIGHT + FRAME_PADDING_Y;
            const headerHeight = getFrameHeaderHeight(node);
            childTop = top + headerHeight + FRAME_PADDING_Y;
            node.children.forEach((child, index) => {
                const childHeight = getNodeHeight(child);
                visit(
                    child,
                    depth + 1,
                    childTop,
                    id,
                    xOffset - COLUMN_WIDTH + FRAME_PADDING_LEFT,
                );
                childTop += childHeight;
                if (index < node.children.length - 1) {
                    childTop += SIBLING_GAP;
                }
            });
        }

        return height;
    };

    let left = 0;
    tree.forEach((rootNode) => {
        const rootWidth = getRenderedNodeWidth(rootNode);
        visit(rootNode, 0, 0, null, left);
        left += rootWidth + ROOT_GAP;
    });

    connections.forEach((connection) => {
        const sourceId = pathToDiagramId.get(connection.sourcePath);
        const targetId = pathToDiagramId.get(connection.targetPath);

        if (!sourceId || !targetId) {
            return;
        }

        const connectionEdgeId = `connection:${connection.id}`;
        if (edgeIds.has(connectionEdgeId)) {
            return;
        }

        edgeIds.add(connectionEdgeId);
        edges.push({
            id: connectionEdgeId,
            source: sourceId,
            target: targetId,
            type: "smoothstep",
            animated: true,
            selectable: true,
            zIndex: 20,
            className: "diagram-connection-edge",
            style: {
                stroke: "var(--accent-600)",
                strokeWidth: 2,
            },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 18,
                height: 18,
                color: "var(--accent-600)",
            },
            label: connection.connectionType,
            labelBgPadding: [6, 3],
            labelBgBorderRadius: 6,
            labelStyle: {
                fontSize: 11,
                fill: "var(--ink-700)",
                fontWeight: 600,
            },
            data: {
                connectionType: connection.connectionType,
                context: connection.context,
            },
        });
    });

    return { nodes, edges };
};

const TreeDiagram = ({ nodes, connections }) => {
    const graph = useMemo(
        () => buildFlowGraph(nodes, connections),
        [nodes, connections],
    );

    if (!nodes.length) {
        return (
            <p className="empty-state">
                Run analysis to see the component diagram.
            </p>
        );
    }

    return (
        <div className="diagram-shell">
            <ReactFlow
                nodes={graph.nodes}
                edges={graph.edges}
                nodeTypes={nodeTypes}
                defaultEdgeOptions={{ zIndex: 10 }}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable
                proOptions={{ hideAttribution: true }}
                minZoom={0.2}
                maxZoom={1.4}
            >
                <Controls showInteractive={false} />
                <Background gap={20} size={1} />
            </ReactFlow>
        </div>
    );
};

export default TreeDiagram;
