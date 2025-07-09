/**
 * Copyright (c) 2025 Symphoni.
 * All Rights Reserved.
 *
 * The following JavaScript source code is intended for use on the NetSuite
 * platform.
 * This software is the confidential and proprietary information of
 * Osmose, Inc. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Osmose.
 *
 * Script Name: SAI | Transform Inv From SO CSV File|MR.js
 * Description:
 * This MapReduce script processes a CSV file containing Sales Order (SO) data 
 * to transform them into invoices within NetSuite. The script:
 * 1. Reads a CSV file containing SO details.
 * 2. Searches for corresponding Sales Orders in NetSuite using external IDs.
 * 3. Transforms Sales Orders into Invoices, ensuring correct line items and pricing.
 * 4. Updates only matching line items and removes non-matching lines based on CSV data.
 * 5. Assigns necessary fields such as transaction date, location, amount, and quoted rate.
 * 6. Validates and formats data to maintain data integrity.
 * 7. Ensures invoices are created with correct posting periods and line sequence numbers.
 *
 * Version History:
 *
 * | Version | Date       | Author               | Remarks                                  |
 * |---------|------------|----------------------|------------------------------------------|
 * | 1.00    | 2025-04-28 | Himanshu Kumar       | Updated to handle line updates and removals during transform |
 */

