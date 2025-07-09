/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/workflow', 'N/log'], (search, workflow, log) => {
    /**
     * Retrieves the input data for the Map/Reduce process.
     * In this case, it fetches data from the saved search.
     */
    const getInputData = () => {
        try {
            // Load the saved search
            return search.load({ id: 'customsearch_ng_po_status_update' });
        } catch (e) {
            log.error('Error Loading Saved Search', e.message);
            return null;
        }
    };

    /**
     * Processes each search result and sends it to the Map stage.
     * @param {Object} result - Search result
     */
    const map = (context) => {
        const result = JSON.parse(context.value);
        const poId = result.id; // Internal ID of the Purchase Order

        try {
            log.debug('Processing PO', `Internal ID: ${poId}`);
            context.write({ key: poId, value: poId });
        } catch (e) {
            log.error('Error in Map Stage', `PO ID: ${poId}, Error: ${e.message}`);
        }
    };

    /**
     * Approves the Purchase Order in the Reduce stage by triggering the workflow button.
     * @param {string} key - PO Internal ID
     * @param {Array} values - Values passed from the Map stage
     */
    const reduce = (context) => {
        const poId = context.key;

        try {
            // Trigger the workflow button for approval
            const workflowResult = workflow.trigger({
                recordType: 'purchaseorder',
                recordId: poId,
                workflowId: 'customworkflow_po_app_approve_button', // Correct workflow ID
                actionId: 'workflowaction29179', // The action ID of the button
            });

            log.audit('Workflow Triggered', `PO ID: ${poId}, Result: ${JSON.stringify(workflowResult)}`);
        } catch (e) {
            log.error('Error Triggering Workflow', `PO ID: ${poId}, Error: ${e.message}`);
        }
    };

    /**
     * Executes after all Reduce stage tasks are completed.
     * Provides a summary of the script execution.
     */
    const summarize = (summary) => {
        summary.mapSummary.errors.iterator().each((key, error, executionNo) => {
            log.error('Map Error', `Key: ${key}, Error: ${error}, Execution: ${executionNo}`);
            return true;
        });

        summary.reduceSummary.errors.iterator().each((key, error, executionNo) => {
            log.error('Reduce Error', `Key: ${key}, Error: ${error}, Execution: ${executionNo}`);
            return true;
        });

        log.audit('Script Execution Summary', {
            Usage: summary.usage,
            Concurrency: summary.concurrency,
            Yields: summary.yields,
        });
    };

    return {
        getInputData,
        map,
        reduce,
        summarize,
    };
});
