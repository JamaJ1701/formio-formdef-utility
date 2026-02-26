import { useState } from "react";
import "./App.css";
import Tree from "./components/Tree";
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
                        {analysis?.stats ? (
                            <div className="stats">
                                <span className="stat">
                                    {analysis.stats.total} components
                                </span>
                                <span className="stat">
                                    display: {analysis.stats.display}
                                </span>
                                <span className="stat">
                                    connections:{" "}
                                    {analysis.stats.totalConnections ?? 0}
                                </span>
                                <span className="stat">
                                    connection types:{" "}
                                    {analysis.stats.connectionTypes ?? 0}
                                </span>
                            </div>
                        ) : null}
                    </div>

                    <div className="panel-body">
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

                        <div className="tree-wrap">
                            <h3>Component tree</h3>
                            <Tree nodes={analysis?.tree ?? []} />
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
