/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */

define(['N/search', 'N/record', 'N/log'], function (search, record, log) {
    /**
     * Fetch Purchase Orders from the saved search.
     */
    function getInputData() {
        return search.load({
            id: 'customsearch_ng_po_data' // Saved search ID
        });
    }

    /**
     * Edit each Purchase Order, mark all line items and expenses as "Closed".
     */
    function map(context) {
        var result = JSON.parse(context.value);
        var purchaseOrderId = result.id; // Internal ID of the Purchase Order

        try {
            // Load the Purchase Order in dynamic mode
            var purchaseOrder = record.load({
                type: record.Type.PURCHASE_ORDER,
                id: purchaseOrderId,
                isDynamic: true
            });

            // Close all line items
            var itemLineCount = purchaseOrder.getLineCount({ sublistId: 'item' });
            for (var i = 0; i < itemLineCount; i++) {
                purchaseOrder.selectLine({ sublistId: 'item', line: i });
                purchaseOrder.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'isclosed',
                    value: true // Check the "Closed" box for items
                });
                purchaseOrder.commitLine({ sublistId: 'item' });
            }

            // Close all expense lines
            var expenseLineCount = purchaseOrder.getLineCount({ sublistId: 'expense' });
            for (var j = 0; j < expenseLineCount; j++) {
                purchaseOrder.selectLine({ sublistId: 'expense', line: j });
                purchaseOrder.setCurrentSublistValue({
                    sublistId: 'expense',
                    fieldId: 'isclosed',
                    value: true // Check the "Closed" box for expenses
                });
                purchaseOrder.commitLine({ sublistId: 'expense' });
            }

            // Save the updated Purchase Order
            var savedId = purchaseOrder.save({
                enableSourcing: true,
                ignoreMandatoryFields: false
            });

            log.audit('Purchase Order Closed Successfully', {
                purchaseOrderId: purchaseOrderId,
                savedId: savedId
            });
        } catch (error) {
            log.error('Error Closing Purchase Order', {
                purchaseOrderId: purchaseOrderId,
                message: error.message
            });
        }
    }

    /**
     * Summarize script execution results.
     */
    function summarize(summary) {
        summary.mapSummary.errors.iterator().each(function (key, error) {
            log.error('Map Error', {
                key: key,
                error: error
            });
            return true;
        });

        log.audit('Summary Complete', {
            totalUsage: summary.usage,
            totalConcurrency: summary.concurrency,
            totalYields: summary.yields
        });
    }

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };
});
