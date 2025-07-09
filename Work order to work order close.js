/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */

define(['N/search', 'N/record', 'N/log'], function(search, record, log) {
    function getInputData() {
        // Load the saved search containing Work Orders
        return search.load({
            id: 'customsearch_ng_wo_his_3month'
        });
    }

    function map(context) {
        var result = JSON.parse(context.value);
        var workOrderId = result.id; // Internal ID of the Work Order

        try {
            // Transform Work Order to Work Order Close
            var workOrderClose = record.transform({
                fromType: record.Type.WORK_ORDER,
                fromId: workOrderId,
                toType: record.Type.WORK_ORDER_CLOSE
            });

            // (Optional) Set any fields required during the close process
            // Example: workOrderClose.setValue({ fieldId: 'memo', value: 'Closed via script' });

            // Save the Work Order Close record
            var closeId = workOrderClose.save();

            log.audit('Work Order Closed Successfully', {
                workOrderId: workOrderId,
                closeId: closeId
            });
        } catch (error) {
            log.error('Error Closing Work Order', {
                workOrderId: workOrderId,
                message: error.message
            });
        }
    }

    function summarize(summary) {
        summary.mapSummary.errors.iterator().each(function(key, error) {
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
