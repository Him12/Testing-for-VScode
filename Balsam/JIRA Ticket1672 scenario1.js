/**
 * Copyright (c) 2025 Balsam, Inc.
 * All Rights Reserved.
 *
 * Script Name: BB|Prevent refund on a migrated return
 * Description: This Client Script prevents refunds on Return Authorization records where custbody_bpc_bb_migrated = 'Y' 
 *              by showing an alert and blocking the action when the Refund button is clicked or the record is saved.
 *
 * Version History:
 * | Version | Date       | Author           | Remarks                                  |
 * |---------|------------|------------------|------------------------------------------|
 * | 1.0   | 2025-08-06 | Himanshu Kumar     | Updated to prevent refunds on migrated return orders |
 */

/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/ui/message', 'N/record'], function(message, record) {
    
    function pageInit(scriptContext) {
        // No initialization needed
    }

    function buttonClicked(scriptContext) {
        var currentRecord = scriptContext.currentRecord;
        var buttonId = scriptContext.getButtonId();

        // Check if the clicked button is "Refund"
        if (buttonId === 'refund' || buttonId === 'custpage_refund_button') { // Assuming custom and standard refund button both
            var isMigrated = currentRecord.getValue({
                fieldId: 'custbody_bpc_bb_migrated'
            });

            if (isMigrated === 'Y'|| isMigrated === true) {
                var myMsg = message.create({
                    title: 'Refund Blocked',
                    message: 'This is a migrated return order. You cannot refund this order.',
                    type: message.Type.ERROR
                });
                myMsg.show();
                return false; // Prevent the refund action
            }
        }
        return true; // Allow other button actions
    }

    function saveRecord(scriptContext) {
        var currentRecord = scriptContext.currentRecord;
        var isMigrated = currentRecord.getValue({
            fieldId: 'custbody_bpc_bb_migrated'
        });

        if (isMigrated === 'Y'|| isMigrated === true) {
            var myMsg = message.create({
                title: 'Refund Blocked',
                message: 'This is a migrated return order. You cannot refund this order.',
                type: message.Type.ERROR
            });
            myMsg.show();
            return false; // Prevent saving the record
        }
        return true; // Allow saving if not migrated
    }

    return {
        pageInit: pageInit,
        buttonClicked: buttonClicked,
        saveRecord: saveRecord
    };
});