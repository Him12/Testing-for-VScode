/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/ui/serverWidget'], function (serverWidget) {
    function beforeLoad(context) {
        try {
            // Ensure the script runs only on View or Edit mode
            if (context.type === context.UserEventType.VIEW || context.type === context.UserEventType.EDIT) {
                var form = context.form;

                // Get the sublist where the Attach button appears
                var sublist = form.getSublist({
                    id: 'customrecord_vyn_customer_contract' // sublist ID for Customer Contract
                });

                if (sublist) {
                    // Remove the Attach button by hiding the sublist field
                    sublist.getField({
                        id: 'attach' // Replace with the actual field ID of the Attach button
                    }).updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });
                }
            }
        } catch (error) {
            log.error('Error removing Attach button', error);
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});
