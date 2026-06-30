import * as XLSX from 'xlsx';
import Papa from 'papaparse';

/**
 * Parses an uploaded file (either CSV or Excel) and returns its rows as an array of objects.
 * If currentItems is provided, it performs robust matching and maps quantities directly.
 * Also parses daily collections and expenses if they are listed in the sheet.
 *
 * Supports two-row merged headers (e.g. Deepak Nitrate Daily Summary format):
 *   Row 0: Category | <date> | CP | <outlet name>   ← parent header (item name lives here)
 *   Row 1: (blank)  | (blank)| (blank) | Sent | Sold | Wastage | SP | Revenue ...  ← sub-header
 *
 * @param {File} file
 * @param {Array} currentItems
 * @returns {Promise<Object>}
 */
export const parseImportFile = (file, currentItems = null) => {
  return new Promise((resolve, reject) => {
    const fileName = file.name.toLowerCase();

    // ─── helpers ────────────────────────────────────────────────────────────

    const cleanNumericValue = (val) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const cleaned = val.replace(/[₹$,\s]/g, '');
        const num = Number(cleaned);
        if (!isNaN(num) && cleaned !== '') return num;
      }
      return null;
    };

    /**
     * Returns true if the cell value looks like a quantity/numeric header
     * (Sent, Sold, SP, CP, Wastage, Revenue, Costing, NP …)
     * rather than a label/name column.
     */
    const isQuantityKeyword = (str) => {
      const s = str.trim().toLowerCase();
      return (
        s.includes('sent') ||
        s.includes('sold') ||
        s.includes('sp') ||
        s.includes('wastage') ||
        s.includes('revenue') ||
        s.includes('costing') ||
        s.includes('np') ||
        s.includes('cp')
      );
    };

    // ─── header detection ────────────────────────────────────────────────────

    /**
     * Scans up to the first 10 rows and returns the index of the row that
     * contains the most quantity-style column keywords (≥ 3 matches).
     * This is the "sub-header" row (row 1 in a two-row merged header).
     */
    const findSubHeaderRowIndex = (arrayOfArrays) => {
      for (let i = 0; i < Math.min(arrayOfArrays.length, 10); i++) {
        const row = arrayOfArrays[i];
        if (!row || !Array.isArray(row)) continue;
        const rowLower = row.map(cell => String(cell || '').trim().toLowerCase());
        const matchCount = rowLower.filter(cell => isQuantityKeyword(cell)).length;
        if (matchCount >= 3) return i;
      }
      return 0; // fallback: treat row 0 as header
    };

    // ─── core parser ─────────────────────────────────────────────────────────

    const parseRowsToArrayOfObjects = (arrayOfArrays) => {
      if (!arrayOfArrays || arrayOfArrays.length === 0) return [];

      // Normalize all rows to dense arrays to prevent sparse array issues
      const maxCols = Math.max(...arrayOfArrays.map(r => Array.isArray(r) ? r.length : 0));
      const denseRows = arrayOfArrays.map(row => {
        if (!Array.isArray(row)) return [];
        const dense = [];
        for (let c = 0; c < maxCols; c++) {
          dense.push(row[c] !== undefined && row[c] !== null ? row[c] : '');
        }
        return dense;
      });

      const subHeaderRowIndex = findSubHeaderRowIndex(denseRows);
      const subHeaderRow = denseRows[subHeaderRowIndex].map(h => String(h || '').trim());

      // Build merged column headers:
      //  • For each column, use the sub-header cell value if non-empty.
      //  • If the sub-header cell is blank, inherit from the parent row (one row above).
      //  • The column that holds item names (non-quantity text in the parent row, blank
      //    in the sub-header) is tagged '__item__' so processRows can find it reliably.
      let mergedHeaders = [...subHeaderRow];
      let itemNameColIndex = -1;

      if (subHeaderRowIndex > 0) {
        const parentRow = denseRows[subHeaderRowIndex - 1].map(h => String(h || '').trim());

        mergedHeaders = subHeaderRow.map((subCell, colIdx) => {
          if (subCell !== '') return subCell; // sub-header wins

          const parentCell = parentRow[colIdx] || '';
          if (parentCell === '') return '';

          // Decide whether this parent cell is the item-name column:
          // It must NOT be a category column AND NOT be a quantity keyword.
          const parentLower = parentCell.toLowerCase();
          const looksLikeCategory = parentLower.includes('category');
          const looksLikeQuantityHeader = isQuantityKeyword(parentCell);

          if (!looksLikeCategory && !looksLikeQuantityHeader) {
            // Mark first such column as the item-name column
            if (itemNameColIndex === -1) {
              itemNameColIndex = colIdx;
              console.log("[fileParser] Mapping column index", colIdx, `("${parentCell}") as the item-name identifier column.`);
              return '__item__';
            }
          }

          return parentCell; // use parent label as-is (e.g. "Category", "CP")
        });
      }

      // Deduplicate blank / colliding header names so no key is silently overwritten
      const headerCount = {};
      const finalHeaders = mergedHeaders.map(h => {
        const key = h === '' ? '__blank__' : h;
        headerCount[key] = (headerCount[key] || 0) + 1;
        return headerCount[key] === 1 ? key : `${key}_${headerCount[key]}`;
      });

      // Build row objects from data rows (everything below the sub-header)
      const dataRows = [];
      for (let i = subHeaderRowIndex + 1; i < denseRows.length; i++) {
        const row = denseRows[i];
        if (!row || !Array.isArray(row)) continue;

        const obj = {};
        let hasData = false;
        finalHeaders.forEach((header, colIndex) => {
          if (header) {
            const val = row[colIndex];
            obj[header] = val !== undefined && val !== null ? val : '';
            if (val !== undefined && val !== null && val !== '') hasData = true;
          }
        });
        if (hasData) dataRows.push(obj);
      }

      return dataRows;
    };

    // ─── item + collection + expense mapping ─────────────────────────────────

    const processRows = (rows) => {
      if (!currentItems) return { rawData: rows };

      const updatedItems = [...currentItems];
      const collections = {};
      const expenses = {};
      const unmatched = [];
      let matchCount = 0;

      const excludeLabels = new Set([
        'total', 'cash', 'gpay', 'google pay', 'online', 'salary', 'wage', 'wages',
        'transp', 'transport', 'travel', 'corp', 'corporate', 'admin', 'other',
        'misc', 'miscellaneous', 'food cost', 'gp', 'gross profit', 'indirect exp',
        'np', 'net profit', 'item name', 'item_name', 'name', 'menu item',
        'menu_item', 'menu items', 'items', 'category',
      ]);

      rows.forEach(row => {
        // ── 1. Match row to a menu item ──────────────────────────────────────
        let matchedItemIndex = -1;
        let hasItemNameCandidate = null;

        // Prefer the dedicated '__item__' column; fall back to scanning all string cells
        const candidateKeys = '__item__' in row
          ? ['__item__', ...Object.keys(row).filter(k => k !== '__item__')]
          : Object.keys(row);

        for (const key of candidateKeys) {
          const val = row[key];
          if (typeof val === 'string' && val.trim() !== '') {
            const valTrimmed = val.trim().toLowerCase();
            matchedItemIndex = updatedItems.findIndex(
              item => item.name.toLowerCase() === valTrimmed
            );
            if (matchedItemIndex !== -1) break;

            if (!excludeLabels.has(valTrimmed) && valTrimmed.length > 1) {
              hasItemNameCandidate = val.trim();
            }
          }
        }

        if (matchedItemIndex !== -1) {
          const item = updatedItems[matchedItemIndex];

          let manualQty = null;
          let totalSold = null;
          let sentQty = null;

          for (const key in row) {
            const keyLower = key.toLowerCase();
            const numVal = cleanNumericValue(row[key]);
            if (numVal === null) continue;

            if (keyLower.includes('manual') || keyLower.includes('counter') || keyLower.includes('added')) {
              manualQty = numVal;
            } else if (keyLower.includes('sold') && !keyLower.includes('digital') && !keyLower.includes('pos')) {
              totalSold = numVal;
            } else if (keyLower.includes('sent') || keyLower.includes('dispatch')) {
              sentQty = numVal;
            }
          }

          let hasUpdated = false;

          if (manualQty !== null) {
            item.counterSoldQty = manualQty;
            hasUpdated = true;
          } else if (totalSold !== null) {
            const digital = Number(item.digitalSoldQty) || 0;
            const pos = Number(item.posSoldQty) || 0;
            item.counterSoldQty = Math.max(0, totalSold - (digital + pos));
            hasUpdated = true;
          }

          if (sentQty !== null) {
            item.sentQty = sentQty;
            hasUpdated = true;
          }

          if (hasUpdated) matchCount++;

        } else if (hasItemNameCandidate) {
          // Track unmatched item names that have numeric data (for user feedback)
          const hasNumericData = Object.values(row).some(v => cleanNumericValue(v) !== null);
          if (hasNumericData && !unmatched.includes(hasItemNameCandidate)) {
            unmatched.push(hasItemNameCandidate);
          }
        }

        // ── 2. Parse collections and expenses from the same row ──────────────
        for (const key in row) {
          const val = row[key];
          if (typeof val !== 'string' || val.trim() === '') continue;

          const valLower = val.trim().toLowerCase();
          let category = null;
          let field = null;

          if (valLower === 'cash') {
            category = 'collections'; field = 'actualCash';
          } else if (valLower === 'gpay' || valLower === 'google pay' || valLower === 'online') {
            category = 'collections'; field = 'actualGpay';
          } else if (valLower === 'salary' || valLower === 'wage' || valLower === 'wages') {
            category = 'expenses'; field = 'salary';
          } else if (valLower === 'transp' || valLower === 'transport' || valLower === 'travel') {
            category = 'expenses'; field = 'transport';
          } else if (valLower === 'corp' || valLower === 'corporate' || valLower === 'admin') {
            category = 'expenses'; field = 'corp';
          } else if (valLower === 'other' || valLower === 'misc' || valLower === 'miscellaneous') {
            category = 'expenses'; field = 'other';
          }

          if (category && field) {
            for (const k in row) {
              if (k === key) continue;
              const numVal = cleanNumericValue(row[k]);
              if (numVal !== null) {
                if (category === 'collections') collections[field] = numVal;
                else expenses[field] = numVal;
                break;
              }
            }
          }
        }
      });

      return { items: updatedItems, collections, expenses, matchCount, unmatched, rawParsedRows: rows };
    };

    // ─── file reading ────────────────────────────────────────────────────────

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          const processedObjects = parseRowsToArrayOfObjects(jsonData);
          resolve(processRows(processedObjects));
        } catch (error) {
          reject(new Error('Failed to parse Excel file: ' + error.message));
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors && results.errors.length > 0) {
            reject(new Error(results.errors[0].message));
          } else {
            const processedObjects = parseRowsToArrayOfObjects(results.data);
            resolve(processRows(processedObjects));
          }
        },
        error: (error) => reject(error),
      });
    }
  });
};