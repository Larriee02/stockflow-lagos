import React, { useState, useMemo } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  FileText,
  X,
  ArrowRight,
  Info,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

// Sample Lagos provision catalog CSV data for template download
const SAMPLE_CSV_TEMPLATE = `SKU,Name,Category,Unit,Cost Price,Selling Price,Stock Quantity,Reorder Level,Supplier
PK-MLK-01,Peak Evaporated Milk 160g Tin,Beverages & Dairy,Roll,4500,5200,24,6,FrieslandCampina WAMCO
IND-ON-02,Indomie Onion Chicken 70g (Carton),Grains & Staples,Carton,6800,7800,40,10,Dufil Prima Foods
GP-SPAG-03,Golden Penny Spaghetti 500g,Grains & Staples,Pack,900,1100,60,15,Flour Mills of Nigeria
MLO-500-04,Nestle Milo Refill 500g,Beverages & Dairy,Pack,3200,3700,20,5,Nestle Nigeria Plc
DNG-SGR-05,Dangote Refined White Sugar 500g,Baking & Condiments,Pack,1200,1450,30,8,Dangote Sugar Refinery
COLO-SP-06,Close-Up Triple Fresh Toothpaste 140g,Toiletries & Household,Pack,850,1050,35,10,Unilever Nigeria
ARL-DET-07,Ariel Automatic Washing Powder 400g,Toiletries & Household,Pack,1100,1350,25,5,Procter & Gamble
KNOR-CB-08,Knorr Chicken Seasoning Cubes (Pack of 50),Baking & Condiments,Pack,1400,1700,45,12,Unilever Nigeria`;

/**
 * Robust CSV & TSV line parser handling escaped quotes and delimiter variations
 */
function parseDelimitedText(text) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  const isTab = firstLine.includes('\t');
  const delimiter = isTab ? '\t' : ',';

  // Helper to split line by delimiter while respecting double-quoted values
  const splitLine = (line) => {
    if (isTab) return line.split('\t').map((c) => c.trim().replace(/^"|"$/g, ''));
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  // Column matching dictionary
  const fieldMap = {
    sku: ['sku', 'itemcode', 'code', 'barcode', 'id'],
    name: ['name', 'productname', 'product', 'item', 'description', 'title'],
    category: ['category', 'group', 'type', 'dept', 'department'],
    unit: ['unit', 'packsize', 'uom', 'measurement'],
    cost_price: ['costprice', 'cost', 'buyprice', 'purchaseprice', 'unitcost'],
    selling_price: ['sellingprice', 'price', 'retailprice', 'sellprice', 'unitprice', 'retail'],
    stock_quantity: ['stockquantity', 'stock', 'qty', 'quantity', 'initialstock', 'count'],
    reorder_level: ['reorderlevel', 'reorder', 'minstock', 'lowstock', 'alertlevel'],
    supplier_name: ['suppliername', 'supplier', 'vendor', 'distributor'],
  };

  const colIndices = {};
  for (const [field, aliases] of Object.entries(fieldMap)) {
    const idx = headers.findIndex((h) => aliases.some((a) => h.includes(a)));
    if (idx !== -1) colIndices[field] = idx;
  }

  const parsedRows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.length === 0 || cols.every((c) => !c)) continue;

    const row = {
      sku: colIndices.sku !== undefined ? cols[colIndices.sku] : `SKU-${Date.now().toString().slice(-4)}-${i}`,
      name: colIndices.name !== undefined ? cols[colIndices.name] : '',
      category: colIndices.category !== undefined ? cols[colIndices.category] : 'Provisions',
      unit: colIndices.unit !== undefined ? cols[colIndices.unit] : 'Pack',
      cost_price: Math.max(0, Number(cols[colIndices.cost_price] || 0)),
      selling_price: Math.max(0, Number(cols[colIndices.selling_price] || 0)),
      stock_quantity: Math.max(0, Number(cols[colIndices.stock_quantity] || 0)),
      reorder_level: Math.max(0, Number(cols[colIndices.reorder_level] ?? 5)),
      supplier_name: colIndices.supplier_name !== undefined ? cols[colIndices.supplier_name] : '',
    };

    if (row.name) {
      parsedRows.push(row);
    }
  }

  return parsedRows;
}

/**
 * Bulk Product Import Modal
 * Supports CSV file uploads, drag-and-drop, and direct pasting from Microsoft Excel / Google Sheets
 */
