/**
 * Copyright (c) 2025 HSJ, Inc.
 * All Rights Reserved.
 *
 * Script Name: HSJ | Subsidiary Wise Print Credit Memo
 * Version History:
 *
 * | Version | Date       | Author           | Remarks                                  |
 * |---------|------------|------------------|------------------------------------------|
 * | 1.00    | 2025-05-19 | Himanshu Kumar   | Print PDF for Credit Memo based on subsidiary |
 */

/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
define(['N/record', 'N/render', 'N/http'], 
    function (record, render, http) {
    
        function onRequest(context) {
            var request = context.request;
            var response = context.response;
    
            var creditMemoId = request.parameters.custparam_creditmemoid; 

            if (!creditMemoId) {
                response.write('Missing credit memo ID');
                return;
            }
    
            var creditMemoRecord = record.load({
                type: record.Type.CREDIT_MEMO, 
                id: creditMemoId
            });
    
            var subsidiaryId = creditMemoRecord.getValue('subsidiary');
    
            // ✅ Subsidiary Internal IDs
            var HSJ_SUBSIDIARY_ID = '3';
            var IMA_SUBSIDIARY_ID = '7';
    
            // ✅ Advanced PDF Template IDs (Adjust as per your setup)
            var HSJ_TEMPLATE_ID = '110';
            var IMA_TEMPLATE_ID = '111';
    
            var selectedTemplateId = null;
    
            if (subsidiaryId == HSJ_SUBSIDIARY_ID) {
                selectedTemplateId = HSJ_TEMPLATE_ID;
            } else if (subsidiaryId == IMA_SUBSIDIARY_ID) {
                selectedTemplateId = IMA_TEMPLATE_ID;
            } else {
                response.write('Unsupported subsidiary: ' + subsidiaryId);
                return;
            }
    
            var renderer = render.create();
            renderer.setTemplateById(selectedTemplateId);
            renderer.addRecord('record', creditMemoRecord);
    
            var pdfFile = renderer.renderAsPdf();
            response.writeFile(pdfFile, true);
        }
    
        return {
            onRequest: onRequest
        };
    });
