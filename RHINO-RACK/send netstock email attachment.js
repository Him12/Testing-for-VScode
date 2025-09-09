/**
 * Copyright (c) 2025 Rhino Rack, Inc.
 * All Rights Reserved.
 *
 * Script Name: NG Send Email Attachment from NETSTOCK
 * Description: This script sends email attachments (CSV or PDF) from the 'Netstock' folder 
 *              to predefined recipients. It ensures each file is only emailed once.
 *
 * Version History:
 * | Version | Date       | Author          | Remarks                                                          |
 * |---------|------------|-----------------|------------------------------------------------------------------|
 * | 1.15    | 2025-07-25 | Himanshu Kumar  | Displayed Opportunity value next to SFA Forecast in Edit mode   |
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

            fileSearch.filters.push(search.createFilter({
                name: 'folder',
                operator: search.Operator.IS,
                values: ['11967009']
            }));
            fileSearch.filters.push(search.createFilter({
                name: 'filetype',
                operator: search.Operator.ANYOF,
                values: ['CSV', 'PDF']
            }));

            var searchResults = fileSearch.run().getRange({ start: 0, end: 1000 });
            log.debug('Search Results', 'Found ' + searchResults.length + ' files in folder 11967009');

            // Get author ID dynamically from email
            var authorEmail = 'Bhavesh.naidu@Nagarro.com';
            var authorId = getEmployeeIdByEmail(authorEmail);
            if (!authorId) {
                throw new Error('Could not find employee with email: ' + authorEmail);
            }

            searchResults.forEach(function(result, index) {
                var fileId = result.id;
                log.debug('Processing File', 'File ID: ' + fileId + ', Index: ' + index);

                if (!checkEmailSent(fileId)) {
                    var attachedFile = file.load({ id: fileId });

                    var recipients = ['Kenny.garner@rhinorack.com.au', 'Sristi.saha-prasad@rhinorack.com.au'];
                    var emailSubject = 'New ' + attachedFile.fileType + ' Attachment Notification';
                    var emailBody = 'Hi,\n\nBelow is the attached ' + attachedFile.fileType + ' file from NETSTOCK folder.';

                    log.audit('Email Details', JSON.stringify({
                        fromEmail: authorEmail,
                        recipients: recipients,
                        subject: emailSubject,
                        body: emailBody
                    }, null, 2));

                    email.send({
                        author: authorId,
                        recipients: recipients,
                        subject: emailSubject,
                        body: emailBody,
                        attachments: [attachedFile]
                    });

                    markFileAsEmailed(fileId);

                    log.debug('Email Sent', 'Email sent successfully for file ID: ' + fileId);
                } else {
                    log.debug('Email Skipped', 'Email already sent for file ID: ' + fileId);
                }
            });
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

    function checkEmailSent(fileId) {
        try {
            if (!fileId || isNaN(fileId)) {
                log.error('Invalid File ID', 'File ID is invalid: ' + fileId);
                return false;
            }

            var customRecordSearch = search.create({
                type: 'customrecord_email_tracker',
                filters: [['custrecord_file_id', search.Operator.IS, fileId.toString()]],
                columns: ['internalid']
            });

            var result = customRecordSearch.run().getRange({ start: 0, end: 1 });

            return result.length > 0;
        } catch (e) {
            log.error('Error in checkEmailSent', JSON.stringify({
                message: e.message,
                stack: e.stack,
                fileId: fileId
            }));
            return false;
        }
    }

    function markFileAsEmailed(fileId) {
        try {
            var customRecord = record.create({
                type: 'customrecord_email_tracker'
            });

            customRecord.setValue({
                fieldId: 'custrecord_file_id',
                value: fileId.toString()
            });

            customRecord.setValue({
                fieldId: 'custrecord_email_date',
                value: new Date()
            });

            var recordId = customRecord.save();
            log.debug('Custom Record Created', 'File ID: ' + fileId + ', Custom Record ID: ' + recordId);
        } catch (e) {
            log.error('Error in markFileAsEmailed', JSON.stringify({
                message: e.message,
                stack: e.stack,
                fileId: fileId
            }));
            throw e;
        }
    }

    return {
        execute: execute
    };
});
