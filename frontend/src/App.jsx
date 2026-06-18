import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle2,
  Download, Sparkles, RefreshCw, Layers,
  Trash2, ShieldCheck, HelpCircle, FileText, Cpu
} from 'lucide-react';

export default function App() {


  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [countryCode, setCountryCode] = useState('IN');
  const [validationResult, setValidationResult] = useState(null);
  const [filterMode, setFilterMode] = useState('all');
  const [selectedRow, setSelectedRow] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);


  const [chunkSize, setChunkSize] = useState('100');
  const [splitting, setSplitting] = useState(false);


  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch('/api/validate')
      .catch(e => console.log("Backend offline or local dev fallback."));
  }, []);

  const handleFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setValidationResult(null);
      setSelectedRow(null);
      setAiSuggestions(null);
    }
  };

  const uploadAndValidate = async () => {
    if (!file) return;
    setUploading(true);
    setValidationResult(null);
    setSelectedRow(null);
    setAiSuggestions(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('countryCode', countryCode);

    try {
      const response = await fetch('http://localhost:5000/api/validate', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (response.ok) {
        setValidationResult(data);


      } else {
        alert(data.error || 'Failed to validate file');
      }
    } catch (error) {
      alert('Error connecting to backend server. Make sure node backend is running on port 5000.');
    } finally {
      setUploading(false);
    }
  };

  const handleCleanData = () => {
    if (!validationResult) return;


    const cleanedValid = [...validationResult.validRows];
    const cleanedInvalid = validationResult.invalidRows.map(row => {
      return {
        ...row,
        errors: [],
        isValid: true,
        original: { ...row.cleaned }
      };
    });

    const newValidRows = [...cleanedValid, ...cleanedInvalid].sort((a, b) => a.rowIndex - b.rowIndex);

    setValidationResult({
      ...validationResult,
      validCount: newValidRows.length,
      invalidCount: 0,
      validRows: newValidRows,
      invalidRows: []
    });


    setSelectedRow(null);
    setAiSuggestions(null);
  };

  const handleDownloadCleaned = () => {
    if (!validationResult) return;

    const allRows = [...validationResult.validRows, ...validationResult.invalidRows]
      .sort((a, b) => a.rowIndex - b.rowIndex)
      .map(r => r.original);

    if (allRows.length === 0) return;

    const headers = Object.keys(allRows[0]);
    let csvContent = headers.join(',') + '\n';
    allRows.forEach(row => {
      const line = headers.map(header => {
        let field = row[header] !== null && row[header] !== undefined ? String(row[header]) : '';
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
          field = `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      }).join(',');
      csvContent += line + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'cleaned_dataset.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSplitCSV = async () => {
    if (!validationResult) return;
    setSplitting(true);

    const allRows = [...validationResult.validRows, ...validationResult.invalidRows]
      .sort((a, b) => a.rowIndex - b.rowIndex)
      .map(r => r.original);

    try {
      const response = await fetch('http://localhost:5000/api/split', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rows: allRows,
          chunkSize: chunkSize
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'split_chunks.zip');
        link.click();
      } else {
        const errData = await response.json();
        alert(errData.error || 'Failed to split CSV');
      }
    } catch (error) {
      alert('Error split request failed: ' + error.message);
    } finally {
      setSplitting(false);
    }
  };

  const fetchAiSuggestions = async (rowResult) => {
    setLoadingAi(true);
    setAiSuggestions(null);
    try {
      const response = await fetch('http://localhost:5000/api/ai-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          row: rowResult.original,
          errors: rowResult.errors
        })
      });
      const data = await response.json();
      setAiSuggestions(data);
    } catch (e) {
      alert('Failed to contact AI Assistant.');
    } finally {
      setLoadingAi(false);
    }
  };

  const applyAiCleansing = (cleanedFields) => {
    if (!selectedRow || !validationResult) return;

    const updatedOriginal = { ...selectedRow.original, ...cleanedFields };



    const newErrors = selectedRow.errors.filter(err => !Object.keys(cleanedFields).includes(err.field));

    const updatedRow = {
      ...selectedRow,
      original: updatedOriginal,
      errors: newErrors,
      isValid: newErrors.length === 0
    };

    let updatedValid = [...validationResult.validRows];
    let updatedInvalid = [...validationResult.invalidRows];

    if (updatedRow.isValid) {
      updatedInvalid = updatedInvalid.filter(r => r.rowIndex !== updatedRow.rowIndex);
      updatedValid.push(updatedRow);
      updatedValid.sort((a, b) => a.rowIndex - b.rowIndex);
    } else {
      updatedInvalid = updatedInvalid.map(r => r.rowIndex === updatedRow.rowIndex ? updatedRow : r);
    }

    setValidationResult({
      ...validationResult,
      validCount: updatedValid.length,
      invalidCount: updatedInvalid.length,
      validRows: updatedValid,
      invalidRows: updatedInvalid
    });

    setSelectedRow(updatedRow);
    setAiSuggestions(null);
  };

  const generateSampleCSV = () => {

    const headers = ['customer_id', 'full_name', 'email', 'phone_number', 'city', 'signup_date'];
    const sampleData = [
      { customer_id: '101', full_name: 'Adithya Kumar', email: 'adithya@gmail.com', phone_number: '9876543210', city: 'Chennai', signup_date: '2025-04-10' },
      { customer_id: '102', full_name: 'Simran Chamoli', email: 'simran.chamoli@xeno.in', phone_number: '+91 99998 88888', city: 'Delhi', signup_date: '2025-04-12' },
      { customer_id: '103', full_name: 'Rahul Sen', email: 'rahul.sen@gamil.com', phone_number: '9876543', city: 'Mumbai', signup_date: '15/04/2025' },
      { customer_id: '104', full_name: 'Elena Gilbert', email: 'elena.g@yahoo.com', phone_number: '123456789012', city: 'Bangalore', signup_date: 'invalid-date' },
      { customer_id: '105', full_name: 'Anish Shah', email: '', phone_number: '9822334455', city: 'Pune', signup_date: '2025-04-16' },
      { customer_id: '106', full_name: 'Singapore Customer', email: 'sg.user@gmail.com', phone_number: '81234567', city: 'Singapore', signup_date: '2025-04-16' }
    ];

    let csvContent = headers.join(',') + '\n';
    sampleData.forEach(row => {
      csvContent += headers.map(h => row[h]).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_dirty_transaction_data.csv');
    link.click();
  };

  const visibleRows = () => {
    if (!validationResult) return [];
    if (filterMode === 'valid') return validationResult.validRows;
    if (filterMode === 'invalid') return validationResult.invalidRows;
    return [...validationResult.validRows, ...validationResult.invalidRows].sort((a, b) => a.rowIndex - b.rowIndex);
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.5rem' }}>

      <header className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: '#ffffff', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Cpu size={22} color="black" />
          </div>
          <div>
            <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', background: 'linear-gradient(to right, #ffffff, var(--text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Xeno Integrity Engine
            </h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Validation Hub</span>
          </div>
        </div>
      </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>

            <div className="glass-panel fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                ref={fileInputRef}
              />

              <div
                onClick={() => fileInputRef.current.click()}
                style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: '2px dashed rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: '1rem', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
              >
                <Upload size={32} color={file ? 'var(--success)' : 'var(--text-secondary)'} />
              </div>

              {file ? (
                <div style={{ marginBottom: '1.5rem' }}>
                  <p style={{ fontWeight: 600, color: 'white' }}>{file.name}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div style={{ marginBottom: '1.5rem' }}>
                  <p style={{ fontWeight: 600, color: 'white' }}>Drag & drop your CSV file here</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Or click to browse from files</p>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', maxWidth: '300px', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Rules Code:</span>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid var(--panel-border)', borderRadius: '6px', color: 'white', outline: 'none' }}
                >
                  <option value="IN">India (+91, 10 digits)</option>
                  <option value="SG">Singapore (+65, 8 digits)</option>
                  <option value="US">United States (+1, 10 digits)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', width: '100%', justifyContent: 'center' }}>
                <button
                  onClick={uploadAndValidate}
                  disabled={!file || uploading}
                  className="glow-btn"
                  style={{ padding: '0.65rem 1.5rem', borderRadius: '8px', opacity: (!file || uploading) ? 0.6 : 1, cursor: (!file || uploading) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {uploading ? <RefreshCw className="spin" size={16} /> : <ShieldCheck size={16} />}
                  {uploading ? 'Analyzing...' : 'Run Validation'}
                </button>

                <button
                  onClick={generateSampleCSV}
                  className="glass-panel"
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: '1px solid var(--panel-border)', background: 'transparent', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <FileText size={16} />
                  Get Sample
                </button>
              </div>
            </div>

            {validationResult && (
              <div className="glass-panel fade-in" style={{ padding: '2rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', alignItems: 'center' }}>
                <div style={{ textAlign: 'center', borderRight: '1px solid var(--panel-border)' }}>
                  <Layers size={28} color="white" style={{ margin: '0 auto 0.5rem' }} />
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Rows</p>
                  <p style={{ fontSize: '2rem', fontWeight: 700, color: 'white', marginTop: '0.25rem' }}>{validationResult.totalRows}</p>
                </div>
                <div style={{ textAlign: 'center', borderRight: '1px solid var(--panel-border)' }}>
                  <CheckCircle2 size={28} color="var(--success)" style={{ margin: '0 auto 0.5rem' }} />
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Clean Rows</p>
                  <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.25rem' }}>{validationResult.validCount}</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <AlertTriangle size={28} color={validationResult.invalidCount > 0 ? "var(--error)" : "var(--text-secondary)"} style={{ margin: '0 auto 0.5rem' }} />
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Dirty Rows</p>
                  <p style={{ fontSize: '2rem', fontWeight: 700, color: validationResult.invalidCount > 0 ? 'var(--error)' : 'white', marginTop: '0.25rem' }}>{validationResult.invalidCount}</p>
                </div>
              </div>
            )}
          </div>

          {validationResult && (
            <div className="glass-panel fade-in" style={{ padding: '1.25rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setFilterMode('all')}
                  style={{ padding: '0.45rem 1rem', borderRadius: '6px', border: 'none', background: filterMode === 'all' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontWeight: 600 }}
                >
                  All Rows
                </button>
                <button
                  onClick={() => setFilterMode('valid')}
                  style={{ padding: '0.45rem 1rem', borderRadius: '6px', border: 'none', background: filterMode === 'valid' ? 'var(--success)' : 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontWeight: 600 }}
                >
                  Clean Rows ({validationResult.validCount})
                </button>
                <button
                  onClick={() => setFilterMode('invalid')}
                  style={{ padding: '0.45rem 1rem', borderRadius: '6px', border: 'none', background: filterMode === 'invalid' ? 'var(--error)' : 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontWeight: 600 }}
                >
                  Dirty Rows ({validationResult.invalidCount})
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {validationResult.invalidCount > 0 && (
                  <button
                    onClick={handleCleanData}
                    className="glow-btn"
                    style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <RefreshCw size={14} />
                    Auto-Clean
                  </button>
                )}

                <button
                  onClick={handleDownloadCleaned}
                  style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid var(--success)', color: 'var(--success)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Download size={14} />
                  Download Cleaned
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderLeft: '1px solid var(--panel-border)', paddingLeft: '1rem' }}>
                  <input
                    type="number"
                    value={chunkSize}
                    onChange={(e) => setChunkSize(e.target.value)}
                    style={{ width: '60px', padding: '0.4rem', background: '#0a0a0a', border: '1px solid var(--panel-border)', borderRadius: '6px', color: 'white', outline: 'none', textAlign: 'center' }}
                  />
                  <button
                    onClick={handleSplitCSV}
                    disabled={splitting}
                    style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid var(--text-secondary)', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <Layers size={14} />
                    {splitting ? 'Splitting...' : 'Split & Download ZIP'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {validationResult && (
            <div style={{ display: 'grid', gridTemplateColumns: selectedRow ? '3fr 2fr' : '1fr', gap: '1.5rem', transition: 'all 0.3s' }}>

              <div className="glass-panel fade-in" style={{ padding: '1.5rem', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--panel-border)' }}>
                      <th style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Index</th>
                      {Object.keys(visibleRows()[0]?.original || {}).map(header => (
                        <th key={header} style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{header}</th>
                      ))}
                      <th style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows().map((row) => (
                      <tr
                        key={row.rowIndex}
                        onClick={() => {
                          setSelectedRow(row);
                          setAiSuggestions(null);
                        }}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          cursor: 'pointer',
                          background: selectedRow?.rowIndex === row.rowIndex ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = selectedRow?.rowIndex === row.rowIndex ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255,255,255,0.02)'}
                        onMouseLeave={e => e.currentTarget.style.background = selectedRow?.rowIndex === row.rowIndex ? 'rgba(255, 255, 255, 0.08)' : 'transparent'}
                      >
                        <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{row.rowIndex}</td>
                        {Object.keys(row.original).map(key => {
                          const hasError = row.errors.some(e => e.field === key);
                          return (
                            <td
                              key={key}
                              style={{
                                padding: '0.75rem',
                                fontSize: '0.9rem',
                                color: hasError ? 'var(--error)' : 'white',
                                textDecoration: hasError ? 'underline dotted' : 'none'
                              }}
                            >
                              {row.original[key] || <span style={{ color: 'rgba(255,255,255,0.15)', fontStyle: 'italic' }}>null</span>}
                            </td>
                          );
                        })}
                        <td style={{ padding: '0.75rem' }}>
                          {row.isValid ? (
                            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', fontWeight: 600, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                              Clean
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', fontWeight: 600, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                              Dirty
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedRow && (
                <div className="glass-panel fade-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', borderLeft: '3px solid ' + (selectedRow.isValid ? 'var(--success)' : 'var(--error)') }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontFamily: 'Outfit, sans-serif' }}>Row #{selectedRow.rowIndex} Detail</h3>
                    <button
                      onClick={() => setSelectedRow(null)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.15rem' }}
                    >
                      &times;
                    </button>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                    <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Raw Fields</h4>
                    {Object.keys(selectedRow.original).map(key => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', padding: '0.25rem 0' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{key}:</span>
                        <span style={{ color: selectedRow.errors.some(e => e.field === key) ? 'var(--error)' : 'white' }}>
                          {selectedRow.original[key] || 'null'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {!selectedRow.isValid && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                      <h4 style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <AlertTriangle size={14} />
                        Violations Found ({selectedRow.errors.length})
                      </h4>
                      <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-secondary)' }}>
                        {selectedRow.errors.map((err, i) => (
                          <li key={i} style={{ marginBottom: '0.25rem' }}>
                            <strong style={{ color: 'white' }}>{err.field}</strong>: {err.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!selectedRow.isValid && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 'auto' }}>
                      <button
                        onClick={() => fetchAiSuggestions(selectedRow)}
                        className="glow-btn"
                        style={{ padding: '0.6rem 1rem', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                      >
                        <Sparkles size={14} />
                        {loadingAi ? 'AI Analyzing...' : 'Request AI Assist'}
                      </button>

                      {aiSuggestions && (
                        <div className="glass-panel" style={{ padding: '1rem', fontSize: '0.85rem', background: 'rgba(255, 255, 255, 0.03)', borderColor: 'rgba(255, 255, 255, 0.15)' }}>
                          <h4 style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <Sparkles size={14} />
                            Cleansing Suggestion
                          </h4>
                          <p style={{ fontStyle: 'italic', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                            "{aiSuggestions.summary}"
                          </p>
                          <ul style={{ paddingLeft: '1.2rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                            {aiSuggestions.suggestions.map((sug, i) => (
                              <li key={i} style={{ marginBottom: '0.25rem' }}>{sug}</li>
                            ))}
                          </ul>
                          {Object.keys(aiSuggestions.cleanedFields).length > 0 && (
                            <button
                              onClick={() => applyAiCleansing(aiSuggestions.cleanedFields)}
                              style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--text-secondary)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}
                            >
                              Apply Recommended Corrections
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedRow.isValid && (
                    <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', padding: '1rem', borderRadius: '8px', textAlign: 'center', color: 'var(--success)', fontSize: '0.85rem', marginTop: 'auto' }}>
                      <CheckCircle2 size={24} style={{ margin: '0 auto 0.5rem' }} />
                      <p style={{ fontWeight: 600 }}>Row matches all database validation rules.</p>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}

        </div>

    </div>
  );
}
