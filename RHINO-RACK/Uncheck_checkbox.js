/**
 * Script Name: On Update Uncheck checkbox
 * Description: This User Event script uncheck the checkbox when there is any change on record except on create.
 *
 * Version History:
 * | Version | Date       | Author           | Remarks                                  |
 * |---------|------------|------------------|------------------------------------------|
 * | 1.00    | 2025-06-09 | Himanshu Kumar   | if any update in the Customer, item and Order record it will uncheck the checkbox |
 */

/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record'], function (record) {
    function beforeSubmit(context) {
        if (context.type === context.UserEventType.CREATE) return;//except create it will work

        var newRecord = context.newRecord;
        var recordType = newRecord.type;

        try {
            switch (recordType) {
                case record.Type.CUSTOMER:
                    newRecord.setValue({
                        fieldId: 'custentity_cl_synced_to_tadpull',
                        value: false
                    });
                    break;

                case record.Type.SALES_ORDER:
                    newRecord.setValue({
                        fieldId: 'custbody_cl_synced_to_tadpull',
                        value: false
                    });
                    break;

                case record.Type.INVENTORY_ITEM:
                case record.Type.ASSEMBLY_ITEM:
                    newRecord.setValue({
                        fieldId: 'custitem_cl_synced_to_tadpull',
                        value: false
                    });
                    break;

                default:
                    log.debug('Unhandled Record Type', recordType);
            }
        } catch (e) {
            log.error('Error unchecking sync flag', e);
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
