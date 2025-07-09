/**
 * Copyright (c) 2024 HSJ, Inc.
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
 * Script Name: HSJ | Subsidiary Wise Print PDF
* Version History:
 *
 * | Version | Date       | Author           | Remarks                                  |
 * |---------|------------|------------------|------------------------------------------|
 * | 1.00    | 2025-04-30 | Himanshu Kumar   | Initial version                          |
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
    
            var invoiceId = request.parameters.custparam_invoiceid;
    
            if (!invoiceId) {
                response.write('Missing invoice ID');
                return;
            }
    
            var invoiceRecord = record.load({
                type: record.Type.INVOICE,
                id: invoiceId
            });
    
            var subsidiaryId = invoiceRecord.getValue('subsidiary');
    
            // ✅ Subsidiary Internal IDs
            var HSJ_SUBSIDIARY_ID = '3';
            var IMA_SUBSIDIARY_ID = '7';
    
            // ✅ Advanced PDF Template IDs
            var HSJ_TEMPLATE_ID = '106';
            var IMA_TEMPLATE_ID = '107';
    
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
            renderer.addRecord('record', invoiceRecord);
    
            var pdfFile = renderer.renderAsPdf();
            response.writeFile(pdfFile, true);
        }
    
        return {
            onRequest: onRequest
        };
    });
    