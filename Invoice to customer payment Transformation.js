/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/search', 'N/log'], function(record, search, log) {

    function getInputData() {
        // Load the saved search to fetch Invoice records
        var invoiceSearch = search.load({
            id: 'customsearch_ng_inv_cust_transform' // The internal ID of the saved search
        });

        var invoiceIds = [];  // Array to store the Invoice IDs

        // Run the saved search and add the Invoice IDs to the array
        invoiceSearch.run().each(function(result) {
            var invoiceId = result.id; // Get the internal ID of the Invoice
            invoiceIds.push({ id: invoiceId });
            return true;  // Continue processing
        });

        return invoiceIds;  // Return the array of Invoice IDs
    }

    function map(context) {
        var invoiceId = JSON.parse(context.value).id;

        try {
            log.debug('Attempting Transformation', 'Invoice ID: ' + invoiceId);

            // Load the Invoice
            var invoice = record.load({
                type: record.Type.INVOICE,
                id: invoiceId
            });

            // Log Invoice fields to check for missing data
            log.debug('Invoice Details', {
                customer: invoice.getValue('entity'), // Customer ID
                status: invoice.getValue('status'),   // Status
                amount: invoice.getValue('total')     // Total Amount
            });

            var status = invoice.getValue({ fieldId: 'status' });

            // Check if the Invoice status is "Open"
            if (status !== 'Open') {
                log.error('Invalid Status', 'Invoice ID: ' + invoiceId + ' has an invalid status: ' + status + '. Only "Open" invoices can be transformed.');
                return;
            }

            // Transform the Invoice into a Customer Payment
            var payment = record.transform({
                fromType: record.Type.INVOICE,
                fromId: invoiceId,
                toType: record.Type.CUSTOMER_PAYMENT
            });

            // Optional: You can update payment amount if necessary
            // payment.setValue({
            //     fieldId: 'payment',
            //     value: invoice.getValue('total') // Set the payment amount equal to invoice total
            // });

            // Save the Customer Payment
            var paymentId = payment.save();
            log.debug('Payment Created', 'Invoice ID: ' + invoiceId + ' -> Payment ID: ' + paymentId);

            // Output for summarize stage
            context.write(invoiceId, paymentId);

        } catch (e) {
            log.error('Error Transforming Invoice to Payment', 'Invoice ID: ' + invoiceId + ', Error: ' + e.message);
        }
    }

    function summarize(summary) {
        summary.mapSummary.errors.iterator().each(function(key, error) {
            log.error('Map Error', 'Invoice ID: ' + key + ', Error: ' + error);
            return true;
        });

        summary.output.iterator().each(function(key, value) {
            log.debug('Transformation Result', 'Invoice ID: ' + key + ' -> Payment ID: ' + value);
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
