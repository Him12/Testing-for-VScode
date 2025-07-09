/**
 * Copyright (c) 2024 Osmose, Inc.
 * All Rights Reserved.
 *
 * Script Name: Osm_CreateTimeRecord_MR.js
 * Description: This script fetches data from the saved search, reads time tracking details from CSV files in the file cabinet,
 * creates time tracking records, and generates a result log file in the file cabinet.
 *
 * Version History:
 * | Version | Date       | Author           | Remarks                                  |
 * |---------|------------|------------------|------------------------------------------|
 * | 1.00    | 2025-05-14 | Yogesh Bhurley   | Initial version                          |
 */

/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/file', 'N/record', 'N/log', 'N/runtime', 'N/email'], (search, file, record, log, runtime, email) => {
    /**
     * Retrieves file IDs from a saved search to process CSV files.
     * @returns {Array<string>} Array of file IDs.
     */
    const getInputData = () => {
        const fileSearch = search.load({
            id: 'customsearch_ng_ous_sftp_file'
        });
        const fileIds = [];

        log.audit('getInputData', 'Running saved search: customsearch_ng_ous_sftp_file');

        fileSearch.run().each((result) => {
            const fileId = result.id;
            if (fileId) {
                fileIds.push(fileId);
                log.audit('File Found', `File ID: ${fileId}`);
            } else {
                log.error('Missing File ID', JSON.stringify(result));
            }
            return true;
        });

        if (fileIds.length === 0) {
            log.error('No Files Found', 'Saved search returned no file results.');
        } else {
            log.audit('Total Files', fileIds.length);
        }

        return fileIds;
    };

    /**
     * Processes each CSV file, parses its contents, and emits parsed data for the reduce phase.
     * @param {Object} context - The context object containing the file ID.
     * @param {string} context.value - The file ID to process.
     */
    const map = (context) => {
        const fileId = context.value;

        try {
            const csvFile = file.load({
                id: fileId
            });
            const csvContents = csvFile.getContents();
            const lines = csvContents.split('\n');
            const headers = lines[0].split(',').map((h) => h.trim());

            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;

                const values = lines[i].split(',');
                const lineObj = {};

                for (let j = 0; j < headers.length; j++) {
                    lineObj[headers[j]] = (values[j] || '').trim();
                }

                log.audit('Parsed Entry', JSON.stringify(lineObj));

                if (!lineObj['Date'] || !lineObj['Hours']) {
                    log.error('Validation Error', `Line ${i + 1} missing required fields`);
                    continue;
                }

                const formattedDate = validateAndFormatDate(lineObj['Date']);
                if (!formattedDate) {
                    log.error('Invalid Date Format', `Line ${i + 1} has an invalid date: ${lineObj['Date']}`);
                    continue;
                }

                lineObj['Date'] = formattedDate;
                lineObj.fileId = fileId;
                lineObj.fileName = csvFile.name;
                lineObj.line = i + 1;

                context.write({
                    key: i + 1,
                    value: JSON.stringify(lineObj),
                });
            }
        } catch (e) {
            log.error('MAP_ERROR', `File ID: ${fileId} - ${e.message}`);
        }
    };

    /**
     * Validates and formats a date string to MM/DD/YYYY format.
     * @param {string} dateStr - The date string to validate and format.
     * @returns {string|null} The formatted date string (MM/DD/YYYY) or null if invalid.
     */
    const validateAndFormatDate = (dateStr) => {
        log.audit('Date Validation', `Received date: ${dateStr}`);


        if (dateStr.indexOf('-') != -1) {
            const dateParts = dateStr.split('-');
            log.audit('Date received', dateStr.split('-'))
            if (dateParts.length === 3) {
                const [month, day, year] = dateParts;
                if (
                    !isNaN(month) &&
                    !isNaN(day) &&
                    !isNaN(year) &&
                    month >= 1 &&
                    month <= 12 &&
                    day >= 1 &&
                    day <= 31 &&
                    year.length === 4
                ) {
                    return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
                }
            }
        }

        const dateParts = dateStr.split('/');
        if (dateParts.length === 3) {
            const [month, day, year] = dateParts;

            log.audit('Date Validation', `Received MM/DD/YYYY format: ${month}/${day}/${year}`);

            if (
                !isNaN(month) &&
                !isNaN(day) &&
                !isNaN(year) &&
                month >= 1 &&
                month <= 12 &&
                day >= 1 &&
                day <= 31 &&
                year.length === 4
            ) {
                return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
            }
        }

        log.error('Invalid Date', `Invalid date format: ${dateStr}`);
        return null;
    };

    /**
     * Processes parsed CSV data to create time bill records.
     * @param {Object} context - The context object containing parsed data.
     * @param {Array<string>} context.values - Array of JSON stringified data entries.
     */
    const reduce = (context) => {
        const entry = JSON.parse(context.values[0]);

        const resultLine = {
            employeeNumber: entry['EmployeeNumber'],
            date: entry['Date'],
            hours: entry['Hours'],
            ptoType: entry['PTOType'],
            status: '',
            message: '',
        };

        try {
            log.audit('Reduce Start', `Processing entry: ${JSON.stringify(entry)}`);

            const employeeId = getEmployeeId(entry['EmployeeNumber']);
            const approvalStatus = 3;

            const formattedDate = validateAndFormatDate(entry['Date']);
            log.audit('formated date log', formattedDate);
            if (!formattedDate) {
                throw new Error(`Invalid date format: ${entry['Date']}`);
            }

            const timeRec = record.create({
                type: record.Type.TIME_BILL,
                isDynamic: true,
            });

            timeRec.setValue({
                fieldId: 'customform',
                value: 105
            });
            timeRec.setValue({
                fieldId: 'employee',
                value: employeeId
            });
            timeRec.setValue({
                fieldId: 'trandate',
                value: new Date(formattedDate)
            });
            timeRec.setValue({
                fieldId: 'hours',
                value: parseFloat(entry['Hours'])
            });
            timeRec.setValue({
                fieldId: 'approvalstatus',
                value: approvalStatus
            });

            if (entry['PTOType']) {
                const ptoId = getPTOId(entry['PTOType']);
                if (ptoId !== null) {
                    timeRec.setValue({
                        fieldId: 'custcol_osm_pto_note',
                        value: ptoId
                    });
                } else {
                    log.error('PTO ID Not Found', `No PTO ID for ${entry['PTOType']}`);
                }
            }

            // ✅ Set Service Item only if provided and valid
            if (entry['Service Item']) {
                const itemId = getItemId(entry['Service Item']);
                if (itemId) {
                    timeRec.setValue({
                        fieldId: 'item',
                        value: itemId
                    });
                } else {
                    log.warning('Invalid Service Item', `Skipping invalid service item: ${entry['Service Item']}`);
                }
            }

            const recId = timeRec.save({
                ignoreMandatoryFields: true
            });
            log.audit('Time Record Created', `Time record created with ID: ${recId}`);
            resultLine.status = 'Pass';
            resultLine.message = `Time record created - ID: ${recId}`;

            try {
                const originalFile = file.load({ id: entry.fileId });
                originalFile.folder = 2774279; // Archive folder
                const newFileId = originalFile.save();
                log.audit('File Moved to Archive', `File ${entry.fileName} moved to folder ID 2774279 as ${newFileId}`);
            } catch (moveErr) {
                log.error('File Move Error', `Could not move file ${entry.fileName} (ID: ${entry.fileId}): ${moveErr.message}`);
            }

        } catch (e) {
            resultLine.status = 'Fail';
            resultLine.message = e.message;
            log.error('Reduce Error', `Employee ${entry['EmployeeNumber']} failed: ${e.message}`);
        }


        context.write({
            key: `${entry['EmployeeNumber']}_${entry['Date']}`,
            value: JSON.stringify(resultLine),
        });
    };

    /**
     * Summarizes the results, creates a CSV log file, and sends it via email.
     * @param {Object} summary - The summary object containing output data.
     */
    const summarize = (summary) => {
        let csvContent = 'EmployeeNumber,Date,Hours,PTOType,Status,Message\n';

        summary.output.iterator().each((key, value) => {
            const result = JSON.parse(value);
            csvContent += [
                result.employeeNumber,
                result.date,
                result.hours,
                result.ptoType,
                result.status,
                result.message,
            ].join(',') + '\n';
            return true;
        });

        try {
            const logFile = file.create({
                name: `timetracking_log_${new Date().toISOString()}.csv`,
                fileType: file.Type.CSV,
                contents: csvContent,
                folder: 2772877,
            });

            const fileId = logFile.save();
            log.audit('Summary', `Log file saved with ID: ${fileId}`);

            email.send({
                author: -5,
                recipients: ['yogesh.bhurley@nagarro.com'],
                subject: 'Time Tracking Upload Log',
                body: 'Attached is the time tracking upload result.',
                attachments: [file.load({
                    id: fileId
                })],
            });

            log.audit('Email Sent', 'CSV log sent');
        } catch (e) {
            log.error('SUMMARY_ERROR', e.message);
        }
    };

    /**
     * Retrieves the internal ID of an employee based on their employee number (entityid).
     * @param {string} employeeNumber - The employee number (entityid) to look up.
     * @returns {string} The internal ID of the employee.
     * @throws {Error} If the employee is not found or employeeNumber is missing.
     */
    const getEmployeeId = (employeeNumber) => {
        log.audit('Looking up internal employee ID', employeeNumber);

        if (!employeeNumber) {
            throw new Error('Missing employeeNumber in data row');
        }

        const empSearch = search.create({
            type: 'employee',
            filters: [
                ['entityid', 'is', employeeNumber]
            ],
            columns: ['internalid'],
        });

        const results = empSearch.run().getRange({
            start: 0,
            end: 1
        });

        if (!results || results.length === 0) {
            throw new Error('Employee not found with entityid: ' + employeeNumber);
        }

        return results[0].getValue({
            name: 'internalid'
        });
    };

    /**
     * Mapping of PTO type names to their internal IDs.
     * @type {Object<string, number>}
     */
    const ptoTypes = {
        'Admin - General': 10,
        'Admin - Meetings': 8,
        'Admin - Sales Support': 9,
        'Admin - Support Activity': 16,
        'Admin BC Overhead cost project': 27,
        'Admin Overhead cost project (Finance, accounting, payroll, …)': 29,
        'Banked Vacation': 7,
        'Bereavement': 12,
        'Break': 11,
        'Condition Assessment Overhead cost Project': 26,
        'COVID': 17,
        'Design & Eng Overhead cost project': 23,
        'Emergency Closure': 1,
        'Floating Holiday': 2,
        'Holiday': 3,
        'HR Overhead cost project': 30,
        'Interco with PPSI': 25,
        'IT Overhead cost Project': 22,
        'Jury Duty': 4,
        'Meetings': 13,
        'Occasional Time cost Project': 5,
        'Opportunities Overhead cost project': 24,
        'Overhead cost Project for Office space improvement': 28,
        'PSC Demo - Int\'l': 20,
        'PSC Demo - US': 19,
        'Quarantine Time': 18,
        'System Down Time': 14,
        'Training': 15,
        'Training tracking Hours and expenses for Admin employees': 31,
        'Training tracking hours and expenses for Direct and FM Employees (Montreal Office)': 21,
        'Vacation Time': 6,
    };

    /**
     * Retrieves the internal ID for a given PTO type.
     * @param {string} ptoName - The name of the PTO type.
     * @returns {number|null} The internal ID of the PTO type or null if not found.
     */
    const getPTOId = (ptoName) => {
        return ptoTypes.hasOwnProperty(ptoName) ? ptoTypes[ptoName] : null;
    };

    /**
     * Converts approval status to a numeric value.
     * @param {string} status - The approval status ('Y' or other).
     * @returns {number} The numeric value (1 for 'Y', 2 otherwise).
     */
    const getApprovalValue = (status) => {
        return status === 'Y' ? 1 : 2;
    };

    /**
     * Retrieves the internal ID of an item based on its item code.
     * @param {string} itemCode - The item code to look up.
     * @returns {string|null} The internal ID of the item or null if not found.
     */
    const getItemId = (itemCode) => {
        if (!itemCode) {
            return null;
        }

        try {
            const itemSearch = search.create({
                type: 'item',
                filters: [
                    ['itemid', 'is', itemCode]
                ],
                columns: ['internalid'],
            });
            const results = itemSearch.run().getRange({
                start: 0,
                end: 1
            });
            return results.length > 0 ? results[0].getValue('internalid') : null;
        } catch (e) {
            log.error('Item Search Error', `Error searching for item ${itemCode}: ${e.message}`);
            return null;
        }
    };

    return {
        getInputData,
        map,
        reduce,
        summarize,
    };
});