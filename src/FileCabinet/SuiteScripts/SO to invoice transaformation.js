/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/search', 'N/log'], function(record, search, log) {

    function getInputData() {
        // Run the saved search to fetch Sales Order records
        var salesOrderSearch = search.load({
            id: 'customsearch_ng_so_to_inv' // The internal ID of the saved search
        });

        var salesOrderIds = [];  // Array to store the Sales Order IDs

        // Run the saved search and add the Sales Order IDs to the array
        salesOrderSearch.run().each(function(result) {
            var salesOrderId = result.id; // Get the internal ID of the Sales Order
            salesOrderIds.push({ id: salesOrderId });
            return true;  // Continue processing
        });

        return salesOrderIds;  // Return the array of Sales Order IDs
    }

    function map(context) {
        var salesOrderId = JSON.parse(context.value).id;

        try {
            log.debug('Attempting Transformation', 'Sales Order ID: ' + salesOrderId);

            // Load the Sales Order
            var salesOrder = record.load({
                type: record.Type.SALES_ORDER,
                id: salesOrderId
            });

            // Log Sales Order fields to check for missing data
            log.debug('Sales Order Details', {
                customer: salesOrder.getValue('entity'), // Customer ID
                status: salesOrder.getValue('status'),   // Status
                subsidiary: salesOrder.getValue('subsidiary') // Subsidiary ID
            });

            var status = salesOrder.getValue({ fieldId: 'status' });
            var allowedStatuses = ['Pending Billing', 'Pending Fulfillment', 'Partially Billed', 'Partially Fulfilled','Pending Billing/Partially Fulfilled'];

            // Ensure the Sales Order has a valid status
            if (allowedStatuses.indexOf(status) === -1) {
                log.error('Invalid Status', 'Sales Order ID: ' + salesOrderId + ' has an invalid status: ' + status);
                return;
            }

            // Filter out incomplete line items
            var lineCount = salesOrder.getLineCount({ sublistId: 'item' });
            var validLines = [];  // Ensure validLines is initialized as an array
            for (var i = 0; i < lineCount; i++) {
                validLines.push(i); // Add valid line index
            }

            // Ensure at least one valid line item exists
            if (validLines.length === 0) {
                log.error('No Valid Line Items', 'Sales Order ID: ' + salesOrderId + ' has no valid line items to invoice.');
                return;
            }

            // Transform the Sales Order into an Invoice
            var invoice = record.transform({
                fromType: record.Type.SALES_ORDER,
                fromId: salesOrderId,
                toType: record.Type.INVOICE
            });

            // Add valid line items to the invoice
            var invoiceLineCount = invoice.getLineCount({ sublistId: 'item' });
            for (var j = invoiceLineCount - 1; j >= 0; j--) {
                if (validLines.indexOf(j) === -1) { // Using indexOf() to check if the line is valid
                    invoice.removeLine({
                        sublistId: 'item',
                        line: j
                    });
                }
            }

            // Save the Invoice
            var invoiceId = invoice.save();
            log.debug('Invoice Created', 'Sales Order ID: ' + salesOrderId + ' -> Invoice ID: ' + invoiceId);

            // Output for summarize stage
            context.write(salesOrderId, invoiceId);

        } catch (e) {
            log.error('Error Transforming SO to Invoice', 'Sales Order ID: ' + salesOrderId + ', Error: ' + e.message);
        }
    }

    function summarize(summary) {
        summary.mapSummary.errors.iterator().each(function(key, error) {
            log.error('Map Error', 'Sales Order ID: ' + key + ', Error: ' + error);
            return true;
        });

        summary.output.iterator().each(function(key, value) {
            log.debug('Transformation Result', 'Sales Order ID: ' + key + ' -> Invoice ID: ' + value);
            return true;
        });

        log.audit('Summary', 'MapReduce script completed. Review logs for details.');
    }

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };
});
