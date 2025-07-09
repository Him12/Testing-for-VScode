/**
 * Copyright (c) 2025 HSJ, Inc.
 * All Rights Reserved.
 *
 * The following Javascript source code is intended for use on the Netsuite
 * platform.
 * This software is the confidential and proprietary information of
 * HSJ, Inc. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with HSJ.
 *
 * Script Name: HSJ | PDF Base64
* Version History:
 *
 * | Version | Date       | Author           | Remarks                                  |
 * |---------|------------|------------------|------------------------------------------|
 * | 1.00    | 2025-05-28 | Himanshu Kumar   | Initial version                          |
*/

/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define(['N/render', 'N/record', 'N/encode', 'N/error', 'N/log'], (render, record, encode, error, log) => {
    const post = (context) => {
        try {
            // Log the incoming request for debugging
            log.debug({
                title: 'RESTlet Request',
                details: JSON.stringify(context)
            });

            // Validate input parameters
            const { recordId, recordType } = context;

            if (!recordId || !recordType) {
                throw error.create({
                    name: 'MISSING_REQUIRED_PARAMETER',
                    message: 'Record ID and Record Type are required.'
                });
            }

            // Validate record type
            if (recordType !== 'invoice' && recordType !== 'creditmemo') {
                throw error.create({
                    name: 'INVALID_RECORD_TYPE',
                    message: 'Record Type must be either "invoice" or "creditmemo".'
                });
            }

            // Load the record to get subsidiary and ensure it exists
            let loadedRecord;
            try {
                loadedRecord = record.load({
                    type: recordType === 'invoice' ? record.Type.INVOICE : record.Type.CREDIT_MEMO,
                    id: recordId,
                    isDynamic: false
                });
            } catch (e) {
                throw error.create({
                    name: 'INVALID_RECORD',
                    message: `Record with ID ${recordId} and type ${recordType} does not exist.`
                });
            }

            const subsidiaryId = loadedRecord.getValue('subsidiary');
            log.debug({
                title: 'Record Loaded',
                details: `Record ID: ${recordId}, Type: ${recordType}, Subsidiary ID: ${subsidiaryId}`
            });

            // Subsidiary Internal IDs
            const HSJ_SUBSIDIARY_ID = '3';
            const IMA_SUBSIDIARY_ID = '7';

            // Advanced PDF Template Internal IDs
            const INVOICE_HSJ_TEMPLATE_ID = '108'; // Invoice template for HSJ
            const INVOICE_IMA_TEMPLATE_ID = '109'; // Invoice template for IMA
            const CREDITMEMO_HSJ_TEMPLATE_ID = '111'; // Credit Memo template for HSJ
            const CREDITMEMO_IMA_TEMPLATE_ID = '112'; // Credit Memo template for IMA

            // Select template based on record type and subsidiary
            let selectedTemplateId = null;
            if (recordType === 'invoice') {
                if (subsidiaryId === HSJ_SUBSIDIARY_ID) {
                    selectedTemplateId = INVOICE_HSJ_TEMPLATE_ID;
                } else if (subsidiaryId === IMA_SUBSIDIARY_ID) {
                    selectedTemplateId = INVOICE_IMA_TEMPLATE_ID;
                } else {
                    throw error.create({
                        name: 'UNSUPPORTED_SUBSIDIARY',
                        message: `Unsupported subsidiary ID: ${subsidiaryId} for invoice.`
                    });
                }
            } else if (recordType === 'creditmemo') {
                if (subsidiaryId === HSJ_SUBSIDIARY_ID) {
                    selectedTemplateId = CREDITMEMO_HSJ_TEMPLATE_ID;
                } else if (subsidiaryId === IMA_SUBSIDIARY_ID) {
                    selectedTemplateId = CREDITMEMO_IMA_TEMPLATE_ID;
                } else {
                    throw error.create({
                        name: 'UNSUPPORTED_SUBSIDIARY',
                        message: `Unsupported subsidiary ID: ${subsidiaryId} for credit memo.`
                    });
                }
            }

            log.debug({
                title: 'Template Selection',
                details: `Selected Template ID: ${selectedTemplateId} for Record Type: ${recordType}, Subsidiary: ${subsidiaryId}`
            });

            
            let pdfFile = render.transaction({
                entityId: parseInt(recordId),
                printMode: render.PrintMode.PDF
            });

        

            let base64Content = pdfFile.getContents();

            log.debug({
                title: 'PDF Generated',
                details: `Base64 Length: ${base64Content.length}`
            });

            // Return response
            return {
                status: 'success',
                recordType,
                recordId,
                subsidiaryId,
                templateId: selectedTemplateId,
                data64: base64Content
            };
        } catch (e) {
            // Log the error for debugging
            log.error({
                title: 'RESTlet Error',
                details: JSON.stringify(e)
            });

            // Throw error with details
            throw error.create({
                name: e.name || 'ERROR_GENERATING_PDF',
                message: e.message || `Failed to generate PDF for record ID ${context.recordId}`
            });
        }
    };

    return { post };
});