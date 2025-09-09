/**
 * Copyright (c) 2025 Rhino Rack, Inc.
 * All Rights Reserved.
 *
 * Script Name: NG Send Email Attachment from NETSTOCK
 * Description: This script sends email attachments (CSV or PDF) from the 'Netstock' folder to predefined recipients individually. It checks for file modifications and sends updated files only, tracking email sends in custom records with file names and types. Attachments are checked to avoid exceeding the 15 MB limit.
 *
 * Version History:
 * | Version | Date       | Author          | Remarks                                                          |
 * |---------|------------|-----------------|------------------------------------------------------------------|
 * | 1.0     | 2025-08-05 | Himanshu Kumar  | Sends email attachments (CSV or PDF) from the 'Netstock' folder to predefined recipients |
 * | 1.1     | 2025-09-01 | Himanshu Kumar  | Updated to send separate emails for each modified file with file name as subject |
 */

/**
 * @NApiVersion 2.0
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/email', 'N/file', 'N/record', 'N/search', 'N/runtime'], function(email, file, record, search, runtime) {

    function execute(context) {
        try {
            log.debug('Script Started', 'Loading saved search: customsearch_ng_folder_search');

            var fileSearch = search.load({ id: 'customsearch_ng_folder_search' });

            // Log saved search columns for debugging
            var columns = fileSearch.columns;
            log.debug('Saved Search Columns', 'Columns in customsearch_ng_folder_search: ' + JSON.stringify(columns.map(function(col) { return col.name; })));

            fileSearch.filters.push(search.createFilter({
                name: 'folder',
                operator: search.Operator.IS,
                values: ['40068']
            }));
            fileSearch.filters.push(search.createFilter({
                name: 'filetype',
                operator: search.Operator.ANYOF,
                values: ['CSV', 'PDF']
            }));

            var searchResults = fileSearch.run().getRange({ start: 0, end: 1000 });
            log.debug('Search Results', 'Found ' + searchResults.length + ' files in folder 40068');

            // Get author ID dynamically from email
            var authorEmail = 'no-reply@rhinorack.com';
            var authorId = getEmployeeIdByEmail(authorEmail);
            if (!authorId) {
                throw new Error('Could not find employee with email: ' + authorEmail);
            }

            // Collect modified files
            var modifiedFiles = [];
            var filesToUpdate = [];

            searchResults.forEach(function(result, index) {
                var fileId = result.id;
                var fileName = result.getValue({ name: 'name' });
                var fileType = result.getValue({ name: 'filetype' });
                var lastModified = result.getValue({ name: 'modified' });
                log.debug('Checking File', 'File ID: ' + fileId + ', Name: ' + fileName + ', Type: ' + fileType + ', Last Modified: ' + (lastModified || 'null'));

                if (isFileModified(fileId, lastModified)) {
                    var attachedFile = file.load({ id: fileId });
                    modifiedFiles.push(attachedFile);
                    filesToUpdate.push({ id: fileId, name: fileName, type: fileType, lastModified: lastModified });
                    log.debug('File Modified', 'File ID: ' + fileId + ', Name: ' + fileName + ', Type: ' + fileType + ' will be included in email');
                } else {
                    log.debug('File Unchanged', 'File ID: ' + fileId + ', Name: ' + fileName + ', Type: ' + fileType + ' has not been modified since last email');
                }
            });

            // Send separate email for each modified file
            if (modifiedFiles.length > 0) {
                var recipients = ['Kenny.garner@rhinorack.com.au', 'Sristi.saha-prasad@rhinorack.com.au'];
                
                modifiedFiles.forEach(function(modifiedFile) {
                    var maxSize = 15 * 1024 * 1024; // 15 MB in bytes
                    var fileSize = modifiedFile.size; // Size in bytes
                    log.debug('Checking File Size', 'File: ' + modifiedFile.name + ', Size: ' + fileSize + ' bytes');

                    if (fileSize > maxSize) {
                        log.error('File Too Large', 'File: ' + modifiedFile.name + ' exceeds 15 MB limit (' + fileSize + ' bytes), skipping email');
                        return;
                    }

                    var emailSubject = modifiedFile.name;
                    var emailBody = 'Hi,\n\nAttached is the updated file from the NETSTOCK folder.\n\nFile: ' + modifiedFile.name + ' (Type: ' + modifiedFile.fileType + ')\n';

                    log.audit('Email Details', JSON.stringify({
                        fromEmail: authorEmail,
                        recipients: recipients,
                        subject: emailSubject,
                        body: emailBody,
                        fileName: modifiedFile.name,
                        fileType: modifiedFile.fileType
                    }, null, 2));

                    email.send({
                        author: authorId,
                        recipients: recipients,
                        subject: emailSubject,
                        body: emailBody,
                        attachments: [modifiedFile]
                    });

                    log.debug('Individual Email Sent', 'Email sent successfully for file: ' + modifiedFile.name);
                });

                // Update custom records for modified files
                log.debug('Updating Custom Records', 'Updating custom records for modified files: ' + JSON.stringify(filesToUpdate.map(function(file) { return { id: file.id, name: file.name }; })));
                filesToUpdate.forEach(function(fileInfo) {
                    markFileAsEmailed(fileInfo.id, fileInfo.name, fileInfo.type);
                });
            } else {
                log.debug('No Email Sent', 'No modified files found to send');
            }
        } catch (e) {
            log.error('Error in execute', JSON.stringify({
                message: e.message,
                type: e.type,
                stack: e.stack
            }));
            throw e;
        }
    }

    function getEmployeeIdByEmail(emailAddress) {
        try {
            var employeeSearch = search.create({
                type: search.Type.EMPLOYEE,
                filters: [['email', search.Operator.IS, emailAddress]],
                columns: ['internalid']
            });

            var results = employeeSearch.run().getRange({ start: 0, end: 1 });

            if (results.length > 0) {
                var id = results[0].getValue({ name: 'internalid' });
                log.debug('Author Found', 'Email: ' + emailAddress + ', Internal ID: ' + id);
                return id;
            } else {
                log.error('Author Not Found', 'No employee found with email: ' + emailAddress);
                return null;
            }
        } catch (e) {
            log.error('Error in getEmployeeIdByEmail', e.message);
            return null;
        }
    }

    function isFileModified(fileId, lastModified) {
        try {
            if (!fileId || isNaN(fileId)) {
                log.error('Invalid File ID', 'File ID is invalid: ' + fileId);
                return false;
            }

            var customRecordSearch = search.create({
                type: 'customrecord_email_tracker',
                filters: [['custrecord_file_id', search.Operator.IS, fileId.toString()]],
                columns: ['custrecord_email_datetime']
            });

            var result = customRecordSearch.run().getRange({ start: 0, end: 1 });

            if (result.length === 0) {
                log.debug('No Email Record', 'No email sent yet for File ID: ' + fileId + ', treating as modified');
                return true; // No email sent yet, treat as modified
            }

            var rawEmailDate = result[0].getValue({ name: 'custrecord_email_datetime' });
            log.debug('Raw Email Date', 'File ID: ' + fileId + ', Raw Email Date: ' + (rawEmailDate || 'null'));

            // Parse email date (expected in DD/MM/YYYY format)
            var lastEmailDate;
            if (rawEmailDate && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawEmailDate)) {
                var parts = rawEmailDate.split('/');
                lastEmailDate = new Date(parts[2], parts[1] - 1, parts[0]); // YYYY, MM-1, DD
                log.debug('Parsed Email Date', 'File ID: ' + fileId + ', Parsed Parts: ' + JSON.stringify(parts) + ', Date: ' + lastEmailDate);
            } else {
                log.error('Invalid Email Date', 'Email date is invalid for File ID: ' + fileId + ', Raw Email Date: ' + (rawEmailDate || 'null') + ', treating as modified');
                return true; // Invalid email date, treat as modified
            }

            if (isNaN(lastEmailDate.getTime())) {
                log.error('Invalid Email Date Parsing', 'Failed to parse email date for File ID: ' + fileId + ', Raw Email Date: ' + (rawEmailDate || 'null') + ', treating as modified');
                return true;
            }

            // If lastModified is null or invalid, treat as modified
            if (!lastModified) {
                log.error('Invalid Last Modified', 'Last Modified is null for File ID: ' + fileId + ', treating as modified');
                return true;
            }

            // Parse lastModified (expected in DD/MM/YYYY HH:MM AM/PM format)
            var lastModifiedDate;
            if (lastModified) {
                // Handle formats like "30/7/2025 5:19 AM"
                var dateTimeParts = lastModified.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s/);
                if (dateTimeParts && dateTimeParts[1]) {
                    var dateParts = dateTimeParts[1].split('/');
                    lastModifiedDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]); // YYYY, MM-1, DD
                    log.debug('Parsed Last Modified', 'File ID: ' + fileId + ', Parsed Parts: ' + JSON.stringify(dateParts) + ', Date: ' + lastModifiedDate);
                } else {
                    log.error('Invalid Last Modified Format', 'Last Modified format is invalid for File ID: ' + fileId + ', Last Modified: ' + (lastModified || 'null') + ', treating as modified');
                    return true;
                }
            }

            if (isNaN(lastModifiedDate.getTime())) {
                log.error('Invalid Last Modified Date Parsing', 'Failed to parse last modified date for File ID: ' + fileId + ', Last Modified: ' + (lastModified || 'null') + ', treating as modified');
                return true;
            }

            // Compare only the dates (ignoring time)
            var lastEmailDateOnly = lastEmailDate.toISOString().split('T')[0]; // e.g., 2025-07-30
            var lastModifiedDateOnly = lastModifiedDate.toISOString().split('T')[0]; // e.g., 2025-07-30

            var isModified = lastModifiedDateOnly !== lastEmailDateOnly;
            log.debug('Modification Check', 'File ID: ' + fileId + ', Old Date: ' + lastEmailDateOnly + ', New Date: ' + lastModifiedDateOnly + ', Compare Result: ' + isModified);
            
            return isModified;
        } catch (e) {
            log.error('Error in isFileModified', JSON.stringify({
                message: e.message,
                stack: e.stack,
                fileId: fileId,
                lastModified: lastModified || 'null',
                rawEmailDate: rawEmailDate || 'null'
            }));
            return true; // Treat as modified on error to ensure email is sent
        }
    }

    function markFileAsEmailed(fileId, fileName, fileType) {
        try {
            var customRecordSearch = search.create({
                type: 'customrecord_email_tracker',
                filters: [['custrecord_file_id', search.Operator.IS, fileId.toString()]],
                columns: ['internalid']
            });

            var results = customRecordSearch.run().getRange({ start: 0, end: 1 });
            var customRecord;

            if (results.length > 0) {
                customRecord = record.load({
                    type: 'customrecord_email_tracker',
                    id: results[0].getValue({ name: 'internalid' })
                });
            } else {
                customRecord = record.create({
                    type: 'customrecord_email_tracker'
                });
                customRecord.setValue({
                    fieldId: 'custrecord_file_id',
                    value: fileId.toString()
                });
            }

            // Store only the date (set time to midnight in IST)
            var currentDate = new Date();
            log.debug('Raw Current Date', 'File ID: ' + fileId + ', Current Date: ' + currentDate);
            // Adjust for IST (UTC+5:30)
            var istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
            var istDate = new Date(currentDate.getTime() + istOffset);
            var dateOnly = new Date(istDate.getFullYear(), istDate.getMonth(), istDate.getDate()); // Midnight in IST

            log.debug('Setting Email Date', 'File ID: ' + fileId + ', Raw Date: ' + dateOnly + ', ISO Date: ' + dateOnly.toISOString().split('T')[0]);

            customRecord.setValue({
                fieldId: 'custrecord_email_datetime',
                value: dateOnly
            });

            if (fileName) {
                customRecord.setValue({
                    fieldId: 'custrecord_file_name',
                    value: fileName
                });
            }

            if (fileType) {
                customRecord.setValue({
                    fieldId: 'custrecord_file_type_data',
                    value: fileType
                });
            }

            var recordId = customRecord.save();
            log.debug('Custom Record Updated/Created', 'File ID: ' + fileId + ', File Name: ' + fileName + ', File Type: ' + fileType + ', Custom Record ID: ' + recordId + ', Email Date: ' + dateOnly.toISOString().split('T')[0]);
        } catch (e) {
            log.error('Error in markFileAsEmailed', JSON.stringify({
                message: e.message,
                stack: e.stack,
                fileId: fileId,
                fileName: fileName,
                fileType: fileType
            }));
            throw e;
        }
    }

    return {
        execute: execute
    };
});