export function BulkImportModal({
  isOpen,
  onClose,
  onImportSuccess,
  apiFetch,
  formatCurrency,
  toastSuccess,
  toastError,
}) {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'paste'
  const [pasteContent, setPasteContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedProducts, setParsedProducts] = useState([]);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'stockflow_lagos_inventory_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text === 'string') {
        const rows = parseDelimitedText(text);
        setParsedProducts(rows);
      }
    };
    reader.readAsText(file);
  };

  const handleProcessPastedText = () => {
    if (!pasteContent.trim()) {
      toastError?.('Please paste table data from Excel or a CSV file.');
      return;
    }
    const rows = parseDelimitedText(pasteContent);
    setParsedProducts(rows);
    if (rows.length === 0) {
      toastError?.('Could not detect valid product rows. Please check headers.');
    }
  };

  const handleExecuteImport = async () => {
    if (parsedProducts.length === 0) {
      toastError?.('No products to import.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/v1/inventory/bulk-import', {
        method: 'POST',
        body: JSON.stringify({
          products: parsedProducts,
          updateExisting,
        }),
      });

      toastSuccess?.(
        `Successfully imported ${res.importedCount} new products (${res.updatedCount} updated)!`
      );
      setParsedProducts([]);
      setPasteContent('');
      setFileName('');
      onImportSuccess?.();
      onClose();
    } catch (err) {
      toastError?.(err.message || 'Bulk import failed. Please verify CSV columns.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Product Import (CSV / Excel)"
      subtitle="Import your entire shop catalog in seconds using CSV or by pasting directly from Excel"
    >
      <div className="space-y-4">
        {/* Step Tabs & Template Download Header */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-2 border-b theme-divider">
          <div className="flex rounded-xl p-1 liquid-glass-subtle gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                activeTab === 'upload' ? 'liquid-btn-primary shadow-xs' : 'text-theme-secondary'
              }`}
            >
              Upload File (.csv)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                activeTab === 'paste' ? 'liquid-btn-primary shadow-xs' : 'text-theme-secondary'
              }`}
            >
              Paste from Excel
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadSample}
            className="liquid-glass-subtle px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 text-theme-brand hover:opacity-80 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Excel Sample Template</span>
          </button>
        </div>

        {/* Tab 1: File Upload */}
        {activeTab === 'upload' && (
          <div className="space-y-3">
            <div className="border-2 border-dashed border-[var(--border-outer)] rounded-2xl p-6 text-center space-y-2 hover:border-[var(--brand-blue)] transition cursor-pointer relative">
              <input
                type="file"
                accept=".csv,.txt,.tsv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="w-10 h-10 mx-auto rounded-2xl liquid-btn-primary flex items-center justify-center pointer-events-none">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <p className="text-xs font-bold text-theme-primary">
                {fileName ? fileName : 'Choose or drag & drop a .csv file here'}
              </p>
              <p className="text-[11px] text-theme-secondary">
                Supports CSV, TSV, and text exports from Microsoft Excel and Google Sheets
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Direct Paste from Excel */}
        {activeTab === 'paste' && (
          <div className="space-y-2.5">
            <div className="text-[11px] text-theme-secondary flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-theme-brand shrink-0" />
              <span>
                Tip: In Excel or Google Sheets, highlight your columns (SKU, Name, Price, etc.), press <strong>Ctrl+C</strong>, and paste below.
              </span>
            </div>
            <textarea
              rows={5}
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder="Paste table data with headers from Excel here..."
              className="liquid-input w-full p-3 rounded-2xl text-xs font-mono"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleProcessPastedText}
              className="w-full"
            >
              Parse Pasted Rows
            </Button>
          </div>
        )}

        {/* Live Preview of Parsed Products */}
        {parsedProducts.length > 0 && (
          <div className="space-y-3 pt-2 border-t theme-divider">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="success">
                  {parsedProducts.length} Products Detected
                </Badge>
                <label className="flex items-center gap-1.5 text-xs text-theme-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                  />
                  <span>Update existing items if SKU or name matches</span>
                </label>
              </div>

              <button
                type="button"
                onClick={() => setParsedProducts([])}
                className="text-xs font-bold text-theme-outflow hover:underline cursor-pointer"
              >
                Clear Preview
              </button>
            </div>

            <div className="liquid-glass-subtle rounded-2xl overflow-hidden border max-h-56 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b theme-divider text-[10px] uppercase font-bold text-theme-secondary bg-white/20 dark:bg-black/20">
                  <tr>
                    <th className="py-2 px-3">SKU</th>
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3 text-right">Cost</th>
                    <th className="py-2 px-3 text-right">Selling</th>
                    <th className="py-2 px-3 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y theme-divider">
                  {parsedProducts.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/30 dark:hover:bg-white/5">
                      <td className="py-2 px-3 font-mono text-[11px] text-theme-secondary truncate max-w-[90px]">
                        {row.sku}
                      </td>
                      <td className="py-2 px-3 font-bold text-theme-primary">
                        {row.name}
                      </td>
                      <td className="py-2 px-3 text-theme-secondary text-[11px]">
                        {row.category}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">
                        {formatCurrency(row.cost_price)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-theme-primary tabular-nums">
                        {formatCurrency(row.selling_price)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-theme-inflow font-bold">
                        {row.stock_quantity} {row.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedProducts.length > 50 && (
                <div className="p-2 text-center text-[11px] text-theme-secondary border-t theme-divider">
                  Showing first 50 of {parsedProducts.length} rows
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t theme-divider">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>

          <Button
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={parsedProducts.length === 0}
            onClick={handleExecuteImport}
            className="!px-6"
          >
            Import {parsedProducts.length > 0 ? `${parsedProducts.length} Products` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
