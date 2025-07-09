/**
 * Copyright (c) 2025 HSJ, Inc.
 * All Rights Reserved.
 *
 * Script Name: HSJ | Print Button on Credit Memo
 * Version History:
 *
 * | Version | Date       | Author           | Remarks                                  |
 * |---------|------------|------------------|------------------------------------------|
 * | 1.00    | 2025-05-19 | Himanshu Kumar   | Print PDF button on Credit Memo          |
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
            var creditMemoId = context.newRecord.id;

            var suiteletUrl = url.resolveScript({
                scriptId: 'customscript_ng_cm_sub_pdf', // Use your Suitelet script ID
                deploymentId: 'customdeploy_ng_cm_sub_pdf', // Use your Suitelet deployment ID
                params: {
                    custparam_creditmemoid: creditMemoId 
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
