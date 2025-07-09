/**
 * Copyright (c) 2025 Osmose, Inc.
 * All Rights Reserved.
 *
 * Script Name: OUS| Opportunity Forecast
 * Description: This User Event script auto-creates or updates the related SFA Forecast 
 *              record from header fields on Opportunity record. Works on specific Imcorp forms.
 *
 * Version History:
 * | Version | Date       | Author           | Remarks                                  |
 * |---------|------------|------------------|------------------------------------------|
 * | 1.00    | 2025-06-09 | Himanshu Kumar   | auto-creates or updates the related SFA Forecast |
 * 
 */
/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/runtime', 'N/log'], (record, search, runtime, log) => {

    const ALLOWED_FORMS = ['212', '213', '221', '230'];

    // Mapping between header and forecast record fields
    const fieldMapping = {
        'custbody_imc_opp_year': 'custrecord_osmose_opportunity_year',
        'class': 'custrecord_osmose_service_code',
        'custbody_project_state': 'custrecord_osmose_state',
        'custbody_imc_sale_type': 'custrecord5',
        'projectedtotal': 'custrecord_osmose_opportunity_amount',
        'custbody_imc_opp_confidence': 'custrecord_osmose_expected_win_type',
        'custbody_expected_start_date': 'custrecord_osmose_expected_start_date',
        'custbody_imc_opp_expected_end_date': 'custrecord_osmose_expected_end_date'
    };

    function afterSubmit(context) {
        const eventType = context.type;
        const newRec = context.newRecord;
        const oldRec = context.oldRecord;

        const formId = newRec.getValue('customform')?.toString();
        if (!ALLOWED_FORMS.includes(formId)) return;

        const oppId = newRec.id;

        // Search for existing forecast record
        const forecastSearch = search.create({
            type: 'customrecord_osmose_opportunity_forecast',
            filters: [['custrecord1', 'is', oppId]],
            columns: ['internalid']
        }).run().getRange({ start: 0, end: 1000 });

        if (eventType === context.UserEventType.CREATE || forecastSearch.length === 0) {
            log.audit('Creating new forecast record');

            const forecastRec = record.create({ type: 'customrecord_osmose_opportunity_forecast', isDynamic: true });
            forecastRec.setValue('custrecord1', oppId); // Link to Opportunity

            Object.keys(fieldMapping).forEach(headerField => {
                const forecastField = fieldMapping[headerField];
                forecastRec.setValue(forecastField, newRec.getValue(headerField));
            });

            // Additional default field
            forecastRec.setValue('custrecord_osm_scope', 1);
            forecastRec.setValue('custrecord_osmose_expected_sales', newRec.getValue('projectedtotal') || 0);

            forecastRec.save();
            log.audit('Forecast record created for Opportunity: ' + oppId);
            return;
        }

        // If forecast exists and record was edited — update changed fields
        if (eventType === context.UserEventType.EDIT && forecastSearch.length > 0) {
            log.audit('Updating forecast records for Opportunity: ' + oppId);

            forecastSearch.forEach(result => {
                const forecastId = result.getValue('internalid');
                const forecastRec = record.load({
                    type: 'customrecord_osmose_opportunity_forecast',
                    id: forecastId,
                    isDynamic: true
                });

                let updated = false;

                Object.keys(fieldMapping).forEach(headerField => {
                    const forecastField = fieldMapping[headerField];
                    const oldVal = oldRec.getValue(headerField);
                    const newVal = newRec.getValue(headerField);
                    const currentVal = forecastRec.getValue(forecastField);

                    if (oldVal !== newVal && currentVal !== newVal) {
                        forecastRec.setValue(forecastField, newVal);
                        updated = true;
                        log.debug(`Updated ${forecastField} in Forecast ID ${forecastId}`, `Old: ${oldVal}, New: ${newVal}`);
                    }
                });

                // Update expected sales if projectedtotal changes
                const oldProjected = oldRec.getValue('projectedtotal') || 0;
                const newProjected = newRec.getValue('projectedtotal') || 0;
                if (oldProjected !== newProjected || eventType === context.UserEventType.CREATE) {
                    forecastRec.setValue('custrecord_osmose_expected_sales', newProjected);
                    updated = true;
                    log.debug(`Updated expected sales in Forecast ID ${forecastId}`, `Old: ${oldProjected}, New: ${newProjected}`);
                }

                if (updated) {
                    forecastRec.save();
                    log.audit('Forecast record updated: ' + forecastId);
                }
            });
        }
    }

    return { afterSubmit };
});
