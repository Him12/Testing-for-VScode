/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

    function getInputData() {
        return search.load({ id: 'customsearch_ng_remove_company_im_2' });
    }

    function map(context) {
        try {
            let result = JSON.parse(context.value);
            let contactId = result.id;

            log.debug('Processing Contact ID', contactId);

            let contactRecord = record.load({
                type: record.Type.CONTACT,
                id: contactId,
                isDynamic: true
            });

            // 🔹 Switch to the 'Companies' subtab first (if needed)
            contactRecord.setValue({ fieldId: 'companydir0', value: true });

            let sublistId = 'company'; // Make sure this is correct
            let lineCount = contactRecord.getLineCount({ sublistId });

            log.debug('Total Companies Found', lineCount);

            for (let i = lineCount - 1; i >= 0; i--) {
                contactRecord.selectLine({ sublistId, line: i });

                let companyName = contactRecord.getCurrentSublistValue({
                    sublistId,
                    fieldId: 'companyname'
                });

                log.debug('Checking Company', `Company: ${companyName}`);

                if (companyName && !companyName.includes(" IM")) {
                    log.debug('Removing Company', `Company: ${companyName} from Contact ID: ${contactId}`);

                    contactRecord.removeLine({ sublistId, line: i, commit: true });
                }
            }

            contactRecord.save();
            log.audit('Updated Contact', `Contact ID: ${contactId} processed successfully.`);
        } catch (error) {
            log.error('Error processing Contact', error);
        }
    }

    function summarize(summary) {
        summary.mapSummary.errors.iterator().each(function (key, error) {
            log.error('Map Error', `Key: ${key}, Error: ${error}`);
            return true;
        });

        log.audit('Script Execution Completed', {
            processed: summary.inputSummary.recordCount,
            errors: summary.mapSummary.errors
        });
    }

    return {
        getInputData,
        map,
        summarize
    };
});
