import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  Upload, AlertTriangle, CheckCircle2, Download, Sparkles,
  RefreshCw, Layers, ShieldCheck, FileText, Cpu, Eye, EyeOff,
  Search, ChevronLeft, ChevronRight, X, Info, ChevronUp, ChevronDown, Check
} from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? ''
  : 'https://xeno-bckend.onrender.com';

// Count-up animation helper
function CountUp({ end, duration = 1200 }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    if (end === 0) {
      setCount(0);
      return;
    }
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration]);
  return <span>{count.toLocaleString()}</span>;
}

// Progressive checklist loading component
function SequentialProgress({ progress }) {
  const steps = [
    'Reading CSV...',
    'Validating Phone Numbers...',
    'Validating Dates...',
    'Checking Data Integrity...',
    'Generating Cleaned Output...'
  ];

  return (
    <div style={{ maxWidth: '440px', margin: '1.5rem auto', padding: '0 1rem' }}>
      {steps.map((label, idx) => {
        const minLimit = idx * 20;
        const maxLimit = (idx + 1) * 20;
        let stepProgress = 0;
        if (progress >= maxLimit) {
          stepProgress = 100;
        } else if (progress > minLimit) {
          stepProgress = Math.floor(((progress - minLimit) / 20) * 100);
        }

        const filledBlocks = Math.round(stepProgress / 10);
        const emptyBlocks = 10 - filledBlocks;
        const charBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

        return (
          <div key={idx} style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: stepProgress > 0 ? 'var(--text-primary)' : 'var(--text-muted)', marginBottom: '0.25rem' }}>
              <span>{label}</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: stepProgress === 100 ? 'var(--success)' : 'var(--primary)' }}>
                {charBar} {stepProgress}%
              </span>
            </div>
            <div className="progress-track-bg">
              <div className="progress-track-fill" style={{ width: `${stepProgress}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  // 3D Mouse Parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 30, stiffness: 100 };
  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);
  const rotateX = useTransform(springY, [-0.5, 0.5], [6, -6]);
  const rotateY = useTransform(springX, [-0.5, 0.5], [-6, 6]);

  const bgRotateX = useTransform(rotateX, r => -r * 0.8);
  const bgRotateY = useTransform(rotateY, r => -r * 0.8);

  const handleMouseMove = (e) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    mouseX.set(clientX / innerWidth - 0.5);
    mouseY.set(clientY / innerHeight - 0.5);
  };

  const [phase, setPhase] = useState('upload'); // upload, processing, results
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [validationResult, setValidationResult] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showTable, setShowTable] = useState(true);

  // Before vs After Comparison States
  const [comparisonSearchQuery, setComparisonSearchQuery] = useState('');
  const [comparisonFilterMode, setComparisonFilterMode] = useState('all');
  const [expandedComparisonRows, setExpandedComparisonRows] = useState({});
  const [comparisonCurrentPage, setComparisonCurrentPage] = useState(1);
  const [comparisonRowsPerPage, setComparisonRowsPerPage] = useState(20);

  // AI suggestions inline state
  const [loadingAiRow, setLoadingAiRow] = useState(null);
  const [activeAiSuggestions, setActiveAiSuggestions] = useState(null);

  // Popovers
  const [showSplitPopover, setShowSplitPopover] = useState(false);
  const [chunkSize, setChunkSize] = useState('100');
  const [splitting, setSplitting] = useState(false);

  const fileInputRef = useRef(null);
  const progressTimerRef = useRef(null);
  const apiDataRef = useRef(null);

  // Particle background definition
  const particles = Array.from({ length: 5 });

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      triggerAutomaticWorkflow(droppedFile);
    } else {
      alert('Please upload a valid CSV file.');
    }
  };

  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      triggerAutomaticWorkflow(selected);
    }
  };

  const triggerAutomaticWorkflow = (selectedFile) => {
    setFile(selectedFile);
    setPhase('processing');
    setProgress(0);
    setValidationResult(null);
    setShowTable(true);
    setComparisonSearchQuery('');
    setComparisonFilterMode('all');
    setExpandedComparisonRows({});
    setComparisonCurrentPage(1);
    setLoadingAiRow(null);
    setActiveAiSuggestions(null);
    apiDataRef.current = null;

    // Call API validation immediately in the background
    uploadAndValidate(selectedFile);

    // Start simulated progress (taking ~4 seconds to reach 95%)
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95 && !apiDataRef.current) {
          return 95;
        }

        if (apiDataRef.current && prev >= 95) {
          const next = prev + 1;
          if (next >= 100) {
            clearInterval(progressTimerRef.current);
            setTimeout(() => {
              setValidationResult(apiDataRef.current);
              setPhase('results');
            }, 800);
            return 100;
          }
          return next;
        }

        const next = prev + 1;
        if (next >= 95 && !apiDataRef.current) {
          return 95;
        }
        if (next >= 100) {
          clearInterval(progressTimerRef.current);
          setTimeout(() => {
            setValidationResult(apiDataRef.current);
            setPhase('results');
          }, 800);
          return 100;
        }
        return next;
      });
    }, 45); // 95 * 45ms = ~4.2 seconds
  };

  const uploadAndValidate = async (targetFile) => {
    const formData = new FormData();
    formData.append('file', targetFile);

    try {
      const response = await fetch(`${API_BASE}/api/validate`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        apiDataRef.current = data;
      } else {
        clearInterval(progressTimerRef.current);
        let errMsg = 'Failed to analyze CSV';
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch (_) { }
        alert(errMsg);
        setPhase('upload');
      }
    } catch (error) {
      clearInterval(progressTimerRef.current);
      alert('Error connecting to backend server. Make sure the Node server is running on port 5000.');
      setPhase('upload');
    }
  };

  const handleDownloadCleaned = async () => {
    if (!validationResult) return;

    const allRows = [...validationResult.validRows, ...validationResult.invalidRows]
      .sort((a, b) => a.rowIndex - b.rowIndex)
      .map(r => r.cleanedRaw || r.cleaned);

    if (allRows.length === 0) return;

    if (allRows.length > 1000) {
      setSplitting(true);
      try {
        const response = await fetch(`${API_BASE}/api/split-auto`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            rows: allRows
          })
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.setAttribute('href', url);
          link.setAttribute('download', 'cleaned_split.zip');
          link.click();
        } else {
          alert('Failed to split and download cleaned dataset.');
        }
      } catch (error) {
        alert('Split download request failed: ' + error.message);
      } finally {
        setSplitting(false);
      }
    } else {
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
      link.click();
    }
  };

  const handleSplitCSV = async () => {
    if (!validationResult) return;
    setSplitting(true);

    const allRows = [...validationResult.validRows, ...validationResult.invalidRows]
      .sort((a, b) => a.rowIndex - b.rowIndex)
      .map(r => r.cleanedRaw || r.cleaned);

    try {
      const response = await fetch(`${API_BASE}/api/split`, {
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
        setShowSplitPopover(false);
      } else {
        let errMsg = 'Failed to split CSV';
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch (_) { }
        alert(errMsg);
      }
    } catch (error) {
      alert('Split request failed: ' + error.message);
    } finally {
      setSplitting(false);
    }
  };

  const downloadSpecificChunk = (startIndex, endIndex) => {
    if (!validationResult) return;
    const allRows = [...validationResult.validRows, ...validationResult.invalidRows]
      .sort((a, b) => a.rowIndex - b.rowIndex)
      .map(r => r.cleanedRaw || r.cleaned);

    const chunkRows = allRows.slice(startIndex, endIndex);
    if (chunkRows.length === 0) return;

    const headers = Object.keys(chunkRows[0]);
    let csvContent = headers.join(',') + '\n';
    chunkRows.forEach(row => {
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
    link.setAttribute('download', `cleaned_chunk_rows_${startIndex + 1}_to_${endIndex}.csv`);
    link.click();
  };

  const fetchAiSuggestions = async (rowResult) => {
    setLoadingAiRow(rowResult.rowIndex);
    setActiveAiSuggestions(null);
    try {
      const response = await fetch(`${API_BASE}/api/ai-suggestions`, {
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
      setActiveAiSuggestions({ ...data, rowIndex: rowResult.rowIndex });
    } catch (e) {
      alert('Failed to connect to AI server.');
    } finally {
      setLoadingAiRow(null);
    }
  };

  const applyAiCleansing = (cleanedFields, targetRow) => {
    if (!targetRow || !validationResult) return;

    const updatedOriginal = { ...targetRow.original, ...cleanedFields };
    const newErrors = targetRow.errors.filter(err => !Object.keys(cleanedFields).includes(err.field));

    const updatedCleaned = { ...targetRow.cleaned, ...cleanedFields };

    // Update validity flags for CSV download mapping
    if (cleanedFields.phone) {
      updatedCleaned.phone_valid = 'VALID';
    }
    if (cleanedFields.date) {
      updatedCleaned.date_valid = 'VALID';
    }
    if (cleanedFields.payment_mode) {
      updatedCleaned.payment_valid = 'VALID';
    }
    updatedCleaned.validation_status = newErrors.length === 0 ? 'VALID' : 'INVALID';
    updatedCleaned.error_message = newErrors.map(e => e.message).join('; ');

    // Update cleanedRaw keeping original keys
    const updatedCleanedRaw = targetRow.cleanedRaw ? { ...targetRow.cleanedRaw } : null;
    if (updatedCleanedRaw) {
      Object.keys(updatedCleanedRaw).forEach(key => {
        const k = key.toLowerCase().replace(/[\s_-]/g, '');
        Object.entries(cleanedFields).forEach(([field, val]) => {
          if (field === 'phone' && (k === 'phone' || k === 'phonenumber' || k === 'mobile' || k === 'mobilenumber' || k === 'contact')) {
            updatedCleanedRaw[key] = val;
          } else if (field === 'customer_name' && (k === 'customername' || k === 'name' || k === 'custname' || k === 'fullname')) {
            updatedCleanedRaw[key] = val;
          } else if (field === 'date' && (k === 'date' || k === 'datetime' || k === 'timestamp' || k === 'transactiondate' || k === 'signupdate' || k === 'signup')) {
            updatedCleanedRaw[key] = val;
          } else if (field === 'email' && (k === 'email' || k === 'emailaddress')) {
            updatedCleanedRaw[key] = val;
          } else if (field === 'price' && (k === 'price' || k === 'amount' || k === 'unitprice')) {
            updatedCleanedRaw[key] = val;
          } else if (field === 'quantity' && (k === 'quantity' || k === 'qty')) {
            updatedCleanedRaw[key] = val;
          } else if (field === 'product_name' && (k === 'productname' || k === 'product' || k === 'itemname' || k === 'item')) {
            updatedCleanedRaw[key] = val;
          } else if (field === 'payment_mode' && (k === 'paymentmode' || k === 'payment' || k === 'paymentmethod')) {
            updatedCleanedRaw[key] = val;
          } else if (field === 'city' && k === 'city') {
            updatedCleanedRaw[key] = val;
          } else if (field === 'customer_id' && (k === 'customerid' || k === 'custid' || k === 'cid' || k === 'userid' || k === 'uid')) {
            updatedCleanedRaw[key] = val;
          } else if (field === 'order_id' && (k === 'orderid' || k === 'order')) {
            updatedCleanedRaw[key] = val;
          }
        });
      });
      updatedCleanedRaw.validation_status = newErrors.length === 0 ? 'VALID' : 'INVALID';
      updatedCleanedRaw.error_message = newErrors.map(e => e.message).join('; ');
    }

    const updatedRow = {
      ...targetRow,
      original: updatedOriginal,
      cleaned: updatedCleaned,
      cleanedRaw: updatedCleanedRaw || targetRow.cleanedRaw,
      errors: newErrors,
      isValid: newErrors.length === 0,
      hasAiSuggestionApplied: true
    };

    let updatedValid = [...validationResult.validRows];
    let updatedInvalid = [...validationResult.invalidRows];

    if (updatedRow.isValid) {
      updatedInvalid = updatedInvalid.filter(r => r.rowIndex !== updatedRow.rowIndex);
      updatedValid = updatedValid.filter(r => r.rowIndex !== updatedRow.rowIndex);
      updatedValid.push(updatedRow);
      updatedValid.sort((a, b) => a.rowIndex - b.rowIndex);
    } else {
      updatedInvalid = updatedInvalid.map(r => r.rowIndex === updatedRow.rowIndex ? updatedRow : r);
      updatedValid = updatedValid.map(r => r.rowIndex === updatedRow.rowIndex ? updatedRow : r);
    }

    setValidationResult({
      ...validationResult,
      validCount: updatedValid.filter(r => r.isValid).length,
      invalidCount: updatedInvalid.filter(r => !r.isValid).length,
      validRows: updatedValid.filter(r => r.isValid),
      invalidRows: updatedInvalid.filter(r => !r.isValid)
    });

    setActiveAiSuggestions(null);
  };

  const handleExportComparisonCSV = (filteredRows) => {
    const headers = ['Order ID', 'Customer', 'Original Phone', 'Cleaned Phone', 'Original Payment', 'Cleaned Payment', 'Status'];
    let csvContent = headers.join(',') + '\n';
    filteredRows.forEach(row => {
      const origPhone = row.original.phone || '';
      const cleanPhone = row.cleaned.phone || '';
      const origPay = row.original.payment_mode || '';
      const cleanPay = row.cleaned.payment_mode || '';

      let status = 'Unchanged';
      if (row.errors.length > 0) status = 'Invalid';
      else if (origPhone !== cleanPhone || origPay !== cleanPay || row.original.customer_name !== row.cleaned.customer_name || row.original.date !== row.cleaned.date) status = 'Fixed';

      const line = [
        row.cleaned.order_id || '',
        row.cleaned.customer_name || '',
        origPhone,
        cleanPhone,
        origPay,
        cleanPay,
        status
      ].map(field => {
        let f = String(field);
        if (f.includes(',') || f.includes('"') || f.includes('\n')) {
          f = `"${f.replace(/"/g, '""')}"`;
        }
        return f;
      }).join(',');
      csvContent += line + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'before_vs_after_comparison.csv');
    link.click();
  };

  const getCleaningActionDescription = (row) => {
    if (!row) return 'None';
    const errors = row.errors || [];
    const warnings = row.warnings || [];

    if (row.isValid && warnings.length === 0) return 'None (Valid)';
    if (warnings.some(w => w.message && w.message.includes('spaces'))) return 'Trimmed Whitespaces';

    const fieldsWithError = errors.map(e => e.field ? e.field.toLowerCase() : '');
    if (fieldsWithError.some(f => f.includes('phone') || f.includes('mobile'))) {
      return 'Standardized Phone Format';
    }
    if (fieldsWithError.some(f => f.includes('email'))) {
      return 'AI Mapped Email Domain';
    }
    if (fieldsWithError.some(f => f.includes('date') || f.includes('time'))) {
      return 'Re-formatted Date';
    }
    if (fieldsWithError.some(f => f.includes('payment') || f.includes('method') || f.includes('mode'))) {
      return 'Formatted Payment Mode';
    }
    return 'Dynamic AI Imputation';
  };

  const getValidationSummary = (row) => {
    if (!row) return 'Ready';
    const errors = row.errors || [];
    const warnings = row.warnings || [];

    if (row.isValid && warnings.length === 0) return 'Ready';
    if (errors.length > 0) {
      return errors.map(e => e.message || '').join(', ');
    }
    return warnings.map(w => w.message || '').join(', ');
  };

  const renderComparisonTable = () => {
    if (!validationResult) return null;

    // Filter rows based on tabs & search query
    let rows = [...validationResult.validRows, ...validationResult.invalidRows].sort((a, b) => a.rowIndex - b.rowIndex);

    // Apply comparison search query
    if (comparisonSearchQuery) {
      const q = comparisonSearchQuery.toLowerCase();
      rows = rows.filter(row => {
        return Object.values(row.cleaned).some(val =>
          String(val || '').toLowerCase().includes(q)
        ) || Object.values(row.original).some(val =>
          String(val || '').toLowerCase().includes(q)
        ) || String(row.rowIndex).includes(q);
      });
    }

    // Apply comparison filter tab: 'all', 'changed', 'unchanged', 'invalid'
    if (comparisonFilterMode === 'changed') {
      rows = rows.filter(row => {
        if (row.errors.length > 0) return false;
        const fields = ['customer_name', 'phone', 'date', 'payment_mode', 'email', 'price', 'quantity', 'order_id', 'customer_id', 'product_name'];
        return fields.some(f => row.original[f] !== row.cleaned[f]);
      });
    } else if (comparisonFilterMode === 'unchanged') {
      rows = rows.filter(row => {
        if (row.errors.length > 0) return false;
        const fields = ['customer_name', 'phone', 'date', 'payment_mode', 'email', 'price', 'quantity', 'order_id', 'customer_id', 'product_name'];
        return !fields.some(f => row.original[f] !== row.cleaned[f]);
      });
    } else if (comparisonFilterMode === 'invalid') {
      rows = rows.filter(row => row.errors.length > 0);
    }

    // Paginate comparison rows
    const totalCompPages = Math.ceil(rows.length / comparisonRowsPerPage);
    const startIdx = (comparisonCurrentPage - 1) * comparisonRowsPerPage;
    const paginatedCompRows = rows.slice(startIdx, startIdx + comparisonRowsPerPage);

    const toggleRowExpansion = (rowIndex) => {
      setExpandedComparisonRows(prev => ({
        ...prev,
        [rowIndex]: !prev[rowIndex]
      }));
    };

    return (
      <div className="glass-card" style={{ padding: '1.5rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>

        {/* Header/Title of Table */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <Layers size={18} color="var(--primary)" />
              Before vs. After Comparison Table
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Review original uploaded data alongside standardized AI improvements. Click 'View' to trigger AI Assist corrections.
            </p>
          </div>

        </div>

        <AnimatePresence>
          {showTable && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', overflow: 'hidden' }}
            >
              {/* Toolbar & Filters */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {[
                    { id: 'all', label: 'All Records' },
                    { id: 'changed', label: 'Fixed / Cleaned' },
                    { id: 'unchanged', label: 'Unchanged' },
                    { id: 'invalid', label: 'Noise / Invalid' }
                  ].map(tab => (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      key={tab.id}
                      onClick={() => {
                        setComparisonFilterMode(tab.id);
                        setComparisonCurrentPage(1);
                      }}
                      className="premium-btn"
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.8rem',
                        background: comparisonFilterMode === tab.id ? 'var(--primary-glow-strong)' : 'rgba(255, 255, 255, 0.03)',
                        borderColor: comparisonFilterMode === tab.id ? 'var(--primary)' : 'var(--card-border)',
                        color: comparisonFilterMode === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: comparisonFilterMode === tab.id ? 600 : 500
                      }}
                    >
                      {tab.label}
                    </motion.button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  {/* Search comparison */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--card-border)', padding: '0.4rem 0.75rem', borderRadius: '6px', width: '220px' }}>
                    <Search size={14} color="var(--text-muted)" />
                    <input
                      type="text"
                      placeholder="Search rows..."
                      value={comparisonSearchQuery}
                      onChange={(e) => {
                        setComparisonSearchQuery(e.target.value);
                        setComparisonCurrentPage(1);
                      }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.8rem' }}
                    />
                  </div>

                  {/* Rows per page */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>Show:</span>
                    <select
                      value={comparisonRowsPerPage}
                      onChange={(e) => {
                        setComparisonRowsPerPage(parseInt(e.target.value));
                        setComparisonCurrentPage(1);
                      }}
                      style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', padding: '0.25rem 0.5rem', borderRadius: '6px', outline: 'none', cursor: 'pointer' }}
                    >
                      <option style={{ background: '#1f2937' }} value={10}>10</option>
                      <option style={{ background: '#1f2937' }} value={20}>20</option>
                      <option style={{ background: '#1f2937' }} value={50}>50</option>
                      <option style={{ background: '#1f2937' }} value={100}>100</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Table layout */}
              <div style={{ overflowX: 'auto', border: '1px solid var(--card-border)', borderRadius: '8px' }}>
                <table className="custom-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>Row</th>
                      <th>Order ID</th>
                      <th>Customer</th>
                      <th>Original Phone</th>
                      <th>Cleaned Phone</th>
                      <th>Original Payment</th>
                      <th>Cleaned Payment</th>
                      <th style={{ width: '120px' }}>Status</th>
                      <th style={{ width: '150px', textAlign: 'right', paddingRight: '1rem' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCompRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
                          No comparison rows found matching criteria.
                        </td>
                      </tr>
                    ) : (
                      paginatedCompRows.map((row, idx) => {
                        const isExpanded = !!expandedComparisonRows[row.rowIndex];
                        const origPhone = row.original.phone || '';
                        const cleanPhone = row.cleaned.phone || '';
                        const origPay = row.original.payment_mode || '';
                        const cleanPay = row.cleaned.payment_mode || '';

                        // Status identification
                        let badgeClass = 'badge-clean';
                        let badgeText = 'Unchanged';
                        let borderLeftColor = 'transparent';

                        if (row.errors.length > 0) {
                          badgeClass = 'badge-noise';
                          badgeText = 'Noise';
                          borderLeftColor = 'var(--error)';
                        } else {
                          const fields = ['customer_name', 'phone', 'date', 'payment_mode', 'email', 'price', 'quantity', 'order_id', 'customer_id', 'product_name'];
                          const isFixed = fields.some(f => row.original[f] !== row.cleaned[f]);
                          if (isFixed) {
                            badgeClass = 'badge-clean';
                            badgeText = '✓ Fixed';
                            borderLeftColor = 'var(--success)';
                          } else {
                            badgeClass = 'badge-warning';
                            badgeText = 'Unchanged';
                            borderLeftColor = 'var(--card-border)';
                          }
                        }

                        return (
                          <React.Fragment key={row.rowIndex}>
                            <motion.tr
                              layout
                              initial={{ opacity: 0, scale: 0.95, y: 20 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              transition={{ duration: 0.4, type: 'spring', bounce: 0.3, delay: Math.min(idx * 0.03, 0.4) }}
                              style={{ borderLeft: `3px solid ${borderLeftColor}`, cursor: 'pointer' }}
                              onClick={() => toggleRowExpansion(row.rowIndex)}
                            >
                              <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>#{row.rowIndex}</td>
                              <td style={{ fontWeight: 500 }}>{row.cleaned.order_id || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>missing</span>}</td>
                              <td>{row.cleaned.customer_name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>missing</span>}</td>

                              {/* Original Phone vs Cleaned Phone */}
                              <td style={{ color: origPhone !== cleanPhone ? 'var(--text-muted)' : 'inherit', textDecoration: origPhone !== cleanPhone ? 'line-through' : 'none' }}>
                                {origPhone || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>null</span>}
                              </td>
                              <td style={{ color: origPhone !== cleanPhone ? 'var(--success)' : 'inherit', fontWeight: origPhone !== cleanPhone ? 600 : 'normal' }}>
                                {cleanPhone || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>null</span>}
                              </td>

                              {/* Original Payment vs Cleaned Payment */}
                              <td style={{ color: origPay !== cleanPay ? 'var(--text-muted)' : 'inherit', textDecoration: origPay !== cleanPay ? 'line-through' : 'none' }}>
                                {origPay || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>null</span>}
                              </td>
                              <td style={{ color: origPay !== cleanPay ? 'var(--success)' : 'inherit', fontWeight: origPay !== cleanPay ? 600 : 'normal' }}>
                                {cleanPay || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>null</span>}
                              </td>

                              {/* Status Badge */}
                              <td>
                                <span className={badgeClass}>
                                  {badgeText}
                                </span>
                              </td>

                              {/* Action Buttons */}
                              <td style={{ textAlign: 'right', paddingRight: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                  <motion.button
                                    title="View Details"
                                    whileHover={{ scale: 1.1, backgroundColor: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleRowExpansion(row.rowIndex);
                                    }}
                                    style={{
                                      width: '36px', height: '36px',
                                      borderRadius: '8px',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      background: 'rgba(255,255,255,0.03)',
                                      border: '1px solid var(--card-border)',
                                      color: 'var(--text-secondary)',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease'
                                    }}
                                  >
                                    {isExpanded ? <EyeOff size={16} /> : <Eye size={16} />}
                                  </motion.button>

                                  <motion.button
                                    title="Fetch AI Insights"
                                    whileHover={{ scale: 1.1, backgroundColor: 'var(--warning)', color: '#fff', borderColor: 'var(--warning)' }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isExpanded) toggleRowExpansion(row.rowIndex);
                                      fetchAiSuggestions(row);
                                    }}
                                    style={{
                                      width: '36px', height: '36px',
                                      borderRadius: '8px',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      background: 'rgba(255,255,255,0.03)',
                                      border: '1px solid var(--card-border)',
                                      color: 'var(--text-secondary)',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease'
                                    }}
                                  >
                                    <Sparkles size={16} />
                                  </motion.button>

                                  <motion.button
                                    title="Download Record"
                                    whileHover={{ scale: 1.1, backgroundColor: 'var(--success)', color: '#fff', borderColor: 'var(--success)' }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const cleanedRow = row.cleanedRaw || row.cleaned;
                                      const headers = Object.keys(cleanedRow);
                                      let csvContent = headers.join(',') + '\n';
                                      const line = headers.map(header => {
                                        let field = cleanedRow[header] !== null && cleanedRow[header] !== undefined ? String(cleanedRow[header]) : '';
                                        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
                                          field = `"${field.replace(/"/g, '""')}"`;
                                        }
                                        return field;
                                      }).join(',');
                                      csvContent += line + '\n';
                                      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                      const url = URL.createObjectURL(blob);
                                      const link = document.createElement('a');
                                      link.setAttribute('href', url);
                                      link.setAttribute('download', `cleaned_row_${row.rowIndex}.csv`);
                                      link.click();
                                    }}
                                    style={{
                                      width: '36px', height: '36px',
                                      borderRadius: '8px',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      background: 'rgba(255,255,255,0.03)',
                                      border: '1px solid var(--card-border)',
                                      color: 'var(--text-secondary)',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease'
                                    }}
                                  >
                                    <Download size={16} />
                                  </motion.button>
                                </div>
                              </td>
                            </motion.tr>

                            {/* Expandable detailed comparison area */}
                            {isExpanded && (
                              <tr onClick={(e) => e.stopPropagation()}>
                                <td colSpan={9} style={{ background: 'rgba(255, 255, 255, 0.01)', padding: 0 }}>
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    style={{ overflow: 'hidden', padding: '1.25rem' }}
                                  >
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
                                      {/* Original Fields Card */}
                                      <div className="glass-card" style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.02)' }}>
                                        <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '0.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.25rem' }}>
                                          Original Transaction Record
                                        </h4>
                                        <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                          {Object.entries(row.original).map(([k, val]) => (
                                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.02)', padding: '0.15rem 0' }}>
                                              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{k}:</span>
                                              <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{val === '' || val === null ? '<empty>' : String(val)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      {/* Cleaned Fields Card */}
                                      <div className="glass-card" style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                                        <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--success)', fontWeight: 700, marginBottom: '0.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.25rem' }}>
                                          Cleaned Transaction Record
                                        </h4>
                                        <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                          {Object.entries(row.cleaned).map(([k, val]) => {
                                            if (k.endsWith('_valid') || k === 'validation_status' || k === 'error_message') return null;
                                            const isCleanDiff = row.original[k] !== val;
                                            return (
                                              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.02)', padding: '0.15rem 0' }}>
                                                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{k}:</span>
                                                <span style={{ fontFamily: 'monospace', color: isCleanDiff ? 'var(--success)' : 'var(--text-primary)', fontWeight: isCleanDiff ? 600 : 'normal' }}>
                                                  {val === '' || val === null ? '<empty>' : String(val)}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>

                                    {/* AI Confidence, Reason, Validation Errors, and suggestion triggers */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                                      {row.errors.length > 0 && (
                                        <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.75rem', borderRadius: '6px' }}>
                                          <strong style={{ color: 'var(--error)' }}>Validation Violations:</strong>
                                          <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                            {row.errors.map((err, i) => (
                                              <li key={i} style={{ color: 'var(--text-secondary)' }}>{err.field}: {err.message}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}

                                      <div style={{ background: 'var(--primary-glow)', border: '1px solid rgba(37, 99, 235, 0.12)', padding: '0.75rem', borderRadius: '6px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                          <span style={{ color: 'var(--text-primary)' }}><strong>AI Confidence:</strong> <span style={{ color: 'var(--success)', fontWeight: 600 }}>{row.hasAiSuggestionApplied ? '100% (Applied)' : '95% (Automated Rules)'}</span></span>
                                        </div>
                                        <div style={{ color: 'var(--text-primary)' }}>
                                          <strong>Cleansing Rationale:</strong> <span style={{ color: 'var(--text-secondary)' }}>{getCleaningActionDescription(row)} - {getValidationSummary(row)}</span>
                                        </div>
                                      </div>

                                      {/* AI Assist suggestion trigger inline */}
                                      {row.errors.length > 0 && (
                                        <div style={{ marginTop: '0.5rem' }}>
                                          <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => fetchAiSuggestions(row)}
                                            className="premium-btn premium-btn-primary"
                                            style={{ width: '100%', height: '36px', fontSize: '0.8rem' }}
                                            disabled={loadingAiRow === row.rowIndex}
                                          >
                                            <Sparkles size={14} />
                                            {loadingAiRow === row.rowIndex ? 'AI Resolving...' : 'Request AI Assist'}
                                          </motion.button>

                                          <AnimatePresence>
                                            {activeAiSuggestions && activeAiSuggestions.rowIndex === row.rowIndex && (
                                              <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ type: 'spring', damping: 22, stiffness: 200 }}
                                                className="glass-card"
                                                style={{ padding: '1rem', fontSize: '0.8rem', background: 'rgba(59, 130, 246, 0.04)', borderColor: 'rgba(59,130,246,0.2)', marginTop: '0.5rem', overflow: 'hidden' }}
                                              >
                                                <h4 style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                                                  <Sparkles size={12} color="var(--primary)" />
                                                  AI Correction Plan
                                                </h4>
                                                <p style={{ fontStyle: 'italic', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                                                  "{activeAiSuggestions.summary || ''}"
                                                </p>
                                                {activeAiSuggestions.suggestions && Array.isArray(activeAiSuggestions.suggestions) && (
                                                  <ul style={{ paddingLeft: '1rem', marginBottom: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                    {activeAiSuggestions.suggestions.map((s, idx) => (
                                                      <li key={idx}>
                                                        <strong style={{ color: 'var(--text-primary)' }}>{s.field || ''}</strong>: {s.action || s.message || JSON.stringify(s)}
                                                      </li>
                                                    ))}
                                                  </ul>
                                                )}
                                                {activeAiSuggestions.cleanedFields && Object.keys(activeAiSuggestions.cleanedFields).length > 0 && (
                                                  <motion.button
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => applyAiCleansing(activeAiSuggestions.cleanedFields, row)}
                                                    className="premium-btn"
                                                    style={{ width: '100%', padding: '0.4rem', background: 'rgba(59, 130, 246, 0.05)', borderColor: 'var(--primary)', fontSize: '0.8rem', marginTop: '0.5rem', color: 'var(--primary)', fontWeight: 600 }}
                                                  >
                                                    Apply Recommended Corrections
                                                  </motion.button>
                                                )}
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination */}
              {totalCompPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span>
                    Showing Page <strong>{comparisonCurrentPage}</strong> of <strong>{totalCompPages}</strong> (Filtered: {rows.length} rows)
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      disabled={comparisonCurrentPage === 1}
                      onClick={() => setComparisonCurrentPage(prev => Math.max(1, prev - 1))}
                      className="premium-btn"
                      style={{ padding: '0.35rem 0.75rem', opacity: comparisonCurrentPage === 1 ? 0.4 : 1 }}
                    >
                      <ChevronLeft size={14} />
                      Previous
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      disabled={comparisonCurrentPage === totalCompPages}
                      onClick={() => setComparisonCurrentPage(prev => Math.min(totalCompPages, prev + 1))}
                      className="premium-btn"
                      style={{ padding: '0.35rem 0.75rem', opacity: comparisonCurrentPage === totalCompPages ? 0.4 : 1 }}
                    >
                      Next
                      <ChevronRight size={14} />
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      style={{ position: 'relative', minHeight: '100vh', width: '100%', overflow: 'hidden', perspective: '1200px' }}
    >

      {/* Background Particles Layer */}
      <motion.div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          rotateX: bgRotateX, rotateY: bgRotateY, z: -50,
          transformStyle: 'preserve-3d'
        }}
      >
        {particles.map((_, i) => (
          <div
            key={i}
            className="floating-particle"
            style={{
              width: `${Math.random() * 180 + 100}px`,
              height: `${Math.random() * 180 + 100}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${i * -2.4}s`,
              animationDuration: `${Math.random() * 8 + 12}s`,
              zIndex: 0
            }}
          />
        ))}
      </motion.div>

      <div 
        style={{ 
          position: 'relative', zIndex: 1, maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem'
        }}
      >

        <AnimatePresence mode="wait">
          {phase === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
              transition={{ duration: 0.4, type: 'spring', bounce: 0.3 }}
              style={{ textAlign: 'center', maxWidth: '680px', margin: '3.5rem auto 0' }}
            >
              {/* Xeno Logo */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <img src="/newlogoxeno.png" alt="Xeno Logo" style={{ height: '45px', objectFit: 'contain' }} />
              </div>

              <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: '1.15', marginBottom: '1rem', background: 'linear-gradient(to right, #ffffff, #cbd5e1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Welcome to Xeno Integrity Engine
              </h1>

              <p style={{ color: '#cbd5e1', fontSize: '1.05rem', marginBottom: '2.5rem', lineHeight: '1.5' }}>
                Keep your customer data flawless automatically using AI-powered validation
              </p>

              {/* Upload Drop Zone */}
              <input
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleFileSelect}
              />

              <motion.div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                className="glass-card"
                style={{
                  padding: '4rem 2rem',
                  border: isDragOver ? '2px dashed var(--primary)' : '1px solid var(--card-border)',
                  background: isDragOver ? 'var(--primary-glow-strong)' : 'var(--card-bg)',
                  cursor: 'pointer',
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1rem'
                }}
              >
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'var(--primary-glow)',
                  border: '1px solid rgba(37, 99, 235, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                  boxShadow: '0 0 15px rgba(37, 99, 235, 0.05)'
                }}>
                  <Upload size={28} />
                </div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Drag & Drop your CSV file</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>or click to browse your files</p>
                </div>
              </motion.div>

              <div style={{ marginTop: '2rem' }}>
                <span className="ai-badge">
                  <Sparkles size={12} />
                  AI Cleansing Active
                </span>
              </div>
            </motion.div>
          )}

          {phase === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
              transition={{ duration: 0.4, type: 'spring', bounce: 0.3 }}
              style={{ maxWidth: '640px', margin: '2rem auto 0' }}
            >
              <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', background: 'var(--card-bg)' }}>

                {/* Loader animation header */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ position: 'relative', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', border: '3px solid var(--primary-glow-strong)', borderRadius: '50%', width: '100%', height: '100%' }}></div>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                      style={{ position: 'absolute', border: '3px solid transparent', borderLeftColor: 'var(--primary)', borderTopColor: 'var(--primary)', borderRadius: '50%', width: '100%', height: '100%' }}
                    ></motion.div>
                    <Cpu size={32} color="var(--primary)" />
                  </div>
                </div>

                <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  Analyzing dataset
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                  AI validation parsing file contents...
                </p>

                {/* Progress bar info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem', padding: '0 4px' }}>
                  <span>Overall Progress</span>
                  <span style={{ color: 'var(--primary)' }}>{progress}%</span>
                </div>

                <div style={{ background: '#f1f5f9', height: '8px', borderRadius: '9999px', overflow: 'hidden', marginBottom: '2rem', border: '1px solid var(--card-border)' }}>
                  <motion.div
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: "easeOut", duration: 0.15 }}
                    style={{ background: 'linear-gradient(to right, var(--primary), #60a5fa)', height: '100%', borderRadius: '9999px' }}
                  />
                </div>

                {/* Progressive checklist loader */}
                <SequentialProgress progress={progress} />

              </div>
            </motion.div>
          )}

          {phase === 'results' && validationResult && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
              transition={{ duration: 0.5, type: 'spring', bounce: 0.3 }}
            >
              {/* Main Title Header */}
              <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setPhase('upload')}
                  className="premium-btn"
                  style={{
                    padding: '0.5rem',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderColor: 'var(--card-border)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Go Back"
                >
                  <ChevronLeft size={20} />
                </motion.button>

                <img src="/newlogoxeno.png" alt="Xeno Logo" style={{ height: '36px', objectFit: 'contain' }} />
                <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.15)', paddingLeft: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginTop: '2px' }}>Automated AI Clearing</span>
                </div>
              </header>

              {/* Centered, smaller container for results phase */}
              <div style={{ width: '100%', maxWidth: '1050px', margin: '0 auto' }}>
                {/* Action Buttons Header - File Info on Left, Buttons on Right */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>

                  {/* Left side: File summary */}
                  <div style={{ display: 'flex', flexDirection: 'column', fontSize: '1rem', color: 'var(--text-secondary)' }}>
                    <div><strong style={{ color: 'var(--text-primary)' }}>{file?.name}</strong></div>
                    <div><strong style={{ color: 'var(--text-primary)' }}>{(file?.size / 1024).toFixed(1)} KB</strong></div>
                  </div>
                  {/* Action Buttons: Hide Table, Cleaned File, Download Chunks */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', width: '100%', maxWidth: '580px' }}>
                    {/* Toggle button: View Table */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowTable(!showTable)}
                      className="premium-btn"
                      style={{
                        background: showTable ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                        borderColor: showTable ? '#3b82f6' : 'var(--card-border)',
                        color: showTable ? '#3b82f6' : 'var(--text-secondary)',
                        fontWeight: 600,
                        padding: '0.75rem 0.5rem',
                        fontSize: '0.95rem',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        width: '100%',
                        height: '100%'
                      }}
                    >
                      {showTable ? <EyeOff size={18} /> : <Eye size={18} />}
                      {showTable ? 'Hide Table' : 'View Table'}
                    </motion.button>

                    {/* Download: Cleaned File */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleDownloadCleaned}
                      className="premium-btn"
                      style={{
                        padding: '0.75rem 0.5rem',
                        fontSize: '0.95rem',
                        background: '#3b82f6',
                        borderColor: '#3b82f6',
                        color: '#ffffff',
                        fontWeight: 600,
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        width: '100%',
                        height: '100%'
                      }}
                    >
                      <CheckCircle2 size={18} />
                      Cleaned File
                    </motion.button>

                    {/* Download: Chunks split ZIP */}
                    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowSplitPopover(!showSplitPopover)}
                        className="premium-btn"
                        style={{
                          padding: '0.75rem 0.5rem',
                          fontSize: '0.95rem',
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderColor: 'rgba(255, 255, 255, 0.1)',
                          color: 'var(--text-primary)',
                          fontWeight: 600,
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          width: '100%',
                          height: '100%'
                        }}
                      >
                        <Download size={18} />
                        Download Chunks
                      </motion.button>

                      {/* Popover Splitter */}
                      <AnimatePresence>
                        {showSplitPopover && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                            className="glass-card"
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: 'calc(100% + 8px)',
                              padding: '1.25rem',
                              width: '240px',
                              zIndex: 100,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.75rem',
                              border: '1px solid var(--card-border)',
                              background: 'rgba(17, 24, 39, 0.95)'
                            }}
                          >
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              Split Cleaned CSV (rows / file):
                            </div>
                            <input
                              type="number"
                              value={chunkSize}
                              onChange={(e) => setChunkSize(e.target.value)}
                              style={{
                                padding: '0.4rem',
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid var(--card-border)',
                                borderRadius: '6px',
                                color: 'var(--text-primary)',
                                outline: 'none',
                                fontSize: '0.9rem'
                              }}
                            />

                            {/* Dynamic Chunk Grid */}
                            {(() => {
                              const allRowsToSplit = validationResult ? [...validationResult.validRows, ...validationResult.invalidRows].sort((a, b) => a.rowIndex - b.rowIndex).map(r => r.cleanedRaw || r.cleaned) : [];
                              const cSize = Math.max(1, Number(chunkSize) || 1000);
                              const chunksList = [];
                              for (let i = 0; i < allRowsToSplit.length; i += cSize) {
                                chunksList.push({ start: i + 1, end: Math.min(i + cSize, allRowsToSplit.length), startIndex: i });
                              }
                              if (chunksList.length === 0) return null;
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px', marginTop: '0.5rem' }}>
                                  {chunksList.map((chunk, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--card-border)' }}>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Rows {chunk.start}-{chunk.end}</span>
                                      <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => downloadSpecificChunk(chunk.startIndex, chunk.end)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center' }}
                                        title="Download this chunk"
                                      >
                                        <Download size={14} />
                                      </motion.button>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}

                            <div style={{ height: '1px', background: 'var(--card-border)', margin: '0.25rem 0' }} />

                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={handleSplitCSV}
                              disabled={splitting}
                              className="premium-btn premium-btn-primary"
                              style={{ padding: '0.45rem', fontSize: '0.85rem', width: '100%' }}
                            >
                              {splitting ? <RefreshCw className="spin" size={12} /> : <Layers size={12} />}
                              {splitting ? 'Generating...' : 'Download All as ZIP'}
                            </motion.button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Data Table Grid container */}
                <div style={{ width: '100%', marginBottom: '2.5rem' }}>
                  {renderComparisonTable()}
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

    </div>
    </div>
  );
}
