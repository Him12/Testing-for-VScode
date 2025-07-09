/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log'], (search, record, log) => {
    const getInputData = () => {
        try {
            // Load the saved search
            return search.load({
                id: 'customsearch_ng_sales_order' // Replace with your saved search ID
            });
        } catch (error) {
            log.error('Error Loading Search', error);
        }
    };

    const map = (context) => {
        try {
            const searchResult = JSON.parse(context.value);
            const salesOrderId = searchResult.id; // Internal ID of the Sales Order

            // Load the sales order record
            const salesOrder = record.load({
                type: record.Type.SALES_ORDER,
                id: salesOrderId,
                isDynamic: true
            });

            // Iterate through the line items and close each one
            const lineCount = salesOrder.getLineCount({ sublistId: 'item' });
            for (let i = 0; i < lineCount; i++) {
                salesOrder.selectLine({ sublistId: 'item', line: i });
                salesOrder.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'isclosed',
                    value: true
                });
                salesOrder.commitLine({ sublistId: 'item' });
            }

            // Save the record
            salesOrder.save();

            log.audit('Sales Order Closed', `Sales Order ID: ${salesOrderId}`);
        } catch (error) {
            log.error('Error Processing Sales Order', error);
        }
    };

    const summarize = (summary) => {
        summary.mapSummary.errors.iterator().each((key, error) => {
            log.error(`Error for Sales Order ID: ${key}`, error);
            return true;
        });

        log.audit('Map/Reduce Summary', {
            usage: summary.usage,
            concurrency: summary.concurrency,
            yields: summary.yields
        });
    };

    return { getInputData, map, summarize };
});
