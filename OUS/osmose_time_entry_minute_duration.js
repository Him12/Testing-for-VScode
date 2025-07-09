/**
 * Copyright (c) 2024 Osmose, Inc.
 * All Rights Reserved.
 *
 * The following Javascript source code is intended for use on the Netsuite
 * platform.
 * This software is the confidential and proprietary information of
 * Osmose, Inc. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Osmose.
 *
 * Script Name: EmployeeTimeEntry_Rounding.js
 * Description: This User Event script automatically rounds the 'hours' field on 
 * the Employee Time Entry record during create or edit. It applies specific 
 * rounding rules to convert the decimal portion of hours into the nearest 
 * quarter-hour (0, 15, 30, 45, or round up to the next hour). In edit mode, the 
 * script only triggers if the 'hours' field has been modified. 
 *
 * Version History:
 *
 * | Version | Date       | Author           | Remarks                                  |
 * |---------|------------|------------------|------------------------------------------|
 * | 1.00    | 2025-04-16 | Himanshu Kumar   | Initial version                          |
 */

/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/log', 'N/runtime'], (record, log, runtime) => {

    const beforeSubmit = (context) => {
        const newRecord = context.newRecord;
        const oldRecord = context.oldRecord;

        const isCreate = context.type === context.UserEventType.CREATE;
        const isEdit = context.type === context.UserEventType.EDIT;

        const newDuration = newRecord.getValue('hours');
        const oldDuration = isEdit ? oldRecord.getValue('hours') : null;

        // In Edit mode: check if 'hours' changed
        if (isEdit && newDuration === oldDuration) {
            log.debug('No change in hours field', 'Skipping rounding');
            return;
        }

        // Continue if creating or 'hours' has changed in edit
        if (newDuration) {
            let hours = Math.floor(newDuration);
            let minutes = Math.round((newDuration - hours) * 60);

            // Apply rounding rules
            if (minutes >= 0 && minutes <= 7) {
                minutes = 0;
            } else if (minutes >= 8 && minutes <= 22) {
                minutes = 15;
            } else if (minutes >= 23 && minutes <= 37) {
                minutes = 30;
            } else if (minutes >= 38 && minutes <= 52) {
                minutes = 45;
            } else if (minutes >= 53 && minutes <= 60) {
                minutes = 0;
                hours += 1;
            }

            const roundedDuration = hours + (minutes / 60);

            newRecord.setValue({
                fieldId: 'hours',
                value: roundedDuration
            });

            log.debug({
                title: 'Rounding Applied',
                details: `Original: ${newDuration}, Rounded: ${roundedDuration}`
            });
        }
    };

    return {
        beforeSubmit
    };
});
