/**
 * Copyright (c) 2025 Symphoni.
 * All Rights Reserved.
 *
 * The following JavaScript source code is intended for use on the NetSuite platform.
 * This software is the confidential and proprietary information of Osmose, Inc.
 * You shall not disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into with Osmose.
 *
 * Script Name: SAI | Transform Inv From SO CSV File|MR.js
 * Description:
 * This MapReduce script processes a CSV file containing Sales Order (SO) data 
 * to transform them into invoices within NetSuite.
 *
 * Version History:
 * | Version | Date       | Author          | Remarks                                  |
 * |---------|------------|-----------------|------------------------------------------|
 * | 1.00    | 2025-06-03 | Himanshu Kumar  | Initial version                          |
 * | 1.01    | 2025-06-03 | Himanshu Kumar  | Added custom form ID 273 for Invoice      |
 * | 1.02    | 2025-06-03 | [Your Name]     | Fixed date parsing, validation, and logging |
 * | 1.03    | 2025-06-03 | [Your Name]     | Enhanced reduce stage logging and error handling |
 */

/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/runtime', 'N/search', 'N/error', 'N/file', 'N/format', 'N/log'],
    (record, runtime, search, error, file, format, log) => {

        /**
         * Parses a CSV line, handling quoted fields that may contain commas.
         * @param {string} line - A single line from the CSV.
         * @returns {string[]} - Array of parsed field values.
         */
        function parseCSVLine(line) {
            log.debug({
                title: 'parseCSVLine Input',
                details: `Processing CSV line: ${line}`
            });
            const result = [];
            let currentField = '';
            let insideQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    insideQuotes = !insideQuotes;
                } else if (char === ',' && !insideQuotes) {
                    result.push(currentField.trim());
                    currentField = '';
                } else {
                    currentField += char;
                }
            }
            result.push(currentField.trim());
            const parsedFields = result.map(field => {
                if (field.startsWith('"') && field.endsWith('"')) {
                    return field.slice(1, -1).replace('""', '"');
                }
                return field;
            });
            log.debug({
                title: 'parseCSVLine Output',
                details: `Parsed fields: ${JSON.stringify(parsedFields)}`
            });
            return parsedFields;
        }

        /**
         * Entry point for the MapReduce script.
         * @returns {Object} Array of parsed CSV data.
         */
        const getInputData = () => {
            try {
                log.audit('getInputData Started', 'Fetching CSV file and parsing data');
                const scriptObj = runtime.getCurrentScript();
                const csvFileId = scriptObj.getParameter({ name: 'custscript_sai_so_csv_file_id' });
                log.debug('csvFileId', csvFileId);

                if (!csvFileId) {
                    throw error.create({
                        name: 'MISSING_FILE_ID',
                        message: 'CSV File ID parameter is missing.'
                    });
                }

                const fileObj = file.load({ id: csvFileId });
                const csvContent = fileObj.getContents();
                log.debug('csvContent', csvContent);

                const rows = csvContent.split('\n').filter(row => row.trim() !== '');
                if (rows.length <= 1) {
                    throw error.create({
                        name: 'EMPTY_CSV',
                        message: 'CSV file is empty or contains only headers.'
                    });
                }

                const headers = parseCSVLine(rows[0]);
                log.debug('parsedHeaders', headers);

                const requiredColumns = ['Internal ID', 'Date', 'SO External ID', 'Item Internal Id', 'Document Number', 'Line Sequence Number'];
                const missingColumns = requiredColumns.filter(col => !headers.includes(col));
                if (missingColumns.length > 0) {
                    throw error.create({
                        name: 'MISSING_COLUMNS',
                        message: `Missing required columns in CSV: ${missingColumns.join(', ')}`
                    });
                }

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
                    record['Date'] = row[1] || '';
                    data.push(record);
                }

                log.debug('parsedData', JSON.stringify(data));

                data.forEach((record, index) => {
                    if (!record['Date'] || record['Date'].trim() === '') {
                        log.error('Empty Date Field', `Record ${index + 1}, Internal ID: ${record['Internal ID']}, Date: ${record['Date']}`);
                    }
                });

                log.audit('getInputData Completed', `Parsed ${data.length} records`);
                return data;
            } catch (e) {
                log.error('Error in getInputData', `${e.name}: ${e.message}`);
                throw e;
            }
        };

        /**
         * Map stage processes each line from the input.
         * @param {Object} context - Contains the key-value pair for processing.
         */
        const map = (context) => {
            try {
                log.debug('Map Stage Started', `Processing context: ${context.value}`);
                const recordData = JSON.parse(context.value);
                log.debug('recordData', JSON.stringify(recordData));

                const externalId = recordData['SO External ID'];
                const sequenceNo = recordData['Line Sequence Number'];
                let transactionDate = recordData['Date'];
                const itemExternalId = recordData['Item Internal Id'];
                const saiInvId = recordData['Internal ID'];
                const quantity = recordData['Quantity'];
                const quotedRate = recordData['Quoted Rate'];
                const amount = recordData['Amount'];
                const tranId = recordData['Document Number'];
                const itemName = recordData['Item'];

                transactionDate = formatDate(transactionDate);
                if (!transactionDate) {
                    log.error('Invalid Date', `Skipping record with Internal ID: ${saiInvId}, Date: ${recordData['Date']}`);
                    return;
                }

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
                log.debug('Sales Order Found', `External ID: ${externalId}, Internal ID: ${salesOrderId}`);

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
                    log.debug('Item Found', `Item External ID: ${itemExternalId}, Internal ID: ${itemId}`);
                }

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
                log.debug('Map Stage Completed', `Wrote data for Internal ID: ${saiInvId}`);
            } catch (e) {
                log.error('Error in Map Stage', `${e.name}: ${e.message}`);
                throw e;
            }
        };

        /**
         * Reduce stage processes grouped data by key.
         * @param {Object} context - Contains the grouped data for processing.
         */
        const reduce = (context) => {
            try {
                log.debug('Reduce Stage Started', `Processing key: ${context.key}, values: ${context.values.length}`);
                const saiInvId = context.key;
                const reduceValues = context.values.map(JSON.parse);
                log.debug('reduceValues', JSON.stringify(reduceValues));

                const salesOrderId = reduceValues[0].salesOrderId;
                log.debug('Transforming Sales Order', `Sales Order ID: ${salesOrderId}`);

                // Validate Sales Order before transformation
                const salesOrder = record.load({
                    type: record.Type.SALES_ORDER,
                    id: salesOrderId,
                    isDynamic: false
                });
                log.debug('Sales Order Loaded', `Sales Order ID: ${salesOrderId}, Status: ${salesOrder.getValue('status')}`);

                const invoiceRecord = record.transform({
                    fromType: record.Type.SALES_ORDER,
                    fromId: salesOrderId,
                    toType: record.Type.INVOICE,
                    isDynamic: true,
                    defaultValues: {
                        customform: '273'
                    }
                });
                log.debug('Invoice Transformation', 'Successfully transformed Sales Order to Invoice');

                if (reduceValues.length > 0) {
                    const { transactionDate, saiInvId, tranId } = reduceValues[0];
                    log.debug('Setting Invoice Fields', `Date: ${transactionDate}, SAI Inv ID: ${saiInvId}, Tran ID: ${tranId}`);

                    try {
                        invoiceRecord.setValue({
                            fieldId: 'trandate',
                            value: format.parse({
                                value: transactionDate,
                                type: format.Type.DATE
                            })
                        });
                        log.debug('Set Field', `trandate: ${transactionDate}`);
                    } catch (e) {
                        log.error('Error Setting trandate', `${e.name}: ${e.message}`);
                        throw e;
                    }

                    invoiceRecord.setValue({
                        fieldId: 'externalid',
                        value: `SAI_INV_${saiInvId}`
                    });
                    log.debug('Set Field', `externalid: SAI_INV_${saiInvId}`);

                    invoiceRecord.setValue({
                        fieldId: 'custbody_ng_media_doc_number',
                        value: tranId
                    });
                    log.debug('Set Field', `custbody_ng_media_doc_number: ${tranId}`);

                    invoiceRecord.setValue({
                        fieldId: 'tranid',
                        value: tranId
                    });
                    log.debug('Set Field', `tranid: ${tranId}`);

                    const postingPeriod = getCurrentPostingPeriod();
                    invoiceRecord.setValue({
                        fieldId: 'postingperiod',
                        value: postingPeriod
                    });
                    log.debug('Set Field', `postingperiod: ${postingPeriod}`);
                }

                reduceValues.sort((a, b) => parseInt(a.sequenceNo) - parseInt(b.sequenceNo));
                const csvItemIds = reduceValues.map(data => data.itemId).filter(id => id);
                log.debug('CSV Item IDs', JSON.stringify(csvItemIds));

                const lineCount = invoiceRecord.getLineCount({ sublistId: 'item' });
                log.debug('Initial Line Count', lineCount);
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
                        log.debug('Removed Line', `Line ${i} with Item ID: ${lineItemId}`);
                    }
                }

                reduceValues.forEach((csvData, index) => {
                    if (!csvData.itemId) {
                        log.error('Skipping Line', `No itemId for sequenceNo: ${csvData.sequenceNo}`);
                        return;
                    }

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
                        invoiceRecord.selectLine({
                            sublistId: 'item',
                            line: lineIndex
                        });
                        log.debug('Updating Line', `Line ${lineIndex}, Item ID: ${csvData.itemId}`);
                    } else {
                        invoiceRecord.selectNewLine({
                            sublistId: 'item'
                        });
                        log.debug('Adding New Line', `Item ID: ${csvData.itemId}`);
                    }

                    invoiceRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        value: csvData.itemId
                    });
                    invoiceRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'price',
                        value: -1
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
                    log.debug('Line Committed', `Sequence No: ${csvData.sequenceNo}, Item ID: ${csvData.itemId}`);
                });

                log.debug('Saving Invoice', 'Attempting to save invoice record');
                const invoiceId = invoiceRecord.save({ ignoreMandatoryFields: true });
                log.audit('Invoice Created', `Invoice for Sales Order ${salesOrderId} created successfully with ID: ${invoiceId}`);
            } catch (e) {
                log.error('Error in Reduce Stage', `${e.name}: ${e.message}`);
                throw e;
            }
        };

        /**
         * Finalize stage of the script.
         */
        const summarize = (summary) => {
            log.audit('Summary', {
                inputSummary: summary.inputSummary,
                mapSummary: summary.mapSummary,
                reduceSummary: summary.reduceSummary,
                errors: summary.mapSummary.errors.concat(summary.reduceSummary.errors)
            });
            if (summary.mapSummary.errors.length > 0 || summary.reduceSummary.errors.length > 0) {
                log.error('Script Errors', `Map Errors: ${JSON.stringify(summary.mapSummary.errors)}, Reduce Errors: ${JSON.stringify(summary.reduceSummary.errors)}`);
            }
            log.audit('Script Completed', 'MapReduce execution finished');
        };

        /**
         * Utility function to get the current posting period.
         * @returns {string} - The internal ID of the current posting period.
         */
        const getCurrentPostingPeriod = () => {
            try {
                log.debug('getCurrentPostingPeriod', 'Fetching current posting period');
                const today = new Date();
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const periodName = `${monthNames[today.getMonth()]} ${today.getFullYear()}`;
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

                if (postingPeriodSearch.length > 0) {
                    const internalId = postingPeriodSearch[0].getValue({ name: 'internalid' });
                    log.debug('Posting Period Found', `Internal ID: ${internalId}`);
                    return internalId;
                }

                throw error.create({
                    name: 'POSTING_PERIOD_NOT_FOUND',
                    message: `No open posting period found for ${periodName}.`
                });
            } catch (e) {
                log.error('Error getting posting period', `${e.name}: ${e.message}`);
                throw e;
            }
        };

        /**
         * Converts a date string in "DD-MM-YYYY" or "MM/DD/YYYY" to "MM/DD/YYYY".
         * @param {string} dateStr - The date string.
         * @returns {string|null} - The formatted date string in "MM/DD/YYYY" format, or null if invalid.
         */
        function formatDate(dateStr) {
            log.debug('formatDate Input', `Processing date: ${dateStr}`);
            if (!dateStr || typeof dateStr !== 'string' || dateStr.trim().length === 0) {
                log.error('Invalid Input', `dateStr: ${dateStr}, Type: ${typeof dateStr}`);
                return null;
            }

            let day, month, year;
            const trimmedDateStr = dateStr.trim();

            try {
                if (trimmedDateStr.includes('-')) {
                    const parts = trimmedDateStr.split('-');
                    if (parts.length === 3) {
                        [day, month, year] = parts.map(part => parseInt(part, 10));
                    } else {
                        log.error('Invalid Date Format', `Unrecognized format: ${trimmedDateStr}`);
                        return null;
                    }
                } else if (trimmedDateStr.includes('/')) {
                    const parts = trimmedDateStr.split('/');
                    if (parts.length === 3) {
                        [month, day, year] = parts.map(part => parseInt(part, 10));
                    } else {
                        log.error('Invalid Date Format', `Unrecognized format: ${trimmedDateStr}`);
                        return null;
                    }
                } else {
                    log.error('Invalid Date Format', `Unrecognized format: ${trimmedDateStr}`);
                    return null;
                }

                if (!isValidDate(day, month, year)) {
                    log.error('Invalid Date Values', `Day: ${day}, Month: ${month}, Year: ${year}`);
                    return null;
                }

                const formattedDate = `${month}/${day}/${year}`;
                log.debug('formatDate Output', `Formatted date: ${formattedDate}`);
                return formattedDate;
            } catch (e) {
                log.error('Error in formatDate', `${e.name}: ${e.message}`);
                return null;
            }
        }

        /**
         * Validates date fields for day, month, and year.
         * @param {number} day - Day of the month.
         * @param {number} month - Month (1-12).
         * @param {number} year - Year.
         * @returns {boolean} - True if the date is valid, false otherwise.
         */
        function isValidDate(day, month, year) {
            log.debug('isValidDate', `Validating: Day=${day}, Month=${month}, Year=${year}`);
            if (isNaN(day) || isNaN(month) || isNaN(year)) {
                log.error('Invalid Date Components', `Day: ${day}, Month: ${month}, Year: ${year}`);
                return false;
            }

            if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 9999) {
                log.error('Date Out of Range', `Day: ${day}, Month: ${month}, Year: ${year}`);
                return false;
            }

            const daysInMonth = [31, (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            if (day > daysInMonth[month - 1]) {
                log.error('Invalid Day for Month', `Day: ${day}, Month: ${month}, Max Days: ${daysInMonth[month - 1]}`);
                return false;
            }

            log.debug('isValidDate', 'Date is valid');
            return true;
        }

        return { getInputData, map, reduce, summarize };
    });