/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['/SuiteScripts/customscript_so_default_billing.js', 'N/record', 'N/search'], function (record, search) {

    function beforeSubmit(context) {
        if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
            return;
        }

        var salesOrder = context.newRecord;

        var billingAddressId = salesOrder.getValue('billaddresslist');

        if (!billingAddressId) {
            var customerId = salesOrder.getValue('entity');

            if (!customerId) {
                return;
            }

            var customerRecord = record.load({
                type: record.Type.CUSTOMER,
                id: customerId,
                isDynamic: true
            });

            var addressCount = customerRecord.getLineCount({
                sublistId: 'addressbook'
            });

            if (addressCount > 0) {
                var defaultBillingAddressId = customerRecord.getSublistValue({
                    sublistId: 'addressbook',
                    fieldId: 'addressid',
                    line: 0
                });

                salesOrder.setValue({
                    fieldId: 'billaddresslist',
                    value: defaultBillingAddressId
                });
            }
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };

});
