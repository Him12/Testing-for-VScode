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
 * Script Name: HSJ | Print Button on Invoice
* Version History:
 *
 * | Version | Date       | Author           | Remarks                                  |
 * |---------|------------|------------------|------------------------------------------|
 * | 1.00    | 2025-04-30 | Himanshu Kumar   | Initial version                          |
*/

/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/ui/serverWidget', 'N/runtime', 'N/url'], 
    function (ui, runtime, url) {
    
        function beforeLoad(context) {
            if (context.type !== context.UserEventType.VIEW) return;
    
            var form = context.form;
            var invoiceId = context.newRecord.id;
            
            // Attempt to remove "Preview PDF" button
            // try {
            //     form.removeButton('custpage_button_preview_pdf');
            // } catch (e) {
            //     log.debug('Button Remove Failed', e.message);
            // }
    
            var suiteletUrl = url.resolveScript({
                scriptId: 'customscript_ng_subsidiary_wise_inv_pdf', // <-- your Suitelet script ID
                deploymentId: 'customdeploy_ng_subs_print_pdf', // <-- your Suitelet deployment ID
                params: {
                    custparam_invoiceid: invoiceId
                }
            });
    
            form.addButton({
                id: 'custpage_print_by_subsidiary',
                label: 'Print PDF',
                functionName: "window.open('" + suiteletUrl + "', '_blank');"
            });
        }
    
        return {
            beforeLoad: beforeLoad
        };
    });
