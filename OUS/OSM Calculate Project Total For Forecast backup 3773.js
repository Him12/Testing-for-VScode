/**
 * Copyright (c) 2024 Osmose, Inc.
 * All Rights Reserved.
 *
 * The following JavaScript source code is intended for use on the NetSuite platform.
 * This software is the confidential and proprietary information of Vayan, Inc. 
 * ("Confidential Information"). You shall not disclose such Confidential Information 
 * and shall use it only in accordance with the terms of the license agreement you 
 * entered into with Vayan.
 *
 * Script Name: OSM_UE_Calcualte_ProjectTotal_Forecast.js
 * Description: This script will calculate the forecast amount and set it to 'projectedtotal'
 *
 * Version History:
 * | Version | Date       | Author               | Remarks                                  |
 * |---------|------------|----------------------|------------------------------------------|
 * | 1.00    | 2025-04-24 | Yogesh P Bhurley     | Initial version                          |
 */

/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log', 'N/runtime'], (record, log, runtime) => {

    /**
     * Executes after the record is submitted to update the projected total based on related opportunity lines.
     * @param {Object} context - The context object for the user event
     * @param {Object} context.newRecord - The record after submission
     */
    const afterSubmit = (context) => {
        try {
            const newRecord = context.newRecord;
            const recordType = newRecord.type;
            const recordId = newRecord.id;

            // Retrieve valid form IDs from script parameter
            const validFormIds = getValidFormIds();
            if (!validFormIds || validFormIds.length === 0) {
                log.error({
                    title: 'Invalid Script Parameter',
                    details: 'No valid form IDs found in custscript_imc_valid_form_ids.'
                });
                return;
            }

            // Get the custom form ID from the record
            const customFormId = newRecord.getValue({ fieldId: 'customform' });
            if (!validFormIds.includes(String(customFormId))) {
                log.debug({
                    title: 'Skipped Execution',
                    details: `Custom form ID ${customFormId} is not in valid form IDs: ${validFormIds.join(', ')} for record ID: ${recordId}`
                });
                return;
            }

            // Load the opportunity record in dynamic mode
            const opportunityRecord = record.load({
                type: recordType,
                id: recordId,
                isDynamic: true
            });

            // Calculate total forecast amount from related opportunity lines
            const lineCount = opportunityRecord.getLineCount({
                sublistId: 'recmachcustrecord_related_opportunity'
            });
            let totalForecastAmount = 0;

            for (let i = 0; i < lineCount; i++) {
                const forecastAmount = opportunityRecord.getSublistValue({
                    sublistId: 'recmachcustrecord_related_opportunity',
                    fieldId: 'custrecord_opportunity_forecast_amount',
                    line: i
                });

                totalForecastAmount += parseFloat(forecastAmount) || 0;
            }

            // Update the projectedtotal field
            opportunityRecord.setValue({
                fieldId: 'projectedtotal',
                value: totalForecastAmount
            });

            // Save the record
            const savedRecordId = opportunityRecord.save({
                ignoreMandatoryFields: true
            });

            log.debug({
                title: 'Projected Total Updated',
                details: `Record ID: ${savedRecordId}, Projected Total: ${totalForecastAmount}`
            });

        } catch (error) {
            log.error({
                title: 'Error in afterSubmit',
                details: `Error: ${error.message}, Stack: ${error.stack}`
            });
        }
    };

    /**
     * Retrieves valid custom form IDs from script parameters.
     * @returns {Array<string>} - Array of valid form IDs
     */
    const getValidFormIds = () => {
        const script = runtime.getCurrentScript();
        const formIdsParam = script.getParameter({ name: 'custscript_imc_valid_form_ids' });

        if (!formIdsParam) {
            return [];
        }

        // Split the parameter by comma and trim whitespace
        return formIdsParam.split(',').map(id => id.trim()).filter(id => id);
    };

    return {
        afterSubmit
    };
});



/**---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------/**

/**
 * Copyright (c) 2025 Osmose, Inc.
 * All Rights Reserved.
 *
 * Script Name: OSM|Calculate Project Total For Forecast
 * Description: This User Event script auto-creates or updates the related SFA Forecast 
 *              record from header fields on Opportunity record, calculates the 
 *              projected total based on related opportunity lines, and sets the 
 *              expected end date to 12/31 of the opportunity year. Works on specific Imcorp forms.
 *
 * Version History:
 * | Version | Date       | Author           | Remarks                                  |
 * |---------|------------|------------------|------------------------------------------|
 * | 1.00    | 2025-06-09 | Yogesh   | auto-creates or updates the related SFA Forecast |
 */

