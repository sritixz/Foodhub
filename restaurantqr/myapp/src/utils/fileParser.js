import * as XLSX from 'xlsx';
import Papa from 'papaparse';

/**
 * Parses an uploaded file (either CSV or Excel) and returns its rows as an array of objects.
 * If currentItems is provided, it performs robust matching and maps quantities directly.
 * Also parses daily collections and expenses if they are listed in the sheet.
 * 
 * @param {File} file 
 * @param {Array} currentItems 
 * @returns {Promise<Object>}
 */
export const parseImportFile = (file, currentItems = null) => {
  return new Promise((resolve, reject) => {
    const fileName = file.name.toLowerCase();
    
    const processRows = (rows) => {
      if (!currentItems) {
        return { rawData: rows };
      }
      
      const updatedItems = [...currentItems];
      const collections = {};
      const expenses = {};
      let matchCount = 0;
      
      rows.forEach(row => {
        // 1. Try to find if this row corresponds to a menu item
        let matchedItemIndex = -1;
        
        for (const key in row) {
          const val = row[key];
          if (typeof val === 'string' && val.trim() !== '') {
            const valTrimmed = val.trim().toLowerCase();
            matchedItemIndex = updatedItems.findIndex(i => i.name.toLowerCase() === valTrimmed);
            if (matchedItemIndex !== -1) {
              break;
            }
          }
        }
        
        if (matchedItemIndex !== -1) {
          const item = updatedItems[matchedItemIndex];
          
          // Search row properties for values
          let manualQty = null;
          let totalSold = null;
          let sentQty = null;
          
          for (const key in row) {
            const keyLower = key.toLowerCase();
            const val = row[key];
            
            if (val !== undefined && val !== null && val !== '' && !isNaN(val)) {
              const numVal = Number(val);
              
              // Check if this is manual added qty
              if (keyLower.includes('manual') || keyLower.includes('counter') || keyLower.includes('added')) {
                manualQty = numVal;
              }
              // Check if this is total sold qty
              else if (keyLower.includes('sold') && !keyLower.includes('digital') && !keyLower.includes('pos')) {
                totalSold = numVal;
              }
              // Check if this is sent/dispatch qty
              else if (keyLower.includes('sent') || keyLower.includes('dispatch')) {
                sentQty = numVal;
              }
            }
          }
          
          // Update item fields based on what was found in the row
          let hasUpdated = false;
          
          // For VendorDailyLog
          if (manualQty !== null) {
            item.counterSoldQty = manualQty;
            hasUpdated = true;
          } else if (totalSold !== null) {
            // totalSold = digital + pos + manual -> manual = totalSold - digital - pos
            const digital = Number(item.digitalSoldQty) || 0;
            const pos = Number(item.posSoldQty) || 0;
            item.counterSoldQty = Math.max(0, totalSold - (digital + pos));
            hasUpdated = true;
          }
          
          // For CentralKitchenDispatch
          if (sentQty !== null) {
            item.sentQty = sentQty;
            hasUpdated = true;
          }
          
          if (hasUpdated) {
            matchCount++;
          }
        }
        
        // 2. Try to find collections and expenses in the row
        for (const key in row) {
          const val = row[key];
          if (typeof val === 'string' && val.trim() !== '') {
            const valLower = val.trim().toLowerCase();
            
            let category = null;
            let field = null;
            
            if (valLower === 'cash') {
              category = 'collections';
              field = 'actualCash';
            } else if (valLower === 'gpay' || valLower === 'google pay' || valLower === 'online') {
              category = 'collections';
              field = 'actualGpay';
            } else if (valLower === 'salary' || valLower === 'wage' || valLower === 'wages') {
              category = 'expenses';
              field = 'salary';
            } else if (valLower === 'transp' || valLower === 'transport' || valLower === 'travel') {
              category = 'expenses';
              field = 'transport';
            } else if (valLower === 'corp' || valLower === 'corporate' || valLower === 'admin') {
              category = 'expenses';
              field = 'corp';
            } else if (valLower === 'other' || valLower === 'misc' || valLower === 'miscellaneous') {
              category = 'expenses';
              field = 'other';
            }
            
            if (category && field) {
              // Find a numeric value in the same row
              for (const k in row) {
                if (k === key) continue; // skip the label cell
                const numVal = row[k];
                if (numVal !== undefined && numVal !== null && numVal !== '' && !isNaN(numVal)) {
                  const num = Number(numVal);
                  if (category === 'collections') {
                    collections[field] = num;
                  } else {
                    expenses[field] = num;
                  }
                  break;
                }
              }
            }
          }
        }
      });
      
      return { items: updatedItems, collections, expenses, matchCount };
    };

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(processRows(jsonData));
        } catch (error) {
          reject(new Error('Failed to parse Excel file: ' + error.message));
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors && results.errors.length > 0) {
            reject(new Error(results.errors[0].message));
          } else {
            resolve(processRows(results.data));
          }
        },
        error: (error) => {
          reject(error);
        }
      });
    }
  });
};
