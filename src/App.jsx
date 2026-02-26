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

    const hasFormJson = formJson.trim().length > 0;

    const handleAnalyze = () => {
        setAnalysis(analyzeDefinition(formJson));
    };

    const handleClear = () => {
        setFormJson("");
        setAnalysis(null);
        setIsFormCollapsed(false);
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
                            <h3>Errors</h3>
                            {analysis?.errors?.length ? (
                                <ul>
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
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="empty-state">
                                    No errors found yet.
                                </p>
                            )}
                        </div>

                        <div className="connections">
                            <h3>Connections</h3>
                            <Connections
                                connections={analysis?.connections ?? []}
                                unresolvedConnections={
                                    analysis?.unresolvedConnections ?? []
                                }
                            />
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

export default App;
