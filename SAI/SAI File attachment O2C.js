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
* Script Name: SAI | MR O2C file attachment.js
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
define(['N/search', 'N/record', 'N/log'], function(search, record, log) {

    /**
     * Retrieves the input data for the Map/Reduce process.
     * This search retrieves custom records with relevant external IDs.
     *
     * @return {Array} - The results of the search to be processed
     */
    function getInputData() {
        var customrecord_record_attachmentSearchObj = search.create({
            type: "customrecord_sai_o2c_attachment",
            filters:
            [
               ["custrecord_sai_external_id","isnotempty",""]
               //"AND",
               //["internalidnumber","equalto","6"]
            ],
            columns:
            [
               search.createColumn({name: "custrecord_sai_external_id", label: "External Id"}),
               search.createColumn({name: "custrecord_sai_file_attachment", label: "Attachment"}),
               search.createColumn({name: "custrecord_sai_internal_id", label: "Internal Id"}),
               search.createColumn({name: "custrecord_sai_transaction_type", label: "Transaction Type"})
            ]
         });

        return customrecord_record_attachmentSearchObj;
    }

    /**
     * Processes each result from the search in parallel.
     * For each result, we extract the relevant data and pass it to the reduce phase.
     *
     * @param {Object} context - The context provided by the Map/Reduce framework
     * @param {Object} context.value - JSON string of a search result
     */
    function map(context) {
        try{
            let result = JSON.parse(context.value);
            log.debug("Map result", result);
    
            let internalID = result.id;
            let externalId = result.values['custrecord_sai_external_id'];
            let attachmentFileId = result.values['custrecord_sai_file_attachment'].value;
            let tranType = result.values['custrecord_sai_transaction_type'];
    
            // Pass the relevant data to the reduce phase
            context.write({
                key: externalId,
                value: {
                    externalId: externalId,
                    attachmentFileId: attachmentFileId,
                    internalId: internalID,
                    recordtype: tranType
                }
            });
        }
        catch(e){
            log.error("Map Error",e.message)
        }
    }

    /**
     * Aggregates and processes the results from the map phase.
     * The reduce phase will search for matching purchase orders and attach the file if found.
     *
     * @param {Object} context - The context provided by the Map/Reduce framework
     * @param {Array} context.values - List of values passed from the map phase
     */
    function reduce(context) {
        try{
            log.debug("Starting Reduce", "Processing External ID: " + context.key);

            // Loop through each value passed from map and process the data
            context.values.forEach(function(value) {
                value = JSON.parse(value);
                log.debug("value", value);

                let externalId = value.externalId;
                let attachmentFileId = value.attachmentFileId;
                let internalId = value.internalId;
                let recordType = value.recordtype;

                // Search for the purchase order with the matching external ID
                let purchaseOrderSearchObj = search.create({
                    type:recordType,
                    filters: [
                        ["externalid", "is", externalId]
                    ],
                    columns: [
                        search.createColumn({ name: "internalid", label: "Internal ID" })
                    ]
                });

                let searchResult = purchaseOrderSearchObj.run().getRange({
                    start: 0,
                    end: 1
                });

                // If a matching purchase order is found
                if (searchResult.length > 0) {
                    let purchaseOrderId = searchResult[0].getValue({ name: "internalid" });

                    // Attach the file to the purchase order
                    try {
                        record.attach({
                            record: {
                                type: 'file',
                                id: attachmentFileId
                            },
                            to: {
                                type: recordType,
                                id: purchaseOrderId
                            }
                        });

                        // Update fields on the custom record
                        record.submitFields({
                            type: 'customrecord_sai_o2c_attachment',
                            id: internalId,
                            values: {
                                custrecord_sai_file_attached: true,
                                custrecord_sai_related_transaction: purchaseOrderId
                            },
                            options: {
                                enableSourcing: true,
                                ignoreMandatoryFields: false
                            }
                        });

                        log.debug( `File Attached", "Attachment successfully added to ${recordType}}: ` + purchaseOrderId);
                    } catch (e) {
                        log.error(`Error Attaching File", "Failed to attach file to ${recordType}: ` + purchaseOrderId + " - " + e.message);
                    }
                } else {
                    log.debug(`No ${recordType} Found`, `No matching ${recordType} found for External ID: ` + externalId);
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
