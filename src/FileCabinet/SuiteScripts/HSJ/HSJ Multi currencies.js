/**
 * Copyright (c) 2025 HSJ, Inc.
 * All Rights Reserved.
 *
 * Script Name: HSJ | Multi Currencies on customer
 * Version History:
 *
 * | Version | Date       | Author           | Remarks                                  |
 * |---------|------------|------------------|------------------------------------------|
 * | 1.00    | 2025-06-06 | Himanshu Kumar   | Apply Multi Currencies on customer       |
 */

/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/log'], function(record, log) {
    // Currency data as provided
    var currencies = [
        { internalId: 1, name: 'GBP', isoCode: 'GBP' },
        { internalId: 2, name: 'USD', isoCode: 'USD' },
        { internalId: 3, name: 'CAD', isoCode: 'CAD' },
        { internalId: 4, name: 'EUR', isoCode: 'EUR' },
        { internalId: 5, name: 'SEK', isoCode: 'SEK' }
    ];

    function afterSubmit(context) {
        if (context.type !== context.UserEventType.CREATE) {
            log.debug('Skipped', 'Script only runs on CREATE event');
            return;
        }

        try {
            // Get the newly created customer record ID
            var customerId = context.newRecord.id;
            log.debug('Customer Created', 'Customer ID: ' + customerId);

            // Load the customer record
            var customerRecord = record.load({
                type: record.Type.CUSTOMER,
                id: customerId,
                isDynamic: true
            });

            // Access the currency sublist
            var currencySublist = 'currency';
            var existingCurrencyIds = [];

            // Get existing currencies in the subtab
            var lineCount = customerRecord.getLineCount({ sublistId: currencySublist });
            log.debug('Currency Sublist Line Count', lineCount);

            for (var i = 0; i < lineCount; i++) {
                var currencyId = customerRecord.getSublistValue({
                    sublistId: currencySublist,
                    fieldId: 'currency',
                    line: i
                });
                // Ensure currencyId is valid before adding to array
                if (currencyId) {
                    existingCurrencyIds.push(parseInt(currencyId, 10)); // Convert to integer for consistency
                }
            }
            log.debug('Existing Currency IDs', JSON.stringify(existingCurrencyIds));

            // Add only currencies that are not already in the subtab
            currencies.forEach(function(currency) {
                // Use indexOf instead of includes for broader compatibility
                if (existingCurrencyIds.indexOf(parseInt(currency.internalId, 10)) === -1) {
                    customerRecord.selectNewLine({ sublistId: currencySublist });
                    customerRecord.setCurrentSublistValue({
                        sublistId: currencySublist,
                        fieldId: 'currency',
                        value: currency.internalId
                    });
                    customerRecord.commitLine({ sublistId: currencySublist });
                    log.debug('Currency Added', 'Added currency ID: ' + currency.internalId + ' (' + currency.isoCode + ')');
                } else {
                    log.debug('Currency Skipped', 'Currency ID: ' + currency.internalId + ' (' + currency.isoCode + ') already exists');
                }
            });

            // Save the customer record
            customerRecord.save({
                ignoreMandatoryFields: false
            });
            log.debug('Success', 'Missing currencies added to customer ID: ' + customerId);
        } catch (e) {
            log.error('Error in afterSubmit', e.toString());
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});