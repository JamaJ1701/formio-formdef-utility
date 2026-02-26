import { useState } from "react";
import "./App.css";
import TreeDiagram from "./components/TreeDiagram";
import Connections from "./components/Connections";
import sampleJson from "./data/sampleJson";
import { analyzeDefinition } from "./utils/analyzeDefinition";

function App() {
    const [formJson, setFormJson] = useState("");
    const [analysis, setAnalysis] = useState(null);
    const [isFormCollapsed, setIsFormCollapsed] = useState(false);
    const [isErrorsCollapsed, setIsErrorsCollapsed] = useState(false);
    const [isUnresolvedCollapsed, setIsUnresolvedCollapsed] = useState(false);
    const [isConnectionsCollapsed, setIsConnectionsCollapsed] = useState(false);

    const hasFormJson = formJson.trim().length > 0;

    const handleAnalyze = () => {
        setAnalysis(analyzeDefinition(formJson));
    };

    const handleClear = () => {
        setFormJson("");
        setAnalysis(null);
        setIsFormCollapsed(false);
        setIsErrorsCollapsed(false);
        setIsUnresolvedCollapsed(false);
        setIsConnectionsCollapsed(false);
    };

    const summaryRows = analysis
        ? [
              { label: "Components", value: analysis.stats?.total ?? 0 },
              {
                  label: "Display",
                  value: analysis.stats?.display ?? "unknown",
              },
              {
                  label: "Connections",
                  value: analysis.stats?.totalConnections ?? 0,
              },
              {
                  label: "Connection types",
                  value: analysis.stats?.connectionTypes ?? 0,
              },
              {
                  label: "Unresolved",
                  value: analysis.unresolvedConnections?.length ?? 0,
              },
              { label: "Errors", value: analysis.errors?.length ?? 0 },
          ]
        : [];

    return (
        <div className="app">
            <header className="header">
                <p className="eyebrow">Form Definition Utility</p>
                <h1 className="title">Formio Definition Analyzer</h1>
                <p className="subtitle">
                    Paste a JSON form definition, inspect the component tree,
                    and catch configuration issues before they ship.
                </p>
            </header>

            <div className="grid">
                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Form definition</h2>
                            <p className="panel-caption">
                                Copy and paste raw JSON below.
                            </p>
                        </div>
                        <div className="actions">
                            <button
                                className="btn"
                                type="button"
                                onClick={handleClear}
                            >
                                Clear
                            </button>
                            <button
                                className="btn primary"
                                type="button"
                                onClick={handleAnalyze}
                            >
                                Analyze
                            </button>
                            {hasFormJson ? (
                                <button
                                    className="btn"
                                    type="button"
                                    onClick={() =>
                                        setIsFormCollapsed((value) => !value)
                                    }
                                    aria-expanded={!isFormCollapsed}
                                    aria-controls="form-definition-input"
                                >
                                    {isFormCollapsed ? "Expand" : "Collapse"}
                                </button>
                            ) : null}
                        </div>
                    </div>
                    {isFormCollapsed ? (
                        <p className="collapsed-message">
                            Form definition entered. Expand to edit.
                        </p>
                    ) : (
                        <textarea
                            id="form-definition-input"
                            className="json-input"
                            value={formJson}
                            onChange={(event) =>
                                setFormJson(event.target.value)
                            }
                            placeholder={sampleJson}
                            spellCheck={false}
                        />
                    )}
                </section>

                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Analysis</h2>
                            <p className="panel-caption">
                                Errors and component map.
                            </p>
                        </div>
                    </div>

                    <div className="panel-body">
                        {summaryRows.length ? (
                            <div
                                className="analysis-summary"
                                role="region"
                                aria-label="Analysis summary"
                            >
                                <table className="analysis-summary-table">
                                    <tbody>
                                        {summaryRows.map((row) => (
                                            <tr key={row.label}>
                                                <th scope="row">{row.label}</th>
                                                <td>{row.value}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : null}

                        <div className="tree-wrap">
                            <h3>Component diagram</h3>
                            <TreeDiagram
                                nodes={analysis?.tree ?? []}
                                connections={analysis?.connections ?? []}
                            />
                        </div>

                        <div className="errors">
                            <div className="section-head">
                                <h3>Errors</h3>
                                <button
                                    className="section-toggle"
                                    type="button"
                                    onClick={() =>
                                        setIsErrorsCollapsed((value) => !value)
                                    }
                                    aria-expanded={!isErrorsCollapsed}
                                    aria-controls="errors-section-content"
                                    aria-label={
                                        isErrorsCollapsed
                                            ? "Expand errors section"
                                            : "Collapse errors section"
                                    }
                                    title={
                                        isErrorsCollapsed
                                            ? "Expand errors section"
                                            : "Collapse errors section"
                                    }
                                >
                                    <span aria-hidden="true">
                                        {isErrorsCollapsed ? "▸" : "▾"}
                                    </span>
                                </button>
                            </div>
                            {!isErrorsCollapsed ? (
                                analysis?.errors?.length ? (
                                    <ul id="errors-section-content">
                                        {analysis.errors.map((error, index) => (
                                            <li
                                                key={`${error.path}-${index}`}
                                                className="error-item"
                                            >
                                                <span className="error-path">
                                                    {error.path}
                                                </span>
                                                <span className="error-message">
                                                    {error.message}
                                                </span>
                                                {error.locators?.length ? (
                                                    <div className="locator-meta">
                                                        {error.locators.map(
                                                            (
                                                                locator,
                                                                locatorIndex,
                                                            ) => (
                                                                <span
                                                                    key={`${error.path}-${index}-locator-${locatorIndex}`}
                                                                    className="meta"
                                                                >
                                                                    locate:{" "}
                                                                    {
                                                                        locator.label
                                                                    }
                                                                    {locator.key
                                                                        ? ` (key ${locator.key})`
                                                                        : ""}
                                                                    , type{" "}
                                                                    {
                                                                        locator.type
                                                                    }
                                                                    , schema{" "}
                                                                    {
                                                                        locator.schemaPath
                                                                    }
                                                                    {locator.dataPath
                                                                        ? `, data ${locator.dataPath}`
                                                                        : ""}
                                                                </span>
                                                            ),
                                                        )}
                                                    </div>
                                                ) : null}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p
                                        id="errors-section-content"
                                        className="empty-state"
                                    >
                                        No errors found yet.
                                    </p>
                                )
                            ) : null}
                        </div>

                        <div className="connections">
                            <div className="section-head">
                                <h3>Unresolved</h3>
                                <button
                                    className="section-toggle"
                                    type="button"
                                    onClick={() =>
                                        setIsUnresolvedCollapsed(
                                            (value) => !value,
                                        )
                                    }
                                    aria-expanded={!isUnresolvedCollapsed}
                                    aria-controls="unresolved-section-content"
                                    aria-label={
                                        isUnresolvedCollapsed
                                            ? "Expand unresolved section"
                                            : "Collapse unresolved section"
                                    }
                                    title={
                                        isUnresolvedCollapsed
                                            ? "Expand unresolved section"
                                            : "Collapse unresolved section"
                                    }
                                >
                                    <span aria-hidden="true">
                                        {isUnresolvedCollapsed ? "▸" : "▾"}
                                    </span>
                                </button>
                            </div>
                            {!isUnresolvedCollapsed ? (
                                analysis?.unresolvedConnections?.length ? (
                                    <ul id="unresolved-section-content">
                                        {analysis.unresolvedConnections.map(
                                            (connection, index) => (
                                                <li
                                                    key={`${connection.sourcePath}-${connection.targetKey}-${index}`}
                                                    className="unresolved-item"
                                                >
                                                    <div className="connection-route">
                                                        <span className="connection-node">
                                                            {
                                                                connection.sourceLabel
                                                            }
                                                        </span>
                                                        <span className="connection-arrow">
                                                            →
                                                        </span>
                                                        <span className="connection-node">
                                                            {
                                                                connection.targetKey
                                                            }
                                                        </span>
                                                    </div>
                                                    <div className="connection-meta">
                                                        <span className="badge">
                                                            {
                                                                connection.connectionType
                                                            }
                                                        </span>
                                                        <span className="meta">
                                                            unresolved key
                                                        </span>
                                                        <span className="meta">
                                                            configured at rule
                                                            field (schema path):{" "}
                                                            {connection.context}
                                                        </span>
                                                    </div>
                                                    <div className="locator-meta">
                                                        <span className="meta">
                                                            locate source:{" "}
                                                            {
                                                                connection.sourceLabel
                                                            }
                                                            {connection.sourceKey
                                                                ? ` (key ${connection.sourceKey})`
                                                                : ""}
                                                            , type{" "}
                                                            {
                                                                connection.sourceType
                                                            }
                                                            , schema{" "}
                                                            {
                                                                connection.sourceSchemaPath
                                                            }
                                                            {connection.sourceDataPath
                                                                ? `, data ${connection.sourceDataPath}`
                                                                : ""}
                                                        </span>
                                                    </div>
                                                </li>
                                            ),
                                        )}
                                    </ul>
                                ) : (
                                    <p
                                        id="unresolved-section-content"
                                        className="empty-state"
                                    >
                                        No unresolved references found.
                                    </p>
                                )
                            ) : null}
                        </div>

                        <div className="connections">
                            <div className="section-head">
                                <h3>Connections</h3>
                                <button
                                    className="section-toggle"
                                    type="button"
                                    onClick={() =>
                                        setIsConnectionsCollapsed(
                                            (value) => !value,
                                        )
                                    }
                                    aria-expanded={!isConnectionsCollapsed}
                                    aria-controls="connections-section-content"
                                    aria-label={
                                        isConnectionsCollapsed
                                            ? "Expand connections section"
                                            : "Collapse connections section"
                                    }
                                    title={
                                        isConnectionsCollapsed
                                            ? "Expand connections section"
                                            : "Collapse connections section"
                                    }
                                >
                                    <span aria-hidden="true">
                                        {isConnectionsCollapsed ? "▸" : "▾"}
                                    </span>
                                </button>
                            </div>
                            {!isConnectionsCollapsed ? (
                                <div id="connections-section-content">
                                    <Connections
                                        connections={
                                            analysis?.connections ?? []
                                        }
                                    />
                                </div>
                            ) : null}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

export default App;