/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/runtime', 'N/log', 'N/format'], (record, search, runtime, log, format) => {

    const ALLOWED_FORMS = ['212', '213', '221', '230'];

    // Mapping between header and forecast record fields
    const fieldMapping = {
        'custbody_imc_opp_year': 'custrecord_osmose_opportunity_year',
        'class': 'custrecord_osmose_service_code',
        'custbody_project_state': 'custrecord_osmose_state',
        'custbody_imc_sale_type': 'custrecord5',
        'projectedtotal': 'custrecord_osmose_opportunity_amount',
        'custbody_imc_opp_confidence': 'custrecord_osmose_expected_win_type',
        'custbody_expected_start_date': 'custrecord_osmose_expected_start_date'
        // Removed custbody_imc_opp_expected_end_date to avoid override
    };

    /**
     * Retrieves valid custom form IDs from script parameters.
     * @returns {Array<string>} - Array of valid form IDs
     */
    const getValidFormIds = () => {
        const script = runtime.getCurrentScript();
        const formIdsParam = script.getParameter({ name: 'custscript_imc_valid_form_ids' });
        log.debug({
            title: 'getValidFormIds',
            details: `Script Parameter (custscript_imc_valid_form_ids): ${formIdsParam}`
        });

        if (!formIdsParam) {
            log.audit({
                title: 'getValidFormIds',
                details: 'No script parameter found, falling back to ALLOWED_FORMS'
            });
            return ALLOWED_FORMS;
        }

        const validIds = formIdsParam.split(',').map(id => id.trim()).filter(id => id);
        log.debug({
            title: 'getValidFormIds',
            details: `Valid Form IDs: ${validIds.join(', ')}`
        });
        return validIds;
    };

    /**
     * Calculates the total forecast amount from related opportunity lines and updates the projectedtotal field.
     * @param {Object} opportunityRecord - The opportunity record in dynamic mode
     * @returns {number} - The calculated total forecast amount
     */
    const calculateAndUpdateProjectedTotal = (opportunityRecord) => {
        try {
            const lineCount = opportunityRecord.getLineCount({
                sublistId: 'recmachcustrecord_related_opportunity'
            });
            log.debug({
                title: 'calculateAndUpdateProjectedTotal',
                details: `Line Count for recmachcustrecord_related_opportunity: ${lineCount}`
            });

            let totalForecastAmount = 0;
            for (let i = 0; i < lineCount; i++) {
                const forecastAmount = opportunityRecord.getSublistValue({
                    sublistId: 'recmachcustrecord_related_opportunity',
                    fieldId: 'custrecord_opportunity_forecast_amount',
                    line: i
                });
                log.debug({
                    title: 'calculateAndUpdateProjectedTotal',
                    details: `Line ${i}: Forecast Amount = ${forecastAmount}`
                });
                totalForecastAmount += parseFloat(forecastAmount) || 0;
            }

            opportunityRecord.setValue({
                fieldId: 'projectedtotal',
                value: totalForecastAmount
            });

            log.debug({
                title: 'Projected Total Calculated',
                details: `Record ID: ${opportunityRecord.id}, Projected Total: ${totalForecastAmount}`
            });
            return totalForecastAmount;
        } catch (error) {
            log.error({
                title: 'Error in calculateAndUpdateProjectedTotal',
                details: `Error: ${error.message}, Stack: ${error.stack}`
            });
            return 0;
        }
    };

    /**
     * Sets the expected end date to 12/31 of the opportunity year.
     * @param {Object} opportunityRecord - The opportunity record in dynamic mode
     * @param {Object} forecastRec - The forecast record in dynamic mode (optional)
     * @returns {boolean} - True if end date was set, false if not
     */
    const setExpectedEndDate = (opportunityRecord, forecastRec = null) => {
        try {
            // Use getText to handle dropdown fields for Opportunity Year
            const opportunityYearText = opportunityRecord.getText({
                fieldId: 'custbody_imc_opp_year'
            });
            const opportunityYearValue = opportunityRecord.getValue({
                fieldId: 'custbody_imc_opp_year'
            });
            log.debug({
                title: 'setExpectedEndDate',
                details: `Opportunity Year (Text): ${opportunityYearText}, Opportunity Year (Value): ${opportunityYearValue}, Type (Text): ${typeof opportunityYearText}`
            });

            // Validate year from text value
            const year = parseInt(opportunityYearText);
            if (!opportunityYearText || isNaN(year) || year < 2000 || year > 2100) {
                log.audit({
                    title: 'Invalid Opportunity Year',
                    details: `Opportunity Year is missing or invalid for record ID: ${opportunityRecord.id}. Text: ${opportunityYearText}, Value: ${opportunityYearValue}. Expected end date not set.`
                });
                return false;
            }

            // Create date for 12/31/YYYY
            const endDate = new Date(year, 11, 31); // Month is 0-based, so 11 = December
            // Parse date using N/format to ensure compatibility with NetSuite locale
            const formattedEndDate = format.parse({
                value: `12/31/${year}`,
                type: format.Type.DATE
            });
            log.debug({
                title: 'setExpectedEndDate',
                details: `Calculated End Date: ${endDate}, Parsed Formatted Date: ${formattedEndDate}`
            });

            // Log current field values before setting
            const currentOppEndDate = opportunityRecord.getValue('custbody_imc_opp_expected_end_date');
            const currentForecastEndDate = forecastRec ? forecastRec.getValue('custrecord_osmose_expected_end_date') : 'N/A';
            log.debug({
                title: 'Current Date Field Values',
                details: `Opportunity End Date: ${currentOppEndDate}, Forecast End Date: ${currentForecastEndDate}`
            });

            // Set Expected End Date on Opportunity record
            opportunityRecord.setValue({
                fieldId: 'custbody_imc_opp_expected_end_date',
                value: formattedEndDate,
                ignoreFieldChange: true
            });

            // Set Expected End Date on Forecast record if provided
            if (forecastRec) {
                forecastRec.setValue({
                    fieldId: 'custrecord_osmose_expected_end_date',
                    value: formattedEndDate,
                    ignoreFieldChange: true
                });
            }

            log.debug({
                title: 'Expected End Date Set',
                details: `Record ID: ${opportunityRecord.id}, Expected End Date: ${formattedEndDate}, Forecast Record: ${forecastRec ? 'Set' : 'Not Provided'}`
            });
            return true;
        } catch (error) {
            log.error({
                title: 'Error in setExpectedEndDate',
                details: `Error: ${error.message}, Stack: ${error.stack}`
            });
            return false;
        }
    };

    /**
     * Executes after the record is submitted to update the projected total and create/update the forecast record.
     * @param {Object} context - The context object for the user event
     */
    const afterSubmit = (context) => {
        try {
            const eventType = context.type;
            const newRec = context.newRecord;
            const oldRec = context.oldRecord;
            log.debug({
                title: 'afterSubmit',
                details: `Event Type: ${eventType}, Record ID: ${newRec.id}, Record Type: ${newRec.type}`
            });

            // Log NetSuite date format
            const dateFormat = runtime.getCurrentUser().getPreference('DATEFORMAT');
            log.debug({
                title: 'NetSuite Date Format',
                details: `Account Date Format: ${dateFormat}`
            });

            // Validate custom form
            const validFormIds = getValidFormIds();
            const formId = newRec.getValue('customform')?.toString();
            log.debug({
                title: 'Form Validation',
                details: `Custom Form ID: ${formId}, Valid Form IDs: ${validFormIds.join(', ')}`
            });

            if (!validFormIds.includes(formId)) {
                log.debug({
                    title: 'Skipped Execution',
                    details: `Custom form ID ${formId} is not in valid form IDs: ${validFormIds.join(', ')} for record ID: ${newRec.id}`
                });
                return;
            }

            // Log all relevant field values from newRec
            log.debug({
                title: 'Opportunity Record Fields',
                details: `Year (Text): ${newRec.getText('custbody_imc_opp_year')}, Year (Value): ${newRec.getValue('custbody_imc_opp_year')}, Service Code: ${newRec.getValue('class')}, Location: ${newRec.getValue('custbody_project_state')}, Sale Type: ${newRec.getValue('custbody_imc_sale_type')}, Opportunity Confidence: ${newRec.getValue('custbody_imc_opp_confidence')}, Expected Start Date: ${newRec.getValue('custbody_expected_start_date')}, Expected End Date: ${newRec.getValue('custbody_imc_opp_expected_end_date')}`
            });

            // Load the opportunity record in dynamic mode
            const opportunityRecord = record.load({
                type: newRec.type,
                id: newRec.id,
                isDynamic: true
            });
            log.debug({
                title: 'Opportunity Record Loaded',
                details: `Record ID: ${opportunityRecord.id}, Type: ${opportunityRecord.type}`
            });

            // Calculate and update projected total
            const totalForecastAmount = calculateAndUpdateProjectedTotal(opportunityRecord);
            log.debug({
                title: 'Projected Total Processing Complete',
                details: `Total Forecast Amount: ${totalForecastAmount}`
            });

            // Set expected end date on opportunity record
            const endDateSet = setExpectedEndDate(opportunityRecord);
            log.debug({
                title: 'setExpectedEndDate Result',
                details: `End Date Set on Opportunity: ${endDateSet}`
            });

            // Save the opportunity record with updated projectedtotal and expected end date
            const savedRecordId = opportunityRecord.save({
                ignoreMandatoryFields: true
            });
            log.debug({
                title: 'Opportunity Record Saved',
                details: `Record ID: ${savedRecordId}, Projected Total: ${totalForecastAmount}`
            });

            // Search for existing forecast record
            log.debug({
                title: 'Searching for Forecast Records',
                details: `Searching for customrecord_osmose_opportunity_forecast with custrecord1 = ${newRec.id}`
            });
            const forecastSearch = search.create({
                type: 'customrecord_osmose_opportunity_forecast',
                filters: [['custrecord1', 'is', newRec.id]],
                columns: ['internalid', 'custrecord_osmose_expected_end_date']
            }).run().getRange({ start: 0, end: 1000 });
            log.debug({
                title: 'Forecast Search Results',
                details: `Found ${forecastSearch.length} forecast records for Opportunity ID: ${newRec.id}`
            });

            if (eventType === context.UserEventType.CREATE || forecastSearch.length === 0) {
                log.audit({
                    title: 'Creating SFA Forecast Record',
                    details: `No existing forecast found or CREATE event for Opportunity ID: ${newRec.id}`
                });

                const forecastRec = record.create({
                    type: 'customrecord_osmose_opportunity_forecast',
                    isDynamic: true
                });
                forecastRec.setValue('custrecord1', newRec.id); // Link to Opportunity

                // Set field mappings, excluding Expected End Date
                Object.keys(fieldMapping).forEach(headerField => {
                    const forecastField = fieldMapping[headerField];
                    const value = headerField === 'projectedtotal' ? totalForecastAmount : newRec.getValue(headerField);
                    forecastRec.setValue(forecastField, value);
                    log.debug({
                        title: 'Setting Forecast Field',
                        details: `Field: ${forecastField}, Value: ${value}`
                    });
                });

                // Set expected end date on forecast record
                setExpectedEndDate(opportunityRecord, forecastRec);

                // Additional default fields
                forecastRec.setValue('custrecord_osm_scope', 1);
                forecastRec.setValue('custrecord_osmose_expected_sales', totalForecastAmount);
                log.debug({
                    title: 'Additional Forecast Fields',
                    details: `custrecord_osm_scope: 1, custrecord_osmose_expected_sales: ${totalForecastAmount}`
                });

                const forecastId = forecastRec.save({
                    ignoreMandatoryFields: true
                });
                log.audit({
                    title: 'Forecast Record Created',
                    details: `Forecast Record ID: ${forecastId} for Opportunity: ${newRec.id}`
                });
                return;
            }

            // If forecast exists and record was edited — update changed fields
            if (eventType === context.UserEventType.EDIT && forecastSearch.length > 0) {
                log.audit({
                    title: 'Updating Forecast Records',
                    details: `Found ${forecastSearch.length} forecast records for Opportunity: ${newRec.id}`
                });

                forecastSearch.forEach(result => {
                    const forecastId = result.getValue('internalid');
                    log.debug({
                        title: 'Processing Forecast Record',
                        details: `Forecast ID: ${forecastId}, Current Expected End Date: ${result.getValue('custrecord_osmose_expected_end_date')}`
                    });

                    const forecastRec = record.load({
                        type: 'customrecord_osmose_opportunity_forecast',
                        id: forecastId,
                        isDynamic: true
                    });

                    let updated = false;

                    Object.keys(fieldMapping).forEach(headerField => {
                        const forecastField = fieldMapping[headerField];
                        const oldVal = oldRec.getValue(headerField);
                        const newVal = headerField === 'projectedtotal' ? totalForecastAmount : newRec.getValue(headerField);
                        const currentVal = forecastRec.getValue(forecastField);

                        if (oldVal !== newVal && currentVal !== newVal) {
                            forecastRec.setValue(forecastField, newVal);
                            updated = true;
                            log.debug({
                                title: `Updated Forecast Field`,
                                details: `Field: ${forecastField}, Old: ${oldVal}, New: ${newVal}`
                            });
                        }
                    });

                    // Update expected end date on forecast record
                    setExpectedEndDate(opportunityRecord, forecastRec);

                    // Update expected sales if projectedtotal changes
                    const oldProjected = oldRec.getValue('projectedtotal') || 0;
                    if (oldProjected !== totalForecastAmount) {
                        forecastRec.setValue('custrecord_osmose_expected_sales', totalForecastAmount);
                        updated = true;
                        log.debug({
                            title: `Updated Expected Sales`,
                            details: `Forecast ID: ${forecastId}, Old: ${oldProjected}, New: ${totalForecastAmount}`
                        });
                    }

                    if (updated) {
                        const savedForecastId = forecastRec.save({
                            ignoreMandatoryFields: true
                        });
                        log.audit({
                            title: 'Forecast Record Updated',
                            details: `Forecast Record ID: ${savedForecastId}`
                        });
                    } else {
                        log.debug({
                            title: 'No Forecast Updates Needed',
                            details: `No changes detected for Forecast ID: ${forecastId}`
                        });
                    }
                });
            }

        } catch (error) {
            log.error({
                title: 'Error in afterSubmit',
                details: `Error: ${error.message}, Stack: ${error.stack}`
            });
        }
    };

    return { afterSubmit };
});