/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/runtime', 'N/search', 'N/error', 'N/file', 'N/format'],
    (record, runtime, search, error, file, format) => {

        /**
         * Parses a CSV line, handling quoted fields that may contain commas.
         * @param {string} line - A single line from the CSV.
         * @returns {string[]} - Array of parsed field values.
         */
        function parseCSVLine(line) {
            const result = [];
            let currentField = '';
            let insideQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];

                if (char === '"') {
                    insideQuotes = !insideQuotes; // Toggle quote state
                } else if (char === ',' && !insideQuotes) {
                    result.push(currentField.trim());
                    currentField = ''; // Reset for next field
                } else {
                    currentField += char; // Add character to current field
                }
            }

            // Push the last field
            result.push(currentField.trim());

            // Remove quotes from quoted fields and handle escaped quotes
            return result.map(field => {
                if (field.startsWith('"') && field.endsWith('"')) {
                    return field.slice(1, -1).replace(/""/g, '"'); // Handle escaped quotes
                }
                return field;
            });
        }

        /**
         * Entry point for the MapReduce script.
         * @returns {Object} Array of parsed CSV data.
         */
        const getInputData = () => {
            try {
                const scriptObj = runtime.getCurrentScript();
                const csvFileId = scriptObj.getParameter({ name: 'custscript_sai_so_csv_file_id' });
                log.debug("csvFileId", csvFileId);

                if (!csvFileId) {
                    throw error.create({
                        name: 'MISSING_FILE_ID',
                        message: 'CSV File ID parameter is missing.'
                    });
                }

                const fileObj = file.load({ id: csvFileId });
                const csvContent = fileObj.getContents();
                log.debug("csvContent", csvContent);

                // Split into rows and filter out empty lines
                const rows = csvContent.split('\n').filter(row => row.trim() !== '');
                if (rows.length <= 1) {
                    throw error.create({
                        name: 'EMPTY_CSV',
                        message: 'CSV file is empty or contains only headers.'
                    });
                }

                // Parse headers using parseCSVLine
                const headers = parseCSVLine(rows[0]);
                log.debug("parsedHeaders", headers);

                // Validate required headers
                const requiredColumns = ['Internal ID', 'Date', 'SO External ID', 'Item Internal Id', 'Document Number', 'Line Sequence Number'];
                const missingColumns = requiredColumns.filter(col => !headers.includes(col));
                if (missingColumns.length > 0) {
                    throw error.create({
                        name: 'MISSING_COLUMNS',
                        message: `Missing required columns in CSV: ${missingColumns.join(', ')}`
                    });
                }

                // Parse data rows
                const data = [];
                for (let i = 1; i < rows.length; i++) {
                    const row = parseCSVLine(rows[i]);
                    if (row.length < headers.length) {
                        log.error('Invalid Row', `Row ${i + 1} has fewer columns than headers: ${row}`);
                        continue;
                    }

                    let record = {};
                    headers.forEach((header, index) => {
                        record[header] = row[index] || '';
                    });

                    // Ensure the Date field is from the second column (index 1)
                    record['Date'] = row[1] || '';
                    data.push(record);
                }

                log.debug("parsedData", data);

                // Log records with empty Date fields
                data.forEach((record, index) => {
                    if (!record['Date'] || record['Date'].trim() === '') {
                        log.error('Empty Date Field', `Record ${index + 1}, Internal ID: ${record['Internal ID']}, Date: ${record['Date']}`);
                    }
                });

                return data;
            } catch (e) {
                log.error('Error in getInputData', e.message);
                throw e;
            }
        };

        /**
         * Map stage processes each line from the input.
         * @param {Object} context - Contains the key-value pair for processing.
         */
        const map = (context) => {
            try {
                const recordData = JSON.parse(context.value);
                log.debug("recordData", recordData);

                const externalId = recordData["SO External ID"];
                const sequenceNo = recordData["Line Sequence Number"];
                let transactionDate = recordData["Date"];
                const itemExternalId = recordData["Item Internal Id"];
                const saiInvId = recordData["Internal ID"];
                const quantity = recordData["Quantity"];
                const quotedRate = recordData["Quoted Rate"];
                const amount = recordData["Amount"];
                const tranId = recordData["Document Number"];
                const itemName = recordData["Item"];

                // Validate and format the date
                transactionDate = formatDate(transactionDate);
                if (!transactionDate) {
                    log.error('Invalid Date', `Skipping record with Internal ID: ${saiInvId}, Date: ${recordData["Date"]}`);
                    return; // Skip records with invalid dates
                }

                // Search for Sales Order using external ID
                const salesOrderSearch = search.create({
                    type: 'salesorder',
                    filters: [['externalid', 'is', externalId]],
                    columns: ['internalid']
                }).run().getRange({ start: 0, end: 1 });

                if (!salesOrderSearch.length) {
                    log.error('Sales Order Not Found', `External ID: ${externalId}`);
                    return;
                }

                const salesOrderId = salesOrderSearch[0].getValue({ name: 'internalid' });
                log.debug("Item Name: " + itemName, "itemExternalId: " + itemExternalId);

                let itemId = '';
                if (itemExternalId) {
                    const itemSearch = search.create({
                        type: 'item',
                        filters: [['externalid', 'anyof', itemExternalId]],
                        columns: ['internalid']
                    }).run().getRange({ start: 0, end: 1 });

                    if (!itemSearch.length) {
                        log.error('Item Not Found', `Item External ID: ${itemExternalId}`);
                        return;
                    }

                    itemId = itemSearch[0].getValue({ name: 'internalid' });
                }

                // Write data to the Reduce stage
                context.write({
                    key: saiInvId,
                    value: JSON.stringify({
                        sequenceNo,
                        transactionDate,
                        itemId,
                        saiInvId,
                        salesOrderId,
                        quantity,
                        quotedRate,
                        amount,
                        tranId
                    })
                });

            } catch (e) {
                log.error('Error in Map Stage', e.message);
            }
        };

        /**
         * Reduce stage processes grouped data by key.
         * @param {Object} context - Contains the grouped data for processing.
         */
        const reduce = (context) => {
            try {
                const saiInvId = context.key;
                const reduceValues = context.values.map(JSON.parse);
                log.debug("reduceValues", reduceValues);

                const salesOrderId = reduceValues[0].salesOrderId;
                const invoiceRecord = record.transform({
                    fromType: record.Type.SALES_ORDER,
                    fromId: salesOrderId,
                    toType: record.Type.INVOICE,
                    isDynamic: true
                });

                if (reduceValues.length > 0) {
                    const { transactionDate, saiInvId, tranId } = reduceValues[0];
                    log.debug("transactionDate", transactionDate);

                    invoiceRecord.setValue({
                        fieldId: 'trandate',
                        value: format.parse({
                            value: transactionDate,
                            type: format.Type.DATE
                        })
                    });

                    invoiceRecord.setValue({
                        fieldId: 'externalid',
                        value: `SAI_INV_${saiInvId}`
                    });

                    invoiceRecord.setValue({
                        fieldId: 'custbody_ng_media_doc_number',
                        value: tranId
                    });

                    invoiceRecord.setValue({
                        fieldId: 'tranid',
                        value: tranId
                    });

                    invoiceRecord.setValue({
                        fieldId: 'postingperiod',
                        value: getCurrentPostingPeriod()
                    });
                }

                // Sort CSV data by Line Sequence Number
                reduceValues.sort((a, b) => parseInt(a.sequenceNo) - parseInt(b.sequenceNo));

                // Get the list of item IDs from CSV
                const csvItemIds = reduceValues.map(data => data.itemId).filter(id => id);

                // Remove non-matching lines
                const lineCount = invoiceRecord.getLineCount({ sublistId: 'item' });
                for (let i = lineCount - 1; i >= 0; i--) {
                    const lineItemId = invoiceRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: i
                    });
                    if (!csvItemIds.includes(lineItemId)) {
                        invoiceRecord.removeLine({
                            sublistId: 'item',
                            line: i,
                            ignoreRecalc: true
                        });
                    }
                }

                // Update or add matching lines
                reduceValues.forEach((csvData, index) => {
                    if (!csvData.itemId) {
                        log.error('Skipping Line', `No itemId for sequenceNo: ${csvData.sequenceNo}`);
                        return;
                    }

                    // Try to find an existing line with the same itemId
                    let lineIndex = -1;
                    const currentLineCount = invoiceRecord.getLineCount({ sublistId: 'item' });
                    for (let i = 0; i < currentLineCount; i++) {
                        const lineItemId = invoiceRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: i
                        });
                        if (lineItemId === csvData.itemId) {
                            lineIndex = i;
                            break;
                        }
                    }

                    if (lineIndex >= 0) {
                        // Update existing line
                        invoiceRecord.selectLine({
                            sublistId: 'item',
                            line: lineIndex
                        });
                    } else {
                        // Add new line
                        invoiceRecord.selectNewLine({
                            sublistId: 'item'
                        });
                    }

                    // Set line values
                    invoiceRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        value: csvData.itemId
                    });
                    invoiceRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'price',
                        value: -1 // Set price level to custom
                    });
                    invoiceRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        value: parseFloat(csvData.quantity) || 0
                    });
                    invoiceRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: parseFloat(csvData.quotedRate) || 0
                    });
                    invoiceRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        value: parseFloat(csvData.amount) || 0
                    });

                    invoiceRecord.commitLine({ sublistId: 'item' });
                });

                // Recalculate the invoice to ensure totals are correct
                invoiceRecord.save({ ignoreMandatoryFields: false });
                const invoiceId = invoiceRecord.id;
                log.audit('Invoice Created', `Invoice for Sales Order ${salesOrderId} created successfully with ID: ${invoiceId}`);
            } catch (e) {
                log.error('Error in Reduce Stage', e.message);
            }
        };

        /**
         * Finalize stage of the script.
         */
        const summarize = (summary) => {
            log.audit('Summary', {
                inputSummary: summary.inputSummary,
                mapSummary: summary.mapSummary,
                reduceSummary: summary.reduceSummary
            });
        };

        /**
         * Utility function to get the current posting period.
         * @returns {string} - The internal ID of the current posting period.
         * @throws {Error} - Throws an error if no open posting period is found.
         */
        const getCurrentPostingPeriod = () => {
            try {
                const today = new Date();
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const monthName = monthNames[today.getMonth()];
                const year = today.getFullYear();

                const periodName = `${monthName} ${year}`;
                log.debug('Period Name', periodName);

                const postingPeriodSearch = search.create({
                    type: 'accountingperiod',
                    filters: [
                        ['periodname', 'is', periodName],
                        'AND',
                        ['closed', 'is', 'F']
                    ],
                    columns: ['internalid']
                }).run().getRange({ start: 0, end: 1 });

                if (postingPeriodSearch.length) {
                    const internalId = postingPeriodSearch[0].getValue({ name: 'internalid' });
                    log.debug('Open Posting Period Found', `Internal ID: ${internalId}`);
                    return internalId;
                }

                throw error.create({
                    name: 'POSTING_PERIOD_NOT_FOUND',
                    message: `No open posting period found for ${periodName}.`
                });
            } catch (e) {
                log.error('Error in getCurrentPostingPeriod', e.message);
                throw e;
            }
        };

        /**
         * Converts a date string in "DD-MM-YYYY" or "MM/DD/YYYY" to "MM/DD/YYYY".
         * @param {string} dateStr - The date string.
         * @returns {string|null} - The formatted date string in "MM/DD/YYYY" format, or null if invalid.
         */
        function formatDate(dateStr) {
            if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') {
                log.error('Invalid Input', `dateStr: ${dateStr}`);
                return null; // Return null for invalid input
            }

            let day, month, year;
            const trimmedDateStr = dateStr.trim();

            if (trimmedDateStr.includes('-')) {
                // Handle "DD-MM-YYYY"
                const parts = trimmedDateStr.split('-');
                if (parts.length === 3) {
                    [day, month, year] = parts.map(part => parseInt(part, 10));
                }
            } else if (trimmedDateStr.includes('/')) {
                // Handle "MM/DD/YYYY"
                const parts = trimmedDateStr.split('/');
                if (parts.length === 3) {
                    [month, day, year] = parts.map(part => parseInt(part, 10));
                }
            } else {
                log.error('Invalid Date Format', `Unrecognized format: ${trimmedDateStr}`);
                return null;
            }

            if (!isValidDate(day, month, year)) {
                log.error('Invalid Date Parts', `Day: ${day}, Month: ${month}, Year: ${year}`);
                return null;
            }

            return `${month}/${day}/${year}`;
        }

        /**
         * Validates the day, month, and year values for a date.
         * @param {number} day - The day.
         * @param {number} month - The month.
         * @param {number} year - The year.
         * @returns {boolean} - True if the date is valid, false otherwise.
         */
        function isValidDate(day, month, year) {
            if (month < 1 || month > 12 || day < 1 || day > 31) return false;

            const daysInMonth = [31, (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            return day <= daysInMonth[month - 1];
        }

        return { getInputData, map, reduce, summarize };
    });