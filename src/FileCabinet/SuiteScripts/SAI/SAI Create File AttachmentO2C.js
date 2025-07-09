/**
* Copyright (c) 2025 Symphoni, Inc.
* All Rights Reserved.
*
* The following Javascript source code is intended for use on the Netsuite
* platform.
* This software is the confidential and proprietary information of
* Symphoni, Inc. ("Confidential Information"). You shall not
* disclose such Confidential Information and shall use it only in
* accordance with the terms of the license agreement you entered into
* with Symphoni.
*
* Script Name: SAI | MR Create File Attachment.js
* Description: This Map/Reduce script processes purchase orders and creates 
* custom records for file attachments related to these orders. It retrieves 
* the necessary data using a search, processes each purchase order in the map 
* phase, and creates corresponding custom records in the reduce phase. 
* The script also handles logging and error reporting during the process.
*
* Version History:
*
* | Version | Date       | Author               | Remarks                                  |
* |---------|------------|----------------------|------------------------------------------|
* | 1.00    | 2025-05-06 | Himanshu Kumar       | Initial version for file attachment creation |
*/
 
/**
  * @NApiVersion 2.1
  * @NScriptType MapReduceScript
  */
define(['N/search', 'N/record', 'N/log', 'N/runtime'], function(search, record, log, runtime) {
 
    /**
     * Retrieves the input data for the Map/Reduce process.
     * This search retrieves purchase orders filtered by specific conditions.
     *
     * @return {Array} - The results of the search to be processed
     */
    function getInputData() {
        const script = runtime.getCurrentScript();
        const searchId = script.getParameter({ name: 'custscript_ng_saved_search' });
        // Return the search result as input data for processing
        return  search.load({
                    id: searchId
                });;
    }
    /**
     * Processes each result from the search in parallel.
     * For each result, we pass the relevant data to the reduce phase.
     *
     * @param {Object} context - The context provided by the Map/Reduce framework
     * @param {Object} context.value - JSON string of a search result
     */
    function map(context) {
        let result = JSON.parse(context.value);
        log.debug("Result", result);
        let documentNumber = result.values['tranid'];
        let internalId = result.values['internalid'].value;
        let externalId = result.values['formulatext'];
        let attachmentFileId = result.values['internalid.file'].value;
        let recordType = result.values['recordtype'];
        // Pass the relevant data to the reduce phase
        let recordData = {
            documentNumber: documentNumber,
            internalId: internalId,
            externalId: externalId,
            attachmentFileId: attachmentFileId,
            recordType: recordType 
        };
        log.debug("recordData", recordData);
        // Pass the data to the reduce phase
        context.write({
            key: internalId, 
            value: recordData 
        });
    }
    /**
     * Aggregates and processes the results from the map phase.
     * The reduce phase will create the records in this stage.
     *
     * @param {Object} context - The context provided by the Map/Reduce framework
     * @param {Array} context.values - List of values passed from the map phase
     */
    function reduce(context) {
        try{
            log.debug("Starting Reduce", "Processing Internal ID: " + context.key);
            // Loop through each value passed from map and log it
            context.values.forEach(function(value) {
 
                value = JSON.parse(value);
                //log.debug("value: ", value);
                // Create the custom record in the reduce stage
                let customRecord = record.create({
                    type: 'customrecord_sai_o2c_attachment' //id of custom record 
                });
                // Set the fields on the custom record
                customRecord.setValue({
                    fieldId: 'custrecord_sai_document_no',
                    value: value.documentNumber
                });
                customRecord.setValue({
                    fieldId: 'custrecord_sai_transaction_type',
                    value: value.recordType
                });
                customRecord.setValue({
                    fieldId: 'custrecord_sai_internal_id',
                    value: value.internalId
                });
                customRecord.setValue({
                    fieldId: 'custrecord_sai_external_id',
                    value: value.externalId
                });
                customRecord.setValue({
                    fieldId: 'custrecord_sai_file_attachment',
                    value: parseInt(value.attachmentFileId)
                });
                // Save the custom record and log the result
                let recordId = customRecord.save();
                if (!recordId) {
                    log.error('Record Save Failed', 'Could not save the custom record.');
                } else {
                    log.debug('Saved custom record in reduce', 'Record ID: ' + recordId);
                }
            });
        }
        catch(e){
            log.error("Error",e.message)
        }
    }

    /**
     * Summarizes the results of the Map/Reduce script.
     * This function can handle errors and log the final status of the process.
     *
     * @param {Object} summary - The summary of the Map/Reduce process
     * @param {Object} summary.inputSummary - Information about the input data
     * @param {Object} summary.mapSummary - Information about the map phase
     * @param {Object} summary.reduceSummary - Information about the reduce phase
     */
    function summarize(summary) {
       log.audit('Summary', summary);
       // Handle any errors during execution
       if (summary.error) {
          log.error('Error', summary.error);
       }
       // Optionally log additional statistics from map and reduce phases
       log.audit('Map phase summary', summary.mapSummary);
       log.audit('Reduce phase summary', summary.reduceSummary);
    }
    return {
       getInputData: getInputData,
       map: map,
       reduce: reduce,
       summarize: summarize
    };